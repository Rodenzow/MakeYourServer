import {
  DISCORD_CHANNEL_TYPE,
  EVERYONE,
  automodPayload,
  botAccessOverwrite,
  categoryPayload,
  channelDiscordType,
  channelPayload,
  findCategory,
  findChannel,
  guildSettingsPayload,
  messageNonce,
  messagePayload,
  onboardingPayload,
  rolePayload,
  snowflakeTime,
  toBitfield,
  welcomeScreenPayload,
  effectiveChannelOverwrites,
  type GuildState,
  type Resolver,
  type ServerSpec,
} from "@mys/core";
import {
  and,
  asc,
  audit,
  backupMessages,
  eq,
  getDb,
  guildFeatures,
  installationSteps,
  installations,
  logError,
  projects,
  resourceMappings,
  sql,
  templates,
  users,
} from "@mys/db";
import { GatewayError, translateDiscordError, type GuildGateway } from "./gateway";
import { SimulatedCrash } from "./fake-gateway";
import { assertGuildAccess, AccessDeniedError, BotMissingError } from "./services/access";
import { createBackup } from "./services/backups";

type InstallationRow = typeof installations.$inferSelect;
type StepRow = typeof installationSteps.$inferSelect;

export type StepStatus = "pending" | "running" | "succeeded" | "skipped" | "failed" | "cancelled";

/** Erreur demandant une nouvelle tentative ultérieure de toute la tâche (Discord indisponible…). */
export class RetryLaterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryLaterError";
  }
}
/** Le bail de la tâche a été perdu : un autre processus a repris l’installation. */
export class LeaseLostError extends Error {}

export interface ExecutorDeps {
  gateway: GuildGateway;
  /** Prolonge le bail de la tâche ; false = un autre processus a repris la main. */
  keepAlive?: () => Promise<boolean>;
  onProgress?: (installationId: string) => Promise<void> | void;
  /** Tolérance pour retrouver un élément créé juste avant une interruption (ms). */
  reconcileSkewMs?: number;
}

interface Ctx {
  inst: InstallationRow;
  spec: ServerSpec;
  gateway: GuildGateway;
  state: GuildState;
  mapping: Map<string, string>;
  resolver: Resolver;
  botOverwrite: ReturnType<typeof botAccessOverwrite>;
  reason: string;
  skew: number;
}

interface StepOutcome {
  status: "succeeded" | "skipped";
  detail: string;
  map?: Array<{ localId: string; discordId: string; kind: string; origin?: "created" | "adopted" }>;
}

const lower = (s: string) => s.trim().toLocaleLowerCase("fr");

/* -------------------------------------------------------------------------- */

