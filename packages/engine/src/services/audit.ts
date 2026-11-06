import { auditGuild, buildAuditFixProject, type AuditReport, type GuildState } from "@mys/core";
import { and, audit, desc, eq, getDb, resourceMappings, serverAudits, users } from "@mys/db";
import { translateDiscordError, type GuildGateway } from "../gateway";
import { AccessDeniedError, assertGuildAccess, BotMissingError } from "./access";

export interface ServerAuditResult {
  id: string;
  guildId: string;
  guildName: string;
  score: number;
  report: AuditReport;
  createdAt: Date;
}

async function loadAuditUser(userId: string) {
  const [user] = await getDb().select().from(users).where(eq(users.id, userId));
  if (!user) throw new AccessDeniedError("Compte introuvable.");
  if (user.suspendedAt) throw new AccessDeniedError("Votre compte est suspendu.");
  return user;
}

/** Lecture de l’état réel du serveur, avec les mêmes contrôles que l’installation. */
async function readGuildState(gateway: GuildGateway, guildId: string): Promise<GuildState> {
  try {
    const state = await gateway.fetchState(guildId);
    if (!state.bot) throw new BotMissingError(guildId);
    return state;
  } catch (e) {
    if (e instanceof BotMissingError) throw e;
    const err = translateDiscordError(e);
    if (err.status === 403 || err.status === 404) throw new BotMissingError(guildId);
    throw err;
  }
}

/**
 * Analyse « Santé du serveur » : revérifie les droits de l’utilisateur via le bot
 * (« Gérer le serveur »), lit l’état réel, calcule le rapport et l’enregistre.
 * Aucune modification n’est faite sur Discord.
 */
export async function runServerAudit(gateway: GuildGateway, input: { userId: string; guildId: string }): Promise<ServerAuditResult> {
  const user = await loadAuditUser(input.userId);
  await assertGuildAccess(gateway, input.guildId, user.discordId, "manage");
  const state = await readGuildState(gateway, input.guildId);
  const report = auditGuild(state);
  const [row] = await getDb()
    .insert(serverAudits)
    .values({ userId: user.id, guildId: state.id, guildName: state.name, score: report.score, report })
    .returning();
  await audit({
    actorUserId: user.id,
    actorType: "user",
    action: "guild.audit",
    targetType: "guild",
    targetId: state.id,
    guildId: state.id,
    metadata: { score: report.score, grade: report.grade, issues: report.issues.length },
  });
  return { id: row!.id, guildId: row!.guildId, guildName: row!.guildName, score: row!.score, report, createdAt: row!.createdAt };
}

/** Dernière analyse enregistrée par cet utilisateur pour ce serveur (ou null). */
export async function latestServerAudit(userId: string, guildId: string): Promise<ServerAuditResult | null> {
  const [row] = await getDb()
    .select()
    .from(serverAudits)
    .where(and(eq(serverAudits.userId, userId), eq(serverAudits.guildId, guildId)))
    .orderBy(desc(serverAudits.createdAt))
    .limit(1);
  if (!row) return null;
  return { id: row.id, guildId: row.guildId, guildName: row.guildName, score: row.score, report: row.report as AuditReport, createdAt: row.createdAt };
}

/** Dernières notes de l’utilisateur, par serveur (pour la liste des serveurs). */
export async function latestServerScores(userId: string): Promise<Map<string, { score: number; createdAt: Date }>> {
  const rows = await getDb()
    .select({ guildId: serverAudits.guildId, score: serverAudits.score, createdAt: serverAudits.createdAt })
    .from(serverAudits)
    .where(eq(serverAudits.userId, userId))
    .orderBy(desc(serverAudits.createdAt))
    .limit(500);
  const out = new Map<string, { score: number; createdAt: Date }>();
  for (const r of rows) if (!out.has(r.guildId)) out.set(r.guildId, { score: r.score, createdAt: r.createdAt });
  return out;
}

export class AuditFixError extends Error {
  readonly status = 422;
  constructor(message: string) {
    super(message);
    this.name = "AuditFixError";
  }
}

/**
 * Prépare les correctifs choisis : revérifie les droits, relit l’état ACTUEL du
 * serveur et renvoie un projet prêt à installer en mode fusion (avec les
 * correspondances vers les éléments existants, pour les mettre à jour sans doublon).
 * L’installation elle-même passe par l’assistant habituel (analyse, sauvegarde
 * de sécurité, confirmation).
 */
export async function prepareAuditFixes(gateway: GuildGateway, input: { userId: string; guildId: string; fixIds: string[] }) {
  const user = await loadAuditUser(input.userId);
  await assertGuildAccess(gateway, input.guildId, user.discordId, "manage");
  const state = await readGuildState(gateway, input.guildId);
  const project = buildAuditFixProject(state, input.fixIds);
  if (!project.applied.length) throw new AuditFixError("Sélectionnez au moins un correctif.");
  if (project.errors.length) {
    const needsEveryone = project.errors.some((e) => e.code === "everyone-dangerous");
    throw new AuditFixError(
      needsEveryone
        ? "@everyone possède des permissions sensibles : l’installation serait refusée tant qu’elles ne sont pas retirées. Cochez aussi « Retirer les permissions sensibles de @everyone »."
        : `La configuration actuelle du serveur contient un point que l’installation refuserait : ${project.errors
            .slice(0, 2)
            .map((e) => e.message)
            .join(" ")} Corrigez-le dans Discord, puis relancez l’analyse.`,
    );
  }
  return { state, ...project };
}

/** Enregistre les correspondances du projet de correctifs (portée du projet, sur ce serveur). */
export async function saveAuditFixMapping(guildId: string, projectId: string, mapping: Record<string, string>) {
  const kindOf = (localId: string) => (localId.startsWith("r-") ? "role" : localId.startsWith("k-") ? "category" : localId.startsWith("a-") ? "automod" : "channel");
  const rows = Object.entries(mapping).map(([localId, discordId]) => ({
    guildId,
    scopeId: `project:${projectId}`,
    localId,
    discordId,
    kind: kindOf(localId),
    origin: "adopted",
  }));
  if (!rows.length) return;
  const db = getDb();
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(resourceMappings).values(rows.slice(i, i + 500)).onConflictDoNothing();
  }
}
