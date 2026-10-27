import {
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  Routes,
  type AutocompleteInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
} from "discord.js";
import { MODE_LABELS, type Plan } from "@mys/core";
import { and, backups, desc, eq, getDb, ilike, inArray, installations, logError, projects, users } from "@mys/db";
import {
  AccessDeniedError,
  BotMissingError,
  InstallError,
  QuotaError,
  cancelInstallation,
  confirmInstallation,
  getInstallationWithSteps,
  prepareInstallation,
  type GuildGateway,
} from "@mys/engine";
import { COLORS, LOGIN_REQUIRED, brandEmbed, errorEmbed, progressBar, row, siteButton } from "../ui";

export async function findUser(discordId: string) {
  const [u] = await getDb().select().from(users).where(eq(users.discordId, discordId));
  return u ?? null;
}

export function explainError(e: unknown): string {
  if (e instanceof AccessDeniedError || e instanceof BotMissingError || e instanceof InstallError || e instanceof QuotaError) return e.message;
  void logError("bot", "Erreur inattendue", { error: e });
  return "Une erreur inattendue est survenue. L’équipe a été prévenue ; réessayez dans un instant.";
}

/* ------------------------------ Autocomplétion ----------------------------- */

export async function autocompleteProjects(i: AutocompleteInteraction) {
  const user = await findUser(i.user.id);
  if (!user) return i.respond([]);
  const q = String(i.options.getFocused() ?? "");
  const rows = await getDb()
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(eq(projects.userId, user.id), q ? ilike(projects.name, `%${q}%`) : undefined))
    .orderBy(desc(projects.updatedAt))
    .limit(25);
  await i.respond(rows.map((r) => ({ name: r.name.slice(0, 100), value: r.id })));
}

export async function autocompleteBackups(i: AutocompleteInteraction) {
  const user = await findUser(i.user.id);
  if (!user || !i.guildId) return i.respond([]);
  const rows = await getDb()
    .select({ id: backups.id, label: backups.label, version: backups.version, createdAt: backups.createdAt })
    .from(backups)
    .where(and(eq(backups.userId, user.id), eq(backups.guildId, i.guildId)))
    .orderBy(desc(backups.createdAt))
    .limit(25);
  await i.respond(rows.map((r) => ({ name: `n°${r.version} — ${r.label ?? ""}`.slice(0, 100), value: r.id })));
}

/* ------------------------------- Plan (aperçu) ------------------------------ */

export function planEmbed(title: string, plan: Plan, dryRun: boolean) {
  const s = plan.summary;
  const e = brandEmbed(title, `Mode : **${MODE_LABELS[plan.mode]}**${dryRun ? " — **simulation** (aucune modification réelle)" : ""}\nServeur : **${plan.guildName}**`);
  e.addFields(
    { name: "Créations", value: String(s.create), inline: true },
    { name: "Modifications", value: String(s.update), inline: true },
    { name: "Messages", value: String(s.messages), inline: true },
    { name: "Archivages", value: String(s.archive), inline: true },
    { name: "Suppressions", value: String(s.delete), inline: true },
    { name: "Existant conservé", value: String(s.existingKept), inline: true },
  );
  if (plan.conflicts.length) {
    const labels = { reuse: "réutilisé tel quel", update: "réutilisé et mis à jour", create: "nouvel élément créé" };
    e.addFields({
      name: `Éléments déjà présents (${plan.conflicts.length})`,
      value: plan.conflicts
        .slice(0, 6)
        .map((c) => `• « ${c.existingName} » → ${labels[c.resolution]}`)
        .join("\n")
        .concat(plan.conflicts.length > 6 ? `\n… et ${plan.conflicts.length - 6} autre(s)` : ""),
    });
  }
  if (plan.blockers.length) {
    e.setColor(COLORS.danger).addFields({ name: "⛔ À corriger avant d’installer", value: plan.blockers.slice(0, 4).map((b) => `• ${b.message}`).join("\n").slice(0, 1024) });
  }
  if (plan.warnings.length) {
    e.addFields({ name: "⚠️ À savoir", value: plan.warnings.slice(0, 4).map((w) => `• ${w.message}`).join("\n").slice(0, 1024) });
  }
  if (plan.manualSteps.length) {
    e.addFields({ name: "🧭 Étapes à terminer vous-même (guidées sur le site)", value: plan.manualSteps.map((m) => `• ${m.title}`).join("\n").slice(0, 1024) });
  }
  return e;
}

function planComponents(installationId: string, plan: Plan) {
  const destructive = plan.ops.some((o) => o.destructive);
  const confirm = new ButtonBuilder()
    .setCustomId(`mys:ic:${installationId}`)
    .setStyle(ButtonStyle.Success)
    .setLabel(destructive ? "Confirmer sur le site" : "Lancer l’installation")
    .setDisabled(plan.blockers.length > 0 || destructive);
  const cancel = new ButtonBuilder().setCustomId(`mys:ix:${installationId}`).setStyle(ButtonStyle.Secondary).setLabel("Abandonner");
  return [row(confirm, cancel, siteButton("Voir le détail", `/installations/${installationId}`))];
}