export async function runInstallation(installationId: string, deps: ExecutorDeps): Promise<InstallationRow> {
  const db = getDb();
  let [inst] = await db.select().from(installations).where(eq(installations.id, installationId));
  if (!inst) throw new Error(`Installation ${installationId} introuvable`);
  if (["succeeded", "partial", "failed", "cancelled"].includes(inst.status)) return inst;

  if (inst.status !== "running") {
    [inst] = await db
      .update(installations)
      .set({ status: "running", startedAt: inst.startedAt ?? new Date() })
      .where(eq(installations.id, installationId))
      .returning();
  }
  const gateway = deps.gateway;

  // 1. Revérification des droits AU MOMENT de l’exécution.
  try {
    const [user] = await db.select().from(users).where(eq(users.id, inst!.userId));
    if (!user || user.suspendedAt) throw new AccessDeniedError("Compte suspendu ou introuvable.");
    const needsAdmin = inst!.kind === "restore" || inst!.plan.ops.some((o) => o.destructive || o.kind === "community.enable");
    await assertGuildAccess(gateway, inst!.guildId, user.discordId, needsAdmin ? "admin" : "manage");
  } catch (e) {
    if (e instanceof AccessDeniedError || e instanceof BotMissingError) return finishWithError(inst!, e.message);
    throw e;
  }

  // 2. État réel du serveur et correspondances connues.
  let state: GuildState;
  try {
    state = await gateway.fetchState(inst!.guildId);
  } catch (e) {
    const err = translateDiscordError(e);
    if (err.retriable) throw new RetryLaterError(err.message);
    return finishWithError(inst!, err.message);
  }
  if (!state.bot) return finishWithError(inst!, "Le bot n’est plus présent sur le serveur.");

  const mapRows = await db
    .select()
    .from(resourceMappings)
    .where(and(eq(resourceMappings.guildId, inst!.guildId), eq(resourceMappings.scopeId, inst!.scopeId)));
  const mapping = new Map(mapRows.map((r) => [r.localId, r.discordId]));
  const resolver: Resolver = {
    guildId: inst!.guildId,
    role: (id) => (id === EVERYONE ? inst!.guildId : mapping.get(id) ?? null),
    channel: (id) => mapping.get(id) ?? null,
    serverName: state.name,
  };
  const ctx: Ctx = {
    inst: inst!,
    spec: inst!.spec,
    gateway,
    state,
    mapping,
    resolver,
    botOverwrite: state.bot.isAdmin ? null : botAccessOverwrite(gateway.botUserId, BigInt(state.bot.permissions)),
    reason: `Make Your Server — installation ${inst!.id.slice(0, 8)}`,
    skew: deps.reconcileSkewMs ?? 15_000,
  };

  // 3. Exécution séquentielle des étapes restantes.
  const steps = await db.select().from(installationSteps).where(eq(installationSteps.installationId, installationId)).orderBy(asc(installationSteps.seq));
  for (const step of steps) {
    if (["succeeded", "skipped", "failed", "cancelled"].includes(step.status)) continue;

    const [fresh] = await db.select({ cancel: installations.cancelRequested }).from(installations).where(eq(installations.id, installationId));
    if (fresh?.cancel) {
      await db
        .update(installationSteps)
        .set({ status: "cancelled", finishedAt: new Date() })
        .where(and(eq(installationSteps.installationId, installationId), sql`${installationSteps.status} in ('pending','running')`));
      break;
    }
    if (deps.keepAlive && !(await deps.keepAlive())) throw new LeaseLostError("Bail perdu");

    const resumed = step.status === "running";
    const startedAt = resumed && step.startedAt ? step.startedAt : new Date();
    await db
      .update(installationSteps)
      .set({ status: "running", attempts: step.attempts + 1, startedAt })
      .where(eq(installationSteps.id, step.id));

    try {
      const outcome = await executeStep(ctx, { ...step, startedAt }, resumed);
      await db.transaction(async (tx) => {
        for (const m of outcome.map ?? []) {
          await tx
            .insert(resourceMappings)
            .values({ guildId: ctx.inst.guildId, scopeId: ctx.inst.scopeId, localId: m.localId, discordId: m.discordId, kind: m.kind, origin: m.origin ?? "created", installationId: ctx.inst.id })
            .onConflictDoUpdate({
              target: [resourceMappings.guildId, resourceMappings.scopeId, resourceMappings.localId],
              set: { discordId: m.discordId, updatedAt: new Date(), installationId: ctx.inst.id },
            });
          ctx.mapping.set(m.localId, m.discordId);
        }
        await tx.update(installationSteps).set({ status: outcome.status, detail: outcome.detail, error: null, finishedAt: new Date() }).where(eq(installationSteps.id, step.id));
      });
    } catch (e) {
      if (e instanceof SimulatedCrash || e instanceof LeaseLostError) throw e;
      const err = e instanceof StepFailure ? e : translateDiscordError(e);
      const retriable = err instanceof GatewayError && err.retriable;
      if (retriable && step.attempts + 1 < 4) {
        // Issue inconnue (Discord a pu appliquer l’action) : l’étape reste « running »,
        // la prochaine tentative vérifiera l’état réel avant de recommencer.
        await db.update(installationSteps).set({ error: err.message }).where(eq(installationSteps.id, step.id));
        throw new RetryLaterError(err.message);
      }
      await db.update(installationSteps).set({ status: "failed", error: err.message, finishedAt: new Date() }).where(eq(installationSteps.id, step.id));
      if (!(err instanceof StepFailure)) await logError("worker", `Étape ${step.key} échouée`, { installationId, code: (err as GatewayError).code, message: err.message });
    }
    await deps.onProgress?.(installationId);
  }

  return finalize(installationId, deps);
}

class StepFailure extends Error {}
const fail = (msg: string): never => {
  throw new StepFailure(msg);
};

async function finishWithError(inst: InstallationRow, message: string) {
  const db = getDb();
  await db
    .update(installationSteps)
    .set({ status: "cancelled", finishedAt: new Date() })
    .where(and(eq(installationSteps.installationId, inst.id), sql`${installationSteps.status} in ('pending','running')`));
  const [row] = await db.update(installations).set({ status: "failed", error: message, finishedAt: new Date() }).where(eq(installations.id, inst.id)).returning();
  await audit({ actorUserId: inst.userId, actorType: "system", action: "installation.failed", targetType: "installation", targetId: inst.id, guildId: inst.guildId, metadata: { reason: message } });
  return row!;
}

