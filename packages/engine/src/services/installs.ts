import { backupToSpec, buildPlan, type GuildState, type Plan, type PlanOp, type PlanOptions, type ServerSpec } from "@mys/core";
import {
  and,
  audit,
  backupMessages,
  backups,
  cancelJobsByDedupe,
  desc,
  enqueueJob,
  eq,
  getDb,
  getSetting,
  inArray,
  installationSteps,
  installations,
  projects,
  resourceMappings,
  sql,
  users,
} from "@mys/db";
import { translateDiscordError, type GuildGateway } from "../gateway";
import { assertGuildAccess, BotMissingError } from "./access";
import { getEntitlement } from "./quotas";
import { QuotaError } from "./backups";

export class InstallError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "InstallError";
  }
}

export type InstallOptions = PlanOptions & {
  /** Restauration : salons dont les messages exportés sont republiés (identifiants d’origine). */
  republishChannelIds?: string[];
};

export interface PrepareInput {
  userId: string;
  guildId: string;
  source: { projectId: string } | { backupId: string };
  options: InstallOptions;
  dryRun?: boolean;
  origin?: "web" | "discord";
}

export const JOB_INSTALL = "installation.run";

async function loadUser(userId: string) {
  const [user] = await getDb().select().from(users).where(eq(users.id, userId));
  if (!user) throw new InstallError("Compte introuvable.", 401);
  if (user.suspendedAt) throw new InstallError("Votre compte est suspendu. Contactez l’équipe Make Your Server.", 403);
  return user;
}

async function fetchStateOrExplain(gateway: GuildGateway, guildId: string): Promise<GuildState> {
  try {
    const state = await gateway.fetchState(guildId);
    if (!state.bot) throw new BotMissingError(guildId);
    return state;
  } catch (e) {
    if (e instanceof BotMissingError) throw e;
    const err = translateDiscordError(e);
    if (err.status === 403 || err.status === 404) throw new BotMissingError(guildId);
    throw new InstallError(err.message, 502);
  }
}

interface Source {
  spec: ServerSpec;
  scopeId: string;
  kind: "install" | "restore";
  projectId?: string;
  backupId?: string;
  extraMapping: Record<string, string>;
}

async function loadSource(userId: string, source: PrepareInput["source"], guildId: string): Promise<Source> {
  const db = getDb();
  if ("projectId" in source) {
    const [project] = await db.select().from(projects).where(and(eq(projects.id, source.projectId), eq(projects.userId, userId)));
    if (!project) throw new InstallError("Projet introuvable.", 404);
    return { spec: project.spec, scopeId: `project:${project.id}`, kind: "install", projectId: project.id, extraMapping: {} };
  }
  const [backup] = await db.select().from(backups).where(and(eq(backups.id, source.backupId), eq(backups.userId, userId)));
  if (!backup) throw new InstallError("Sauvegarde introuvable.", 404);
  if (backup.guildId !== guildId) {
    // Restaurer sur un autre serveur revient à « installer une copie » : pas de correspondances d’origine.
    const conv = backupToSpec(backup.snapshot);
    return { spec: conv.spec, scopeId: `backup:${backup.id}:${guildId}`, kind: "restore", backupId: backup.id, extraMapping: {} };
  }
  const conv = backupToSpec(backup.snapshot);
  return { spec: conv.spec, scopeId: `backup:${backup.id}`, kind: "restore", backupId: backup.id, extraMapping: conv.mapping };
}

async function loadMapping(guildId: string, scopeId: string, extra: Record<string, string>) {
  const rows = await getDb()
    .select()
    .from(resourceMappings)
    .where(and(eq(resourceMappings.guildId, guildId), eq(resourceMappings.scopeId, scopeId)));
  return { ...extra, ...Object.fromEntries(rows.map((r) => [r.localId, r.discordId])) };
}