/* --------------------------------- Commandes -------------------------------- */

export async function handleInstall(i: ChatInputCommandInteraction, gateway: GuildGateway) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const user = await findUser(i.user.id);
  if (!user) return i.editReply({ embeds: [errorEmbed(LOGIN_REQUIRED)], components: [row(siteButton("Se connecter", "/connexion"))] });
  try {
    const projectId = i.options.getString("projet", true);
    const mode = (i.options.getString("mode") ?? "merge") as "merge" | "empty";
    const dryRun = i.options.getBoolean("simulation") ?? false;
    const { installation, plan } = await prepareInstallation(gateway, {
      userId: user.id,
      guildId: i.guildId!,
      source: { projectId },
      options: { mode },
      dryRun,
      origin: "discord",
    });
    const embed = planEmbed(`Analyse avant installation`, plan, dryRun);
    if (plan.ops.some((o) => o.destructive)) {
      embed.addFields({ name: "Confirmation requise", value: "Ce plan remplace une configuration existante. Pour votre sécurité, confirmez-le sur le site où chaque modification est détaillée." });
    }
    await i.editReply({ embeds: [embed], components: planComponents(installation.id, plan) });
  } catch (e) {
    await i.editReply({ embeds: [errorEmbed(explainError(e))], components: e instanceof BotMissingError ? [row(siteButton("Inviter le bot", `/serveurs`))] : [] });
  }
}

export async function handleRestore(i: ChatInputCommandInteraction, gateway: GuildGateway) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const user = await findUser(i.user.id);
  if (!user) return i.editReply({ embeds: [errorEmbed(LOGIN_REQUIRED)], components: [row(siteButton("Se connecter", "/connexion"))] });
  try {
    const backupId = i.options.getString("sauvegarde", true);
    const { installation, plan } = await prepareInstallation(gateway, { userId: user.id, guildId: i.guildId!, source: { backupId }, options: { mode: "merge" }, origin: "discord" });
    const embed = planEmbed("Analyse avant restauration", plan, false);
    embed.addFields({
      name: "Portée de la restauration",
      value:
        "Les éléments encore présents sont remis dans l’état de la sauvegarde ; les éléments disparus sont recréés avec de **nouveaux identifiants**. Rien n’est supprimé. L’historique des messages des salons supprimés n’est pas récupérable (sauf export Premium, republié et signalé comme tel).",
    });
    await i.editReply({ embeds: [embed], components: planComponents(installation.id, plan) });
  } catch (e) {
    await i.editReply({ embeds: [errorEmbed(explainError(e))] });
  }
}

export async function handleConfirmButton(i: ButtonInteraction, gateway: GuildGateway, installationId: string) {
  const user = await findUser(i.user.id);
  if (!user) return i.reply({ embeds: [errorEmbed(LOGIN_REQUIRED)], flags: MessageFlags.Ephemeral });
  await i.deferUpdate();
  try {
    await confirmInstallation(gateway, {
      installationId,
      userId: user.id,
      confirmDestructive: false,
      discordFollowup: { applicationId: i.applicationId, token: i.token, expiresAt: new Date(Date.now() + 14 * 60_000).toISOString() },
    });
    await i.editReply(await renderProgress(installationId));
  } catch (e) {
    await i.editReply({ embeds: [errorEmbed(explainError(e))], components: [row(siteButton("Ouvrir sur le site", `/installations/${installationId}`))] });
  }
}

export async function handleAbandonButton(i: ButtonInteraction, installationId: string) {
  const user = await findUser(i.user.id);
  if (!user) return i.reply({ embeds: [errorEmbed(LOGIN_REQUIRED)], flags: MessageFlags.Ephemeral });
  try {
    await cancelInstallation(installationId, user.id);
    await i.update({ embeds: [brandEmbed("Installation abandonnée", "Aucune modification n’a été faite.", COLORS.night)], components: [] });
  } catch (e) {
    await i.reply({ embeds: [errorEmbed(explainError(e))], flags: MessageFlags.Ephemeral });
  }
}

async function latestInstallation(userId: string, guildId: string, statuses?: string[]) {
  const [inst] = await getDb()
    .select({ id: installations.id })
    .from(installations)
    .where(and(eq(installations.userId, userId), eq(installations.guildId, guildId), statuses ? inArray(installations.status, statuses) : undefined))
    .orderBy(desc(installations.createdAt))
    .limit(1);
  return inst ?? null;
}

export async function handleStatus(i: ChatInputCommandInteraction | ButtonInteraction) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const user = await findUser(i.user.id);
  if (!user) return i.editReply({ embeds: [errorEmbed(LOGIN_REQUIRED)] });
  const inst = await latestInstallation(user.id, i.guildId!);
  if (!inst) return i.editReply({ embeds: [brandEmbed("Aucune installation", "Vous n’avez lancé aucune installation sur ce serveur.")] });
  await i.editReply(await renderProgress(inst.id));
}