async function finalize(installationId: string, deps: ExecutorDeps) {
  const db = getDb();
  const steps = await db.select().from(installationSteps).where(eq(installationSteps.installationId, installationId));
  const [inst] = await db.select().from(installations).where(eq(installations.id, installationId));
  const ok = steps.filter((s) => s.status === "succeeded" || s.status === "skipped").length;
  const failed = steps.filter((s) => s.status === "failed").length;
  const cancelled = steps.filter((s) => s.status === "cancelled").length;
  // Un échec partiel n’est JAMAIS présenté comme une réussite.
  const status = cancelled > 0 ? "cancelled" : failed === 0 ? "succeeded" : ok > 0 ? "partial" : "failed";
  const error = failed ? `${failed} étape(s) en échec sur ${steps.length}.` : cancelled ? `Installation annulée : ${cancelled} étape(s) non exécutée(s).` : null;
  const [row] = await db.update(installations).set({ status, error, finishedAt: new Date() }).where(eq(installations.id, installationId)).returning();
  if (inst && !inst.dryRun && inst.kind === "install" && (status === "succeeded" || status === "partial") && inst.projectId) {
    const [p] = await db.select({ t: projects.sourceTemplateId }).from(projects).where(eq(projects.id, inst.projectId));
    if (p?.t) await db.update(templates).set({ installCount: sql`${templates.installCount} + 1` }).where(eq(templates.id, p.t));
  }
  await audit({ actorUserId: inst?.userId, actorType: "system", action: `installation.${status}`, targetType: "installation", targetId: installationId, guildId: inst?.guildId, metadata: { ok, failed, cancelled, dryRun: inst?.dryRun } });
  await deps.onProgress?.(installationId);
  return row!;
}

/* -------------------------------------------------------------------------- */
/*                               Exécution d’une étape                          */
/* -------------------------------------------------------------------------- */

async function refresh(ctx: Ctx) {
  ctx.state = await ctx.gateway.fetchState(ctx.inst.guildId);
}

/** Retrouve un élément créé juste avant une interruption (même nom, créé après le début de l’étape). */
function reconcile<T extends { id: string; name: string }>(ctx: Ctx, items: T[], name: string, startedAt: Date, extra?: (x: T) => boolean): T | undefined {
  const used = new Set(ctx.mapping.values());
  return items.find(
    (x) => !used.has(x.id) && lower(x.name) === lower(name) && snowflakeTime(x.id) >= startedAt.getTime() - ctx.skew && (!extra || extra(x)),
  );
}

function requireRefs(ctx: Ctx, overwrites: { target: string }[], what: string) {
  const missing = overwrites.filter((o) => o.target !== EVERYONE && !ctx.mapping.get(o.target)).map((o) => ctx.spec.roles.find((r) => r.id === o.target)?.name ?? o.target);
  if (missing.length) fail(`${what} : rôle(s) requis non disponible(s) (${missing.join(", ")}). Le salon n’a pas été créé pour ne pas exposer de contenu privé.`);
}