function addRestoreOps(plan: Plan, state: GuildState, spec: ServerSpec, options: InstallOptions, messageCounts: Map<string, number>) {
  for (const original of options.republishChannelIds ?? []) {
    const localId = `c-${original}`;
    const count = messageCounts.get(original) ?? 0;
    if (!count) continue;
    const exists = spec.categories.some((c) => c.channels.some((x) => x.id === localId)) || spec.uncategorized.some((x) => x.id === localId);
    if (!exists) continue;
    const name = state.channels.find((c) => c.id === original)?.name ?? spec.categories.flatMap((c) => c.channels).find((c) => c.id === localId)?.name ?? original;
    const op: PlanOp = {
      key: `message.republish:${original}`,
      kind: "message.republish",
      phase: 15,
      label: `Republier ${count} message(s) exporté(s) dans #${name} (republication, pas une restauration à l’identique)`,
      impact: "create",
      destructive: false,
      localId,
      optional: true,
    };
    plan.ops.push(op);
    plan.summary.messages += 1;
  }
}

/**
 * Étape 1 : analyse. Vérifie les droits, lit l’état réel du serveur, calcule
 * le plan (créations, modifications, suppressions, conflits) sans rien modifier.
 */
export async function prepareInstallation(gateway: GuildGateway, input: PrepareInput) {
  const db = getDb();
  const maintenance = await getSetting("maintenance");
  if (maintenance.blockInstalls) throw new InstallError(maintenance.message || "Les installations sont temporairement suspendues.", 503);
  const user = await loadUser(input.userId);
  await assertGuildAccess(gateway, input.guildId, user.discordId, "manage");

  const src = await loadSource(user.id, input.source, input.guildId);
  if (src.kind === "restore" && input.options.mode === "targeted") {
    const ent = await getEntitlement(user.id);
    if (!ent.quotas.selectiveRestore) throw new QuotaError("La restauration sélective est réservée au Premium. Vous pouvez restaurer l’ensemble de la sauvegarde.");
  }
  if (src.kind === "restore" && input.options.republishChannelIds?.length) {
    const ent = await getEntitlement(user.id);
    if (!ent.quotas.messageBackupChannels) throw new QuotaError("La republication de messages est réservée au Premium.");
  }
  const state = await fetchStateOrExplain(gateway, input.guildId);
  const mapping = await loadMapping(input.guildId, src.scopeId, src.extraMapping);
  const plan = buildPlan({ spec: src.spec, state, mapping, options: input.options });

  if (src.kind === "restore" && src.backupId) {
    const counts = await db
      .select({ channelId: backupMessages.channelId, n: sql<number>`count(*)::int` })
      .from(backupMessages)
      .where(eq(backupMessages.backupId, src.backupId))
      .groupBy(backupMessages.channelId);
    addRestoreOps(plan, state, src.spec, input.options, new Map(counts.map((c) => [c.channelId, c.n])));
  }

  const [inst] = await db
    .insert(installations)
    .values({
      userId: user.id,
      guildId: input.guildId,
      guildName: state.name,
      kind: src.kind,
      projectId: src.projectId ?? null,
      backupId: src.backupId ?? null,
      // Simulation : correspondances isolées (copiées depuis la portée réelle à la confirmation).
      scopeId: input.dryRun ? `dryrun:${crypto.randomUUID()}|${src.scopeId}` : src.scopeId,
      spec: src.spec,
      options: input.options,
      plan,
      status: "planned",
      dryRun: !!input.dryRun,
      origin: input.origin ?? "web",
    })
    .returning();
  return { installation: inst!, plan };
}

/**
 * Étape 2 : confirmation explicite. Le plan est recalculé sur l’état réel du
 * moment ; toute nouvelle opération destructive exige une nouvelle confirmation.
 */
