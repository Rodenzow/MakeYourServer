import { DISCORD_CHANNEL_TYPE, type GuildState } from "@mys/core";
import { and, asc, audit, backupMessages, backups, desc, eq, getDb, inArray, sql } from "@mys/db";
import type { GuildGateway } from "../gateway";
import { getEntitlement } from "./quotas";

export type BackupKind = "safety" | "manual" | "scheduled";

export class QuotaError extends Error {
  readonly status = 402;
  constructor(message: string) {
    super(message);
    this.name = "QuotaError";
  }
}

/** Portée réelle d’une sauvegarde, affichée partout où elle est proposée. */
export const BACKUP_SCOPE_NOTE =
  "La sauvegarde contient la configuration accessible au bot : rôles, catégories, salons, permissions, réglages, règles AutoMod, onboarding et écran d’accueil. Elle ne contient ni les membres, ni les bannissements, ni les émojis, ni l’historique complet des messages. Une restauration recrée les éléments disparus avec de nouveaux identifiants : ce n’est pas une restauration à l’identique.";

export function summarizeState(state: GuildState): Record<string, number> {
  return {
    categories: state.channels.filter((c) => c.type === DISCORD_CHANNEL_TYPE.category).length,
    channels: state.channels.filter((c) => c.type !== DISCORD_CHANNEL_TYPE.category).length,
    roles: state.roles.filter((r) => r.id !== state.id && !r.managed).length,
    automod: state.automodRules?.length ?? 0,
    onboardingPrompts: state.onboarding?.prompts.length ?? 0,
  };
}

export interface CreateBackupInput {
  userId: string;
  guildId: string;
  kind: BackupKind;
  label?: string;
  installationId?: string;
  /** État déjà récupéré (évite une seconde lecture). */
  state?: GuildState;
  /** Premium : salons dont on exporte les derniers messages. */
  messageChannelIds?: string[];
}

export async function createBackup(gateway: GuildGateway, input: CreateBackupInput) {
  const db = getDb();
  const ent = await getEntitlement(input.userId);
  const q = ent.quotas;

  const channelIds = (input.messageChannelIds ?? []).slice(0, q.messageBackupChannels);
  if ((input.messageChannelIds?.length ?? 0) > 0 && q.messageBackupChannels === 0) {
    throw new QuotaError("La sauvegarde de messages est réservée au Premium.");
  }

  // Quotas et rotation
  const existing = await db
    .select({ id: backups.id, kind: backups.kind, createdAt: backups.createdAt })
    .from(backups)
    .where(and(eq(backups.userId, input.userId), eq(backups.guildId, input.guildId)))
    .orderBy(asc(backups.createdAt));
  const ofKind = (k: string[]) => existing.filter((b) => k.includes(b.kind));
  const toDelete: string[] = [];
  if (input.kind === "manual") {
    if (ofKind(["manual", "scheduled"]).length >= q.backupsPerGuild) {
      throw new QuotaError(
        `Limite atteinte : ${q.backupsPerGuild} sauvegarde(s) conservée(s) pour ce serveur avec votre offre. Supprimez une ancienne sauvegarde ou passez au Premium.`,
      );
    }
  } else if (input.kind === "scheduled") {
    const list = ofKind(["manual", "scheduled"]);
    const excess = list.length - q.backupsPerGuild + 1;
    // Rotation : on supprime les plus anciennes sauvegardes programmées.
    if (excess > 0) toDelete.push(...ofKind(["scheduled"]).slice(0, excess).map((b) => b.id));
  } else {
    const list = ofKind(["safety"]);
    const excess = list.length - q.safetyBackupsPerGuild + 1;
    if (excess > 0) toDelete.push(...list.slice(0, excess).map((b) => b.id));
  }

  const state = input.state ?? (await gateway.fetchState(input.guildId));
  const snapshot: GuildState = { ...state };
  delete snapshot.bot;

  const exported: Array<typeof backupMessages.$inferInsert> = [];
  // Sans l’intention privilégiée « Message Content » (portail développeur), Discord
  // renvoie le contenu des messages des membres vide : on le compte pour le signaler.
  let hidden = 0;
  for (const channelId of channelIds) {
    if (!state.channels.some((c) => c.id === channelId)) continue;
    let before: string | undefined;
    let remaining = q.messageBackupPerChannel;
    while (remaining > 0) {
      const batch = await gateway.listMessages(channelId, { limit: Math.min(100, remaining), before });
      if (!batch.length) break;
      for (const m of batch) {
        if (!m.authorIsBot && !m.content && !m.embeds.length && !m.attachments.length) {
          hidden++;
          continue;
        }
        exported.push({
          backupId: "",
          channelId,
          messageId: m.id,
          authorName: m.authorName,
          authorAvatar: m.authorAvatar,
          content: m.content,
          embeds: m.embeds,
          attachments: m.attachments,
          sentAt: new Date(m.timestamp),
        });
      }
      remaining -= batch.length;
      before = batch[batch.length - 1]!.id;
      if (batch.length < 100) break;
    }
  }

  const [{ max } = { max: 0 }] = await db
    .select({ max: sql<number>`coalesce(max(${backups.version}), 0)` })
    .from(backups)
    .where(and(eq(backups.userId, input.userId), eq(backups.guildId, input.guildId)));
  const json = JSON.stringify(snapshot);
  const expiresAt = q.backupRetentionDays > 0 ? new Date(Date.now() + q.backupRetentionDays * 86400_000) : null;

  const backup = await db.transaction(async (tx) => {
    if (toDelete.length) await tx.delete(backups).where(inArray(backups.id, toDelete));
    const [row] = await tx
      .insert(backups)
      .values({
        userId: input.userId,
        guildId: input.guildId,
        guildName: state.name,
        kind: input.kind,
        label: input.label ?? defaultLabel(input.kind),
        version: Number(max) + 1,
        snapshot,
        messageCount: exported.length,
        sizeBytes: json.length + exported.reduce((n, m) => n + (m.content?.length ?? 0), 0),
        summary: { ...summarizeState(state), messages: exported.length, ...(hidden ? { messagesHidden: hidden } : {}) },
        installationId: input.installationId ?? null,
        expiresAt,
      })
      .returning();
    if (exported.length) {
      for (let i = 0; i < exported.length; i += 500) {
        await tx.insert(backupMessages).values(exported.slice(i, i + 500).map((m) => ({ ...m, backupId: row!.id })));
      }
    }
    return row!;
  });

  await audit({
    actorUserId: input.userId,
    actorType: input.kind === "scheduled" ? "system" : "user",
    action: "backup.create",
    targetType: "backup",
    targetId: backup.id,
    guildId: input.guildId,
    metadata: { kind: input.kind, version: backup.version, messages: exported.length, rotated: toDelete.length },
  });
  return backup;
}