async function executeStep(ctx: Ctx, step: StepRow & { startedAt: Date }, resumed: boolean): Promise<StepOutcome> {
  const { spec, gateway, state, inst } = ctx;
  const g = inst.guildId;
  const localId = step.localId ?? "";

  switch (step.kind) {
    case "safety-backup": {
      if (inst.dryRun) return { status: "skipped", detail: "Ignorée en mode simulation." };
      if (inst.safetyBackupId) return { status: "skipped", detail: "Sauvegarde déjà effectuée." };
      const backup = await createBackup(gateway, { userId: inst.userId, guildId: g, kind: "safety", installationId: inst.id, state });
      await getDb().update(installations).set({ safetyBackupId: backup.id }).where(eq(installations.id, inst.id));
      ctx.inst.safetyBackupId = backup.id;
      return { status: "succeeded", detail: `Sauvegarde de sécurité n°${backup.version} enregistrée.` };
    }

    /* ------------------------------- Rôles ------------------------------- */
    case "role.create": {
      const role = spec.roles.find((r) => r.id === localId) ?? fail("Rôle absent du projet.");
      const mapped = ctx.mapping.get(localId);
      if (mapped && state.roles.some((r) => r.id === mapped)) return { status: "skipped", detail: "Déjà créé lors d’une tentative précédente." };
      const payload = rolePayload(role);
      if (resumed) {
        await refresh(ctx);
        const found = reconcile(ctx, ctx.state.roles, payload.name, step.startedAt);
        if (found) return { status: "succeeded", detail: "Retrouvé après interruption (aucun doublon créé).", map: [{ localId, discordId: found.id, kind: "role" }] };
      }
      const { id } = await gateway.createRole(g, payload, ctx.reason);
      ctx.state.roles.push({ id, ...payload, position: 1, managed: false });
      return { status: "succeeded", detail: "Rôle créé.", map: [{ localId, discordId: id, kind: "role" }] };
    }
    case "role.adopt":
    case "role.update": {
      const role = spec.roles.find((r) => r.id === localId) ?? fail("Rôle absent du projet.");
      const target = step.targetId ?? ctx.mapping.get(localId) ?? fail("Rôle cible inconnu.");
      if (!state.roles.some((r) => r.id === target)) fail("Le rôle existant a été supprimé entre-temps. Relancez l’analyse.");
      if (step.kind === "role.update") await gateway.editRole(g, target, rolePayload(role), ctx.reason);
      return { status: "succeeded", detail: step.kind === "role.update" ? "Rôle mis à jour." : "Rôle existant réutilisé tel quel.", map: [{ localId, discordId: target, kind: "role", origin: "adopted" }] };
    }
    case "role.positions": {
      await refresh(ctx);
      const positions = computeRolePositions(ctx);
      await gateway.setRolePositions(g, positions, ctx.reason);
      return { status: "succeeded", detail: positions.length ? `${positions.length} rôle(s) repositionné(s).` : "Hiérarchie déjà correcte." };
    }

    /* ------------------------- Catégories & salons ------------------------ */
    case "category.create": {
      const cat = findCategory(spec, localId) ?? fail("Catégorie absente du projet.");
      const mapped = ctx.mapping.get(localId);
      if (mapped && state.channels.some((c) => c.id === mapped)) return { status: "skipped", detail: "Déjà créée lors d’une tentative précédente." };
      requireRefs(ctx, cat.overwrites, `Catégorie « ${cat.name} »`);
      if (resumed) {
        await refresh(ctx);
        const found = reconcile(ctx, ctx.state.channels, cat.name, step.startedAt, (c) => c.type === DISCORD_CHANNEL_TYPE.category);
        if (found) return { status: "succeeded", detail: "Retrouvée après interruption (aucun doublon créé).", map: [{ localId, discordId: found.id, kind: "category" }] };
      }
      const payload = categoryPayload(cat, ctx.resolver, ctx.botOverwrite);
      const { id } = await gateway.createChannel(g, payload, ctx.reason);
      ctx.state.channels.push({ id, name: cat.name, type: 4, parentId: null, position: 0, permissionOverwrites: [] });
      return { status: "succeeded", detail: "Catégorie créée.", map: [{ localId, discordId: id, kind: "category" }] };
    }
    case "category.adopt":
    case "category.update": {
      const cat = findCategory(spec, localId) ?? fail("Catégorie absente du projet.");
      const target = step.targetId ?? ctx.mapping.get(localId) ?? fail("Catégorie cible inconnue.");
      if (!state.channels.some((c) => c.id === target)) fail("La catégorie existante a été supprimée entre-temps. Relancez l’analyse.");
      if (step.kind === "category.update") {
        requireRefs(ctx, cat.overwrites, `Catégorie « ${cat.name} »`);
        const { type: _t, ...payload } = categoryPayload(cat, ctx.resolver, ctx.botOverwrite);
        await gateway.editChannel(target, payload, ctx.reason);
      }
      return { status: "succeeded", detail: step.kind === "category.update" ? "Catégorie mise à jour." : "Catégorie existante réutilisée.", map: [{ localId, discordId: target, kind: "category", origin: "adopted" }] };
    }
    case "channel.create": {
      const found = findChannel(spec, localId) ?? fail("Salon absent du projet.");
      const { channel, category } = found;
      const mapped = ctx.mapping.get(localId);
      if (mapped && state.channels.some((c) => c.id === mapped)) return { status: "skipped", detail: "Déjà créé lors d’une tentative précédente." };
      const parentId = category ? ctx.mapping.get(category.id) ?? null : null;
      if (category && !parentId) fail(`La catégorie « ${category.name} » n’a pas pu être créée : salon ignoré.`);
      requireRefs(ctx, effectiveChannelOverwrites(channel, category), `Salon « ${channel.name} »`);
      const community = ctx.state.features.includes("COMMUNITY");
      const payload = channelPayload(channel, category, ctx.resolver, { community, parentId, botOverwrite: ctx.botOverwrite });
      if (resumed) {
        await refresh(ctx);
        const existing = reconcile(ctx, ctx.state.channels, payload.name as string, step.startedAt, (c) => c.parentId === parentId && c.type !== 4);
        if (existing) return { status: "succeeded", detail: "Retrouvé après interruption (aucun doublon créé).", map: [{ localId, discordId: existing.id, kind: "channel" }] };
      }
      const { id } = await gateway.createChannel(g, payload, ctx.reason);
      ctx.state.channels.push({ id, name: payload.name as string, type: payload.type as number, parentId, position: 0, permissionOverwrites: [] });
      const fallback = channelDiscordType(channel, true) !== payload.type;
      return {
        status: "succeeded",
        detail: fallback ? "Salon créé (en salon standard : la Communauté n’est pas active)." : "Salon créé.",
        map: [{ localId, discordId: id, kind: "channel" }],
      };
    }
    case "channel.adopt":
    case "channel.update": {
      const found = findChannel(spec, localId) ?? fail("Salon absent du projet.");
      const target = step.targetId ?? ctx.mapping.get(localId) ?? fail("Salon cible inconnu.");
      const existing = state.channels.find((c) => c.id === target) ?? fail("Le salon existant a été supprimé entre-temps. Relancez l’analyse.");
      if (step.kind === "channel.update") {
        const { channel, category } = found;
        const parentId = category ? ctx.mapping.get(category.id) ?? null : null;
        requireRefs(ctx, effectiveChannelOverwrites(channel, category), `Salon « ${channel.name} »`);
        const community = ctx.state.features.includes("COMMUNITY");
        const payload: Record<string, unknown> = channelPayload(channel, category, ctx.resolver, { community, parentId, botOverwrite: ctx.botOverwrite });
        const convertible = [0, 5].includes(existing.type) && [0, 5].includes(payload.type as number) && community;
        if (payload.type === existing.type || !convertible) delete payload.type;
        await gateway.editChannel(target, payload, ctx.reason);
      }
      return { status: "succeeded", detail: step.kind === "channel.update" ? "Salon mis à jour." : "Salon existant réutilisé.", map: [{ localId, discordId: target, kind: "channel", origin: "adopted" }] };
    }
    case "channel.positions": {
      await refresh(ctx);
      const positions = computeChannelPositions(ctx);
      await gateway.setChannelPositions(g, positions, ctx.reason);
      return { status: "succeeded", detail: positions.length ? `${positions.length} position(s) ajustée(s).` : "Ordre déjà correct." };
    }

    /* ----------------------------- Réglages ------------------------------ */
    case "guild.settings": {
      const community = ctx.state.features.includes("COMMUNITY");
      if (step.key === "guild.community-channels") {
        const body: Record<string, unknown> = {};
        if (spec.settings.rulesChannelId && ctx.resolver.channel(spec.settings.rulesChannelId)) body.rules_channel_id = ctx.resolver.channel(spec.settings.rulesChannelId);
        if (spec.settings.publicUpdatesChannelId && ctx.resolver.channel(spec.settings.publicUpdatesChannelId))
          body.public_updates_channel_id = ctx.resolver.channel(spec.settings.publicUpdatesChannelId);
        if (!Object.keys(body).length) return { status: "skipped", detail: "Aucun salon à définir." };
        await gateway.editGuild(g, body, ctx.reason);
        return { status: "succeeded", detail: "Salons de la Communauté définis." };
      }
      const payload = guildSettingsPayload(spec, ctx.resolver, { includeCommunityChannels: community });
      for (const [k, v] of Object.entries(payload)) if (v === null || v === undefined) delete payload[k];
      await gateway.editGuild(g, payload, ctx.reason);
      return { status: "succeeded", detail: "Réglages appliqués." };
    }
    case "community.enable": {
      await refresh(ctx);
      if (ctx.state.features.includes("COMMUNITY")) return { status: "skipped", detail: "La Communauté est déjà active." };
      const rules = spec.settings.rulesChannelId ? ctx.resolver.channel(spec.settings.rulesChannelId) : null;
      const updates = spec.settings.publicUpdatesChannelId ? ctx.resolver.channel(spec.settings.publicUpdatesChannelId) : null;
      if (!rules || !updates) fail("Les salons du règlement et des mises à jour n’ont pas été créés : la Communauté ne peut pas être activée.");
      await gateway.editGuild(
        g,
        {
          features: [...new Set([...ctx.state.features, "COMMUNITY"])],
          rules_channel_id: rules,
          public_updates_channel_id: updates,
          verification_level: Math.max(1, ctx.state.verificationLevel),
          explicit_content_filter: 2,
        },
        ctx.reason,
      );
      ctx.state.features.push("COMMUNITY");
      return { status: "succeeded", detail: "Communauté activée." };
    }

    /* ---------------------- Éléments existants hors projet --------------------- */
    case "archive.category": {
      const id = await ensureArchiveCategory(ctx, step.startedAt, resumed);
      return { status: "succeeded", detail: "Catégorie d’archives prête.", map: [{ localId: "__archive", discordId: id, kind: "category" }] };
    }
    case "channel.archive": {
      const target = step.targetId!;
      const channel = ctx.state.channels.find((c) => c.id === target);
      if (!channel) return { status: "skipped", detail: "Salon déjà supprimé." };
      const archiveIds = [...ctx.mapping.entries()].filter(([k]) => k.startsWith("__archive")).map(([, v]) => v);
      if (channel.parentId && archiveIds.includes(channel.parentId)) return { status: "skipped", detail: "Déjà archivé." };
      let archiveId = archiveIds.find((id) => ctx.state.channels.filter((c) => c.parentId === id).length < 50);
      const newMaps: StepOutcome["map"] = [];
      if (!archiveId) {
        archiveId = await createArchiveCategory(ctx, `📦 Archives ${archiveIds.length + 1}`);
        newMaps.push({ localId: `__archive-${archiveIds.length + 1}`, discordId: archiveId, kind: "category" });
        ctx.mapping.set(`__archive-${archiveIds.length + 1}`, archiveId);
      }
      await gateway.editChannel(target, { parent_id: archiveId, permission_overwrites: archiveOverwrites(ctx) }, `${ctx.reason} (archivage)`);
      channel.parentId = archiveId;
      return { status: "succeeded", detail: "Salon déplacé dans les archives et masqué aux membres. Son historique est intact.", map: newMaps };
    }
    case "channel.delete": {
      if (!inst.confirmedDestructive) fail("Suppression non confirmée explicitement : étape ignorée.");
      const target = step.targetId!;
      if (!ctx.state.channels.some((c) => c.id === target)) return { status: "skipped", detail: "Déjà supprimé." };
      await gateway.deleteChannel(target, `${ctx.reason} (suppression confirmée par l’utilisateur)`);
      ctx.state.channels = ctx.state.channels.filter((c) => c.id !== target);
      return { status: "succeeded", detail: "Salon supprimé." };
    }
    case "role.delete": {
      if (!inst.confirmedDestructive) fail("Suppression non confirmée explicitement : étape ignorée.");
      const target = step.targetId!;
      if (!ctx.state.roles.some((r) => r.id === target)) return { status: "skipped", detail: "Déjà supprimé." };
      await gateway.deleteRole(g, target, `${ctx.reason} (suppression confirmée par l’utilisateur)`);
      ctx.state.roles = ctx.state.roles.filter((r) => r.id !== target);
      return { status: "succeeded", detail: "Rôle supprimé." };
    }

    /* ------------------------------ Messages ------------------------------ */
    case "message.send":
    case "message.update": {
      const msg = spec.messages.find((m) => m.id === localId) ?? fail("Message absent du projet.");
      const channelId = ctx.mapping.get(msg.channelId) ?? fail("Le salon du message n’existe pas sur le serveur.");
      const missingRoles = msg.buttons.filter((b) => "roleId" in b && !ctx.mapping.get(b.roleId));
      if (missingRoles.length) fail("Un rôle utilisé par les boutons de ce message n’a pas été créé.");
      const payload = messagePayload(msg, ctx.resolver, spec.meta.accentColor);
      const existingId = ctx.mapping.get(localId);
      if (existingId && (await gateway.messageExists(channelId, existingId))) {
        if (step.kind === "message.send") return { status: "skipped", detail: "Message déjà publié." };
        await gateway.editMessage(channelId, existingId, payload);
        return { status: "succeeded", detail: "Message mis à jour." };
      }
      if (resumed) {
        const recent = await gateway.listMessages(channelId, { limit: 25 });
        const title = payload.embeds[0]?.title;
        const found = recent.find(
          (m) =>
            m.authorId === gateway.botUserId &&
            snowflakeTime(m.id) >= step.startedAt.getTime() - ctx.skew &&
            (title ? (m.embeds[0] as { title?: string } | undefined)?.title === title : m.content === payload.content),
        );
        if (found) return { status: "succeeded", detail: "Retrouvé après interruption (aucun doublon publié).", map: [{ localId, discordId: found.id, kind: "message" }] };
      }
      const { id } = await gateway.sendMessage(channelId, { ...payload, nonce: messageNonce(`${inst.id}:${step.key}`), enforce_nonce: true });
      let detail = "Message publié.";
      if (msg.pin) {
        try {
          await gateway.pinMessage(channelId, id, ctx.reason);
          detail = "Message publié et épinglé.";
        } catch (e) {
          detail = `Message publié, mais non épinglé : ${translateDiscordError(e).message}`;
        }
      }
      return { status: "succeeded", detail, map: [{ localId, discordId: id, kind: "message" }] };
    }

    /* ------------------------------- AutoMod ------------------------------ */
    case "automod.create":
    case "automod.update": {
      const rule = spec.automod.find((r) => r.id === localId) ?? fail("Règle absente du projet.");
      const payload = automodPayload(rule, ctx.resolver);
      const rules = ctx.state.automodRules ?? [];
      const mapped = ctx.mapping.get(localId);
      const target = step.targetId ?? (mapped && rules.some((r) => r.id === mapped) ? mapped : undefined);
      if (target) {
        if (!rules.some((r) => r.id === target)) fail("La règle AutoMod existante a été supprimée entre-temps.");
        await gateway.editAutomodRule(g, target, payload, ctx.reason);
        return { status: "succeeded", detail: "Règle AutoMod mise à jour.", map: [{ localId, discordId: target, kind: "automod", origin: "adopted" }] };
      }
      if (resumed) {
        await refresh(ctx);
        const found = reconcile(ctx, ctx.state.automodRules ?? [], rule.name, step.startedAt);
        if (found) return { status: "succeeded", detail: "Retrouvée après interruption.", map: [{ localId, discordId: found.id, kind: "automod" }] };
      }
      const { id } = await gateway.createAutomodRule(g, payload, ctx.reason);
      return { status: "succeeded", detail: "Règle AutoMod créée.", map: [{ localId, discordId: id, kind: "automod" }] };
    }

    /* ---------------------- Onboarding & écran d’accueil --------------------- */
    case "onboarding.put": {
      await refresh(ctx);
      if (!ctx.state.features.includes("COMMUNITY")) fail("La Communauté n’est pas active : l’onboarding ne peut pas être configuré.");
      const existingIds = new Map((ctx.state.onboarding?.prompts ?? []).map((p) => [lower(p.title), p.id]));
      let n = 0;
      const payload = onboardingPayload(spec, ctx.resolver, (seed) => {
        const prompt = spec.onboarding!.prompts.find((p) => p.id === seed);
        const reuse = prompt ? existingIds.get(lower(prompt.title)) : undefined;
        return reuse ?? ((BigInt(Date.now() - 1420070400000) << 22n) + BigInt(n++)).toString();
      });
      await gateway.putOnboarding(g, payload, ctx.reason);
      return { status: "succeeded", detail: `Onboarding configuré (${payload.prompts.length} question(s)).`, map: [{ localId: "__onboarding", discordId: g, kind: "onboarding" }] };
    }
    case "welcome.put": {
      if (!ctx.state.features.includes("COMMUNITY")) fail("La Communauté n’est pas active : l’écran d’accueil ne peut pas être configuré.");
      await gateway.editWelcomeScreen(g, welcomeScreenPayload(spec, ctx.resolver), ctx.reason);
      return { status: "succeeded", detail: "Écran d’accueil configuré.", map: [{ localId: "__welcome", discordId: g, kind: "welcome" }] };
    }

    /* ------------------------ Fonctionnalités du bot ------------------------ */
    case "bot.features": {
      if (inst.dryRun) return { status: "skipped", detail: "Ignorée en mode simulation." };
      await syncGuildFeatures(ctx);
      return { status: "succeeded", detail: "Boutons, bienvenue, logs, tickets et suggestions actifs." };
    }

    /* ------------------- Restauration : republication ------------------- */
    case "message.republish":
      return republishMessages(ctx, step);
  }
  return fail(`Type d’étape inconnu : ${step.kind}`);
}