export async function confirmInstallation(
  gateway: GuildGateway,
  input: { installationId: string; userId: string; confirmDestructive: boolean; excluded?: string[]; discordFollowup?: { applicationId: string; token: string; expiresAt: string } },
) {
  const db = getDb();
  const user = await loadUser(input.userId);
  const [inst] = await db.select().from(installations).where(and(eq(installations.id, input.installationId), eq(installations.userId, user.id)));
  if (!inst) throw new InstallError("Installation introuvable.", 404);
  if (inst.status !== "planned") throw new InstallError("Cette installation a déjà été lancée.", 409);
  const maintenance = await getSetting("maintenance");
  if (maintenance.blockInstalls) throw new InstallError(maintenance.message, 503);

  const options: InstallOptions = { ...(inst.options as InstallOptions), excluded: input.excluded ?? inst.options.excluded };
  const state = await fetchStateOrExplain(gateway, inst.guildId);
  const realScope = inst.dryRun ? inst.scopeId.split("|")[1]! : inst.scopeId;
  const extra = inst.kind === "restore" && inst.backupId && realScope === `backup:${inst.backupId}` ? backupToSpec((await getBackupSnapshot(inst.backupId)) ?? state).mapping : {};
  const mapping = await loadMapping(inst.guildId, realScope, extra);
  const plan = buildPlan({ spec: inst.spec, state, mapping, options });
  if (inst.kind === "restore" && inst.backupId) {
    const counts = await db
      .select({ channelId: backupMessages.channelId, n: sql<number>`count(*)::int` })
      .from(backupMessages)
      .where(eq(backupMessages.backupId, inst.backupId))
      .groupBy(backupMessages.channelId);
    addRestoreOps(plan, state, inst.spec, options, new Map(counts.map((c) => [c.channelId, c.n])));
  }
  if (plan.blockers.length) throw new InstallError(`Installation impossible : ${plan.blockers[0]!.message}`, 409);

  const excluded = new Set(options.excluded ?? []);
  const ops = plan.ops.filter((o) => !(o.optional && excluded.has(o.key)));
  const destructive = ops.some((o) => o.destructive);
  if (destructive && !input.confirmDestructive) {
    throw new InstallError("Cette installation contient des opérations destructives : une confirmation explicite est nécessaire.", 428);
  }
  const needsAdmin = inst.kind === "restore" || destructive || ops.some((o) => o.kind === "community.enable");
  await assertGuildAccess(gateway, inst.guildId, user.discordId, needsAdmin ? "admin" : "manage");

  // Correspondances d’origine (restauration) ou copie pour la simulation : elles évitent
  // de dupliquer ce qui existe déjà.
  const seedMapping = inst.dryRun ? mapping : extra;
  if (Object.keys(seedMapping).length && (inst.dryRun || inst.scopeId.startsWith("backup:"))) {
    const rows = Object.entries(seedMapping)
      .filter(([, d]) => d === inst.guildId || state.roles.some((r) => r.id === d) || state.channels.some((c) => c.id === d) || state.automodRules?.some((a) => a.id === d))
      .map(([localId, discordId]) => ({ guildId: inst.guildId, scopeId: inst.scopeId, localId, discordId, kind: "original", origin: "adopted" }));
    if (rows.length) await db.insert(resourceMappings).values(rows).onConflictDoNothing();
  }

  await db.transaction(async (tx) => {
    await tx.delete(installationSteps).where(eq(installationSteps.installationId, inst.id));
    if (ops.length) {
      await tx.insert(installationSteps).values(
        ops.map((o, i) => ({
          installationId: inst.id,
          seq: i,
          key: o.key,
          kind: o.kind,
          label: o.label,
          localId: o.localId ?? null,
          targetId: o.targetId ?? null,
          destructive: o.destructive,
        })),
      );
    }
    await tx
      .update(installations)
      .set({
        plan: { ...plan, ops },
        options,
        status: "queued",
        confirmedDestructive: destructive && input.confirmDestructive,
        discordFollowup: input.discordFollowup ?? null,
      })
      .where(eq(installations.id, inst.id));
  });
  await enqueueJob(JOB_INSTALL, { installationId: inst.id }, { dedupeKey: `install:${inst.id}`, maxAttempts: 8 });
  await audit({
    actorUserId: user.id,
    actorType: "user",
    action: inst.dryRun ? "installation.simulate" : "installation.confirm",
    targetType: "installation",
    targetId: inst.id,
    guildId: inst.guildId,
    metadata: { mode: plan.mode, ops: ops.length, destructive, kind: inst.kind },
  });
  return { installationId: inst.id, steps: ops.length };
}