function defaultLabel(kind: BackupKind): string {
  const date = new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });
  if (kind === "safety") return `Sauvegarde de sécurité avant installation (${date})`;
  if (kind === "scheduled") return `Sauvegarde programmée (${date})`;
  return `Sauvegarde manuelle (${date})`;
}

export async function listBackups(userId: string, guildId?: string) {
  const db = getDb();
  return db
    .select({
      id: backups.id,
      guildId: backups.guildId,
      guildName: backups.guildName,
      kind: backups.kind,
      label: backups.label,
      version: backups.version,
      summary: backups.summary,
      messageCount: backups.messageCount,
      sizeBytes: backups.sizeBytes,
      createdAt: backups.createdAt,
      expiresAt: backups.expiresAt,
    })
    .from(backups)
    .where(guildId ? and(eq(backups.userId, userId), eq(backups.guildId, guildId)) : eq(backups.userId, userId))
    .orderBy(desc(backups.createdAt));
}

/** Une sauvegarde n’est lisible que par son propriétaire. */
export async function getOwnedBackup(userId: string, backupId: string) {
  const [row] = await getDb()
    .select()
    .from(backups)
    .where(and(eq(backups.id, backupId), eq(backups.userId, userId)));
  return row ?? null;
}

export async function deleteBackup(userId: string, backupId: string) {
  const rows = await getDb()
    .delete(backups)
    .where(and(eq(backups.id, backupId), eq(backups.userId, userId)))
    .returning({ id: backups.id, guildId: backups.guildId });
  if (rows[0]) await audit({ actorUserId: userId, actorType: "user", action: "backup.delete", targetType: "backup", targetId: backupId, guildId: rows[0].guildId });
  return rows.length > 0;
}

/** Supprime les sauvegardes expirées (durée de conservation de l’offre). */
export async function purgeExpiredBackups() {
  const rows = await getDb().delete(backups).where(sql`${backups.expiresAt} is not null and ${backups.expiresAt} < now()`).returning({ id: backups.id });
  return rows.length;
}