/* -------------------------------------------------------------------------- */

function computeRolePositions(ctx: Ctx): Array<{ id: string; position: number }> {
  const { state } = ctx;
  const botTop = state.bot?.highestRolePosition ?? 0;
  const below = state.roles.filter((r) => r.id !== state.id && r.position < botTop).sort((a, b) => b.position - a.position || (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  const ours = ctx.spec.roles.map((r) => ctx.mapping.get(r.id)).filter((id): id is string => !!id && below.some((b) => b.id === id));
  const others = below.filter((r) => !ours.includes(r.id) && !r.managed).map((r) => r.id);
  const managedBelow = below.filter((r) => r.managed && !ours.includes(r.id)).map((r) => r.id);
  const order = [...managedBelow, ...ours, ...others];
  const out: Array<{ id: string; position: number }> = [];
  order.forEach((id, i) => {
    const position = order.length - i;
    const current = state.roles.find((r) => r.id === id)!;
    if (current.position !== position) out.push({ id, position });
  });
  return out;
}

function computeChannelPositions(ctx: Ctx) {
  const { state, spec } = ctx;
  const out: Array<{ id: string; position: number; parent_id?: string | null }> = [];
  const archiveIds = new Set([...ctx.mapping.entries()].filter(([k]) => k.startsWith("__archive")).map(([, v]) => v));
  const specCats = spec.categories.map((c) => ctx.mapping.get(c.id)).filter((x): x is string => !!x);
  const otherCats = state.channels
    .filter((c) => c.type === 4 && !specCats.includes(c.id) && !archiveIds.has(c.id))
    .sort((a, b) => a.position - b.position)
    .map((c) => c.id);
  const catOrder = [...specCats, ...otherCats, ...archiveIds];
  catOrder.forEach((id, i) => {
    const c = state.channels.find((x) => x.id === id);
    if (c && c.position !== i) out.push({ id, position: i });
  });
  const place = (localChannels: { id: string }[], parentLocal: string | null) => {
    const parentId = parentLocal ? ctx.mapping.get(parentLocal) ?? null : null;
    const mapped = localChannels.map((c) => ctx.mapping.get(c.id)).filter((x): x is string => !!x);
    const extra = state.channels
      .filter((c) => c.type !== 4 && c.parentId === parentId && !mapped.includes(c.id))
      .sort((a, b) => a.position - b.position)
      .map((c) => c.id);
    [...mapped, ...extra].forEach((id, i) => {
      const c = state.channels.find((x) => x.id === id);
      if (c && (c.position !== i || c.parentId !== parentId)) out.push({ id, position: i, parent_id: parentId });
    });
  };
  place(spec.uncategorized, null);
  spec.categories.forEach((cat) => place(cat.channels, cat.id));
  return out;
}

function archiveOverwrites(ctx: Ctx) {
  const deny = toBitfield(["VIEW_CHANNEL", "SEND_MESSAGES", "CONNECT"]).toString();
  return [{ id: ctx.inst.guildId, type: 0 as const, allow: "0", deny }, ...(ctx.botOverwrite ? [ctx.botOverwrite] : [])];
}

async function createArchiveCategory(ctx: Ctx, name: string) {
  const { id } = await ctx.gateway.createChannel(ctx.inst.guildId, { name, type: 4, permission_overwrites: archiveOverwrites(ctx) }, `${ctx.reason} (archives)`);
  ctx.state.channels.push({ id, name, type: 4, parentId: null, position: 999, permissionOverwrites: [] });
  return id;
}

async function ensureArchiveCategory(ctx: Ctx, startedAt: Date, resumed: boolean) {
  const mapped = ctx.mapping.get("__archive");
  if (mapped && ctx.state.channels.some((c) => c.id === mapped)) return mapped;
  if (resumed) {
    await refresh(ctx);
    const found = reconcile(ctx, ctx.state.channels, "📦 Archives", startedAt, (c) => c.type === 4);
    if (found) return found.id;
  }
  return createArchiveCategory(ctx, "📦 Archives");
}

/** Enregistre la configuration (en identifiants Discord) utilisée par le bot pour ses boutons et événements. */
async function syncGuildFeatures(ctx: Ctx) {
  const { spec, resolver } = ctx;
  const f = spec.features;
  const ch = (id?: string) => (id ? resolver.channel(id) : null);
  const role = (id: string) => resolver.role(id);
  const selfRoleIds = spec.messages.flatMap((m) => m.buttons.filter((b) => b.action === "role-toggle").map((b) => role((b as { roleId: string }).roleId))).filter((x): x is string => !!x);
  const rulesRoleIds = spec.messages.flatMap((m) => m.buttons.filter((b) => b.action === "rules-accept").map((b) => role((b as { roleId: string }).roleId))).filter((x): x is string => !!x);
  const db = getDb();
  const [current] = await db.select().from(guildFeatures).where(eq(guildFeatures.guildId, ctx.inst.guildId));
  const prev = current?.config ?? {};
  const config = {
    ...prev,
    welcome: f.welcome?.enabled && ch(f.welcome.channelId) ? { channelId: ch(f.welcome.channelId)!, message: f.welcome.message } : prev.welcome,
    joinLogs: f.joinLogs?.enabled && ch(f.joinLogs.channelId) ? { channelId: ch(f.joinLogs.channelId)! } : prev.joinLogs,
    tickets:
      f.tickets?.enabled && ch(f.tickets.channelId)
        ? { channelId: ch(f.tickets.channelId)!, staffRoleIds: f.tickets.staffRoleIds.map(role).filter((x): x is string => !!x), intro: f.tickets.intro }
        : prev.tickets,
    suggestions: f.suggestions?.enabled && ch(f.suggestions.channelId) ? { channelId: ch(f.suggestions.channelId)! } : prev.suggestions,
    selfRoleIds: [...new Set([...(prev.selfRoleIds ?? []), ...selfRoleIds])],
    rulesRoleIds: [...new Set([...(prev.rulesRoleIds ?? []), ...rulesRoleIds])],
    // Jetons {#salon} {@role} du message de bienvenue résolus à l’installation.
    tokens: Object.fromEntries([...ctx.mapping.entries()].filter(([k]) => !k.startsWith("__"))),
  };
  await db
    .insert(guildFeatures)
    .values({ guildId: ctx.inst.guildId, config, installationId: ctx.inst.id })
    .onConflictDoUpdate({ target: guildFeatures.guildId, set: { config, installationId: ctx.inst.id, updatedAt: new Date() } });
}

async function republishMessages(ctx: Ctx, step: StepRow): Promise<StepOutcome> {
  const db = getDb();
  const originalChannelId = step.key.split(":")[1]!;
  const channelId = ctx.mapping.get(`c-${originalChannelId}`) ?? fail("Le salon de destination n’existe pas.");
  const rows = await db
    .select()
    .from(backupMessages)
    .where(and(eq(backupMessages.backupId, ctx.inst.backupId!), eq(backupMessages.channelId, originalChannelId)))
    .orderBy(asc(backupMessages.sentAt));
  const done = Number(/^(\d+)\//.exec(step.detail ?? "")?.[1] ?? 0);
  if (done >= rows.length) return { status: "skipped", detail: `${rows.length}/${rows.length} messages déjà republiés.` };
  const hook = await ctx.gateway.createWebhook(channelId, "Make Your Server — archives", ctx.reason);
  try {
    let count = done;
    for (const m of rows.slice(done)) {
      const date = m.sentAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });
      const attachments = m.attachments.map((a) => a.url).join("\n");
      const body = `-# Republié depuis une sauvegarde — message d’origine du ${date}\n${m.content}${attachments ? `\n${attachments}` : ""}`.slice(0, 2000);
      await ctx.gateway.executeWebhook(hook.id, hook.token, {
        username: `${m.authorName}`.slice(0, 80),
        avatar_url: m.authorAvatar ?? undefined,
        content: body,
        embeds: (m.embeds as object[]).slice(0, 10),
        allowed_mentions: { parse: [] },
      });
      count++;
      await db.update(installationSteps).set({ detail: `${count}/${rows.length} messages republiés` }).where(eq(installationSteps.id, step.id));
    }
    return { status: "succeeded", detail: `${rows.length}/${rows.length} messages republiés (auteurs, dates et identifiants d’origine non restaurables).` };
  } finally {
    await ctx.gateway.deleteWebhook(hook.id, ctx.reason).catch(() => {});
  }
}