export async function handleCancel(i: ChatInputCommandInteraction) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const user = await findUser(i.user.id);
  if (!user) return i.editReply({ embeds: [errorEmbed(LOGIN_REQUIRED)] });
  const inst = await latestInstallation(user.id, i.guildId!, ["planned", "queued", "running"]);
  if (!inst) return i.editReply({ embeds: [brandEmbed("Rien à annuler", "Aucune installation en cours sur ce serveur.")] });
  try {
    await cancelInstallation(inst.id, user.id);
    await i.editReply({
      embeds: [brandEmbed("Annulation demandée", "Les étapes déjà terminées restent en place ; les suivantes ne seront pas exécutées. Une sauvegarde de sécurité a été prise avant le début.", COLORS.warning)],
      components: [row(siteButton("Voir le suivi", `/installations/${inst.id}`))],
    });
  } catch (e) {
    await i.editReply({ embeds: [errorEmbed(explainError(e))] });
  }
}

/* ---------------------------- Suivi de progression --------------------------- */

const ICON: Record<string, string> = { succeeded: "✅", skipped: "⏭️", failed: "❌", running: "⏳", pending: "▫️", cancelled: "🚫" };
const STATUS_TITLE: Record<string, [string, number]> = {
  planned: ["En attente de confirmation", COLORS.periwinkle],
  queued: ["Installation en file d’attente…", COLORS.periwinkle],
  running: ["Installation en cours…", COLORS.blue],
  succeeded: ["Installation terminée ✅", COLORS.success],
  partial: ["Installation partielle ⚠️", COLORS.warning],
  failed: ["Installation échouée ❌", COLORS.danger],
  cancelled: ["Installation annulée", COLORS.night],
};

export async function renderProgress(installationId: string) {
  const data = await getInstallationWithSteps(installationId);
  if (!data) return { embeds: [errorEmbed("Installation introuvable.")], components: [] };
  const { installation: inst, steps } = data;
  const done = steps.filter((s) => ["succeeded", "skipped"].includes(s.status)).length;
  const failed = steps.filter((s) => s.status === "failed");
  const [title, color] = STATUS_TITLE[inst.status] ?? ["Installation", COLORS.blue];
  const current = steps.find((s) => s.status === "running") ?? steps.find((s) => s.status === "pending");
  const e = brandEmbed(`${inst.dryRun ? "[Simulation] " : ""}${inst.kind === "restore" ? title.replace("Installation", "Restauration") : title}`, undefined, color);
  e.setDescription(
    [
      `**${inst.guildName}**`,
      `\`${progressBar(done, steps.length)}\` ${done}/${steps.length} étapes`,
      current && ["running", "queued"].includes(inst.status) ? `En cours : ${current.label}` : "",
      inst.error ? `\n${inst.error}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  const recent = steps
    .filter((s) => s.status !== "pending")
    .slice(-8)
    .map((s) => `${ICON[s.status] ?? "•"} ${s.label}`.slice(0, 110));
  if (recent.length) e.addFields({ name: "Dernières étapes", value: recent.join("\n").slice(0, 1024) });
  if (failed.length) e.addFields({ name: `Étapes en échec (${failed.length})`, value: failed.slice(0, 5).map((s) => `❌ ${s.label}\n   ↳ ${s.error ?? ""}`.slice(0, 200)).join("\n").slice(0, 1024) });
  if (inst.status === "partial") e.addFields({ name: "Que faire ?", value: "Corrigez la cause indiquée (souvent une permission du bot) puis relancez depuis le site : seules les étapes en échec seront rejouées, sans doublon." });
  const components = [row(siteButton("Suivi détaillé", `/installations/${inst.id}`))];
  return { embeds: [e], components };
}

const lastUpdate = new Map<string, number>();

/** Met à jour le message de suivi dans Discord (jeton d’interaction valable 15 minutes). */
export async function updateFollowup(client: Client, installationId: string) {
  const [inst] = await getDb().select().from(installations).where(eq(installations.id, installationId));
  const f = inst?.discordFollowup;
  if (!inst || !f || new Date(f.expiresAt).getTime() < Date.now()) return;
  const final = ["succeeded", "partial", "failed", "cancelled"].includes(inst.status);
  const last = lastUpdate.get(installationId) ?? 0;
  if (!final && Date.now() - last < 2_000) return;
  lastUpdate.set(installationId, Date.now());
  if (final) lastUpdate.delete(installationId);
  const payload = await renderProgress(installationId);
  await client.rest
    .patch(Routes.webhookMessage(f.applicationId, f.token, "@original"), { body: { embeds: payload.embeds.map((x) => x.toJSON()), components: payload.components.map((c) => c.toJSON()) }, auth: false })
    .catch(() => {});
}