async function getBackupSnapshot(backupId: string) {
  const [b] = await getDb().select({ snapshot: backups.snapshot }).from(backups).where(eq(backups.id, backupId));
  return b?.snapshot ?? null;
}

/** Annulation : les étapes déjà faites restent faites ; les suivantes ne sont pas exécutées. */
export async function cancelInstallation(installationId: string, userId: string) {
  const db = getDb();
  const [inst] = await db.select().from(installations).where(and(eq(installations.id, installationId), eq(installations.userId, userId)));
  if (!inst) throw new InstallError("Installation introuvable.", 404);
  if (["succeeded", "partial", "failed", "cancelled"].includes(inst.status)) throw new InstallError("Cette installation est déjà terminée.", 409);
  if (inst.status === "planned") {
    await db.update(installations).set({ status: "cancelled", finishedAt: new Date(), error: "Annulée avant le lancement." }).where(eq(installations.id, inst.id));
  } else {
    await db.update(installations).set({ cancelRequested: true }).where(eq(installations.id, inst.id));
    if (inst.status === "queued") {
      await cancelJobsByDedupe(`install:${inst.id}`);
      await db.update(installationSteps).set({ status: "cancelled" }).where(and(eq(installationSteps.installationId, inst.id), eq(installationSteps.status, "pending")));
      await db.update(installations).set({ status: "cancelled", finishedAt: new Date(), error: "Annulée avant le début." }).where(eq(installations.id, inst.id));
    }
  }
  await audit({ actorUserId: userId, actorType: "user", action: "installation.cancel", targetType: "installation", targetId: inst.id, guildId: inst.guildId });
  return true;
}

/**
 * Relance d’une installation partielle ou échouée : seules les étapes en échec
 * sont rejouées ; les correspondances existantes empêchent tout doublon.
 */
export async function retryInstallation(installationId: string, userId: string) {
  const db = getDb();
  const [inst] = await db.select().from(installations).where(and(eq(installations.id, installationId), eq(installations.userId, userId)));
  if (!inst) throw new InstallError("Installation introuvable.", 404);
  if (!["partial", "failed"].includes(inst.status)) throw new InstallError("Seule une installation partielle ou échouée peut être relancée.", 409);
  await db
    .update(installationSteps)
    .set({ status: "pending", error: null, finishedAt: null })
    .where(and(eq(installationSteps.installationId, inst.id), inArray(installationSteps.status, ["failed", "cancelled"])));
  await db.update(installations).set({ status: "queued", error: null, finishedAt: null, cancelRequested: false }).where(eq(installations.id, inst.id));
  await enqueueJob(JOB_INSTALL, { installationId: inst.id }, { dedupeKey: `install:${inst.id}`, maxAttempts: 8 });
  await audit({ actorUserId: userId, actorType: "user", action: "installation.retry", targetType: "installation", targetId: inst.id, guildId: inst.guildId });
}

export async function getInstallationWithSteps(installationId: string, userId?: string) {
  const db = getDb();
  const [inst] = await db
    .select()
    .from(installations)
    .where(userId ? and(eq(installations.id, installationId), eq(installations.userId, userId)) : eq(installations.id, installationId));
  if (!inst) return null;
  const steps = await db.select().from(installationSteps).where(eq(installationSteps.installationId, inst.id)).orderBy(installationSteps.seq);
  return { installation: inst, steps };
}

export async function listInstallations(userId: string, limit = 50) {
  return getDb()
    .select({
      id: installations.id,
      guildId: installations.guildId,
      guildName: installations.guildName,
      kind: installations.kind,
      status: installations.status,
      dryRun: installations.dryRun,
      projectId: installations.projectId,
      backupId: installations.backupId,
      createdAt: installations.createdAt,
      finishedAt: installations.finishedAt,
      error: installations.error,
      mode: sql<string>`${installations.plan}->>'mode'`,
    })
    .from(installations)
    .where(eq(installations.userId, userId))
    .orderBy(desc(installations.createdAt))
    .limit(limit);
}
