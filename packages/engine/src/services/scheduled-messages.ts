import { createHash } from "node:crypto";
import {
  DISCORD_CHANNEL_TYPE,
  SCHEDULED_LIMITS,
  SCHEDULED_REPEATS,
  buildScheduledMessagePayload,
  formatParisDateTime,
  nextScheduledOccurrence,
  validateScheduledContent,
  type ScheduledRepeat,
} from "@mys/core";
import { and, asc, audit, count, eq, getDb, logError, lte, ne, scheduledMessages, users } from "@mys/db";
import { GatewayError, type GuildGateway } from "../gateway";
import { AccessDeniedError, BotMissingError, assertGuildAccess } from "./access";
import { QuotaError } from "./backups";
import { getEntitlement } from "./quotas";

export type ScheduledMessageRow = typeof scheduledMessages.$inferSelect;

/** Erreur de saisie (affichée telle quelle à l’utilisateur). */
export class ScheduledMessageError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 = 400,
  ) {
    super(message);
    this.name = "ScheduledMessageError";
  }
}

export interface ScheduledMessageInput {
  guildId: string;
  channelId: string;
  content: string;
  embedTitle?: string | null;
  embedDescription?: string | null;
  embedColor?: number | null;
  nextRunAt: Date;
  repeat: ScheduledRepeat;
}

interface Actor {
  id: string;
  discordId: string;
}

/** Au-delà de ce retard, un envoi est considéré comme manqué (service indisponible). */
export const SCHEDULED_MISSED_AFTER_MS = 6 * 3600_000;
const SENDABLE_TYPES: number[] = [DISCORD_CHANNEL_TYPE.text, DISCORD_CHANNEL_TYPE.announcement];

export async function listScheduledMessages(userId: string): Promise<ScheduledMessageRow[]> {
  return getDb().select().from(scheduledMessages).where(eq(scheduledMessages.userId, userId)).orderBy(asc(scheduledMessages.guildId), asc(scheduledMessages.nextRunAt));
}

export async function getOwnedScheduledMessage(userId: string, id: string): Promise<ScheduledMessageRow | null> {
  const [row] = await getDb()
    .select()
    .from(scheduledMessages)
    .where(and(eq(scheduledMessages.id, id), eq(scheduledMessages.userId, userId)));
  return row ?? null;
}

async function requireOwned(userId: string, id: string) {
  const row = await getOwnedScheduledMessage(userId, id);
  if (!row) throw new ScheduledMessageError("Message programmé introuvable.", 404);
  return row;
}

async function countActive(userId: string, exceptId?: string): Promise<number> {
  const [r] = await getDb()
    .select({ n: count() })
    .from(scheduledMessages)
    .where(and(eq(scheduledMessages.userId, userId), eq(scheduledMessages.status, "active"), exceptId ? ne(scheduledMessages.id, exceptId) : undefined));
  return Number(r?.n ?? 0);
}

/** Quota de l’offre : les messages programmés sont réservés au Premium. */
async function assertQuota(userId: string, exceptId?: string) {
  const { quotas } = await getEntitlement(userId);
  if (quotas.scheduledMessages <= 0) throw new QuotaError("Les messages programmés sont réservés au Premium.");
  if ((await countActive(userId, exceptId)) >= quotas.scheduledMessages) {
    throw new QuotaError(`Votre offre permet ${quotas.scheduledMessages} message(s) programmé(s) actif(s). Mettez-en un en pause ou supprimez-en un.`);
  }
}

function normalize(input: ScheduledMessageInput, now: Date) {
  if (!SCHEDULED_REPEATS.includes(input.repeat)) throw new ScheduledMessageError("Répétition invalide.");
  const embedTitle = input.embedTitle?.trim() || null;
  const embedDescription = input.embedDescription?.trim() || null;
  const content = { content: input.content.trim(), embedTitle, embedDescription, embedColor: embedTitle || embedDescription ? (input.embedColor ?? null) : null };
  const invalid = validateScheduledContent(content);
  if (invalid) throw new ScheduledMessageError(invalid);
  if (Number.isNaN(input.nextRunAt.getTime()) || input.nextRunAt.getTime() <= now.getTime()) throw new ScheduledMessageError("Choisissez une date et une heure dans le futur.");
  if (input.nextRunAt.getTime() > now.getTime() + SCHEDULED_LIMITS.maxDaysAhead * 86400_000) throw new ScheduledMessageError("La date d’envoi doit être dans moins d’un an.");
  return content;
}

/** Droits « Gérer le serveur » revérifiés via le bot, puis salon textuel ou d’annonces. */
async function checkTarget(gateway: GuildGateway, actor: Actor, guildId: string, channelId: string) {
  const { guild } = await assertGuildAccess(gateway, guildId, actor.discordId, "manage");
  const state = await gateway.fetchState(guildId);
  const channel = state.channels.find((c) => c.id === channelId);
  if (!channel) throw new ScheduledMessageError("Ce salon n’existe pas (ou plus) sur ce serveur.");
  if (!SENDABLE_TYPES.includes(channel.type)) throw new ScheduledMessageError("Choisissez un salon textuel ou d’annonces.");
  return { guild, channel };
}

export async function createScheduledMessage(gateway: GuildGateway, actor: Actor, input: ScheduledMessageInput, now = new Date()) {
  const content = normalize(input, now);
  await assertQuota(actor.id);
  const { channel } = await checkTarget(gateway, actor, input.guildId, input.channelId);
  const [row] = await getDb()
    .insert(scheduledMessages)
    .values({ userId: actor.id, guildId: input.guildId, channelId: channel.id, channelName: channel.name, ...content, repeat: input.repeat, nextRunAt: input.nextRunAt, status: "active" })
    .returning();
  await audit({ actorUserId: actor.id, actorType: "user", action: "scheduled_message.create", targetType: "scheduled_message", targetId: row!.id, guildId: input.guildId, metadata: { repeat: input.repeat } });
  return row!;
}

/**
 * Modification complète. Un message envoyé ou en échec redevient actif (quota vérifié) ;
 * un message en pause reste en pause.
 */
export async function updateScheduledMessage(gateway: GuildGateway, actor: Actor, id: string, input: ScheduledMessageInput, now = new Date()) {
  const existing = await requireOwned(actor.id, id);
  const content = normalize(input, now);
  const status = existing.status === "paused" ? "paused" : "active";
  if (status === "active") await assertQuota(actor.id, id);
  const { channel } = await checkTarget(gateway, actor, input.guildId, input.channelId);
  const [row] = await getDb()
    .update(scheduledMessages)
    .set({ guildId: input.guildId, channelId: channel.id, channelName: channel.name, ...content, repeat: input.repeat, nextRunAt: input.nextRunAt, status, lastError: null, updatedAt: new Date() })
    .where(and(eq(scheduledMessages.id, id), eq(scheduledMessages.userId, actor.id)))
    .returning();
  await audit({ actorUserId: actor.id, actorType: "user", action: "scheduled_message.update", targetType: "scheduled_message", targetId: id, guildId: input.guildId });
  return row!;
}

/** Pause ou reprise. La reprise revérifie les droits et le quota. */
export async function setScheduledMessagePaused(gateway: GuildGateway, actor: Actor, id: string, paused: boolean, now = new Date()) {
  const existing = await requireOwned(actor.id, id);
  let nextRunAt = existing.nextRunAt;
  if (paused) {
    if (existing.status !== "active") throw new ScheduledMessageError("Seul un message programmé actif peut être mis en pause.");
  } else {
    if (existing.status === "active") return existing;
    if (existing.status === "done" && existing.repeat === "none") throw new ScheduledMessageError("Ce message a déjà été envoyé : modifiez-le pour choisir une nouvelle date.");
    if (!nextRunAt || nextRunAt.getTime() <= now.getTime()) {
      if (existing.repeat === "none") throw new ScheduledMessageError("La date prévue est passée : modifiez le message pour choisir une nouvelle date.");
      nextRunAt = nextScheduledOccurrence(nextRunAt ?? now, existing.repeat as ScheduledRepeat, now);
    }
    await assertQuota(actor.id, id);
    await checkTarget(gateway, actor, existing.guildId, existing.channelId);
  }
  const [row] = await getDb()
    .update(scheduledMessages)
    .set({ status: paused ? "paused" : "active", nextRunAt, lastError: paused ? existing.lastError : null, updatedAt: new Date() })
    .where(and(eq(scheduledMessages.id, id), eq(scheduledMessages.userId, actor.id)))
    .returning();
  await audit({ actorUserId: actor.id, actorType: "user", action: paused ? "scheduled_message.pause" : "scheduled_message.resume", targetType: "scheduled_message", targetId: id, guildId: existing.guildId });
  return row!;
}

/** Suppression : toujours possible pour le créateur, même sans accès au serveur. */
export async function deleteScheduledMessage(userId: string, id: string) {
  const rows = await getDb()
    .delete(scheduledMessages)
    .where(and(eq(scheduledMessages.id, id), eq(scheduledMessages.userId, userId)))
    .returning({ id: scheduledMessages.id, guildId: scheduledMessages.guildId });
  if (!rows[0]) return false;
  await audit({ actorUserId: userId, actorType: "user", action: "scheduled_message.delete", targetType: "scheduled_message", targetId: id, guildId: rows[0].guildId });
  return true;
}

type Outcome =
  | { kind: "sent"; set: Partial<ScheduledMessageRow> }
  | { kind: "failed"; set: Partial<ScheduledMessageRow> }
  | { kind: "retry"; set: Partial<ScheduledMessageRow> }
  | { kind: "missed"; set: Partial<ScheduledMessageRow> };

/** Nonce Discord (25 caractères max) : évite un doublon si l’envoi est rejoué juste après un arrêt brutal. */
function nonceFor(msg: ScheduledMessageRow) {
  return `sm${createHash("sha256").update(`${msg.id}:${msg.nextRunAt?.getTime()}`).digest("hex").slice(0, 23)}`;
}

async function processOne(gateway: GuildGateway, msg: ScheduledMessageRow, now: Date): Promise<Outcome> {
  const planned = msg.nextRunAt ?? now;
  const repeat = msg.repeat as ScheduledRepeat;
  const fail = (message: string): Outcome => ({ kind: "failed", set: { status: "failed", lastError: message.slice(0, 500) } });

  if (now.getTime() - planned.getTime() > SCHEDULED_MISSED_AFTER_MS) {
    const note = `L’envoi prévu le ${formatParisDateTime(planned)} a été manqué : le service d’envoi était indisponible à ce moment-là.`;
    const next = nextScheduledOccurrence(planned, repeat, now);
    if (!next) return { kind: "missed", set: { status: "failed", lastError: `${note} Modifiez le message pour choisir une nouvelle date.` } };
    return { kind: "missed", set: { nextRunAt: next, lastError: `${note} Prochain envoi conservé.` } };
  }

  const [user] = await getDb().select({ discordId: users.discordId, suspendedAt: users.suspendedAt }).from(users).where(eq(users.id, msg.userId));
  if (!user) return fail("Compte introuvable.");
  if (user.suspendedAt) return fail("Envoi annulé : votre compte est suspendu.");

  const ent = await getEntitlement(msg.userId);
  if (ent.quotas.scheduledMessages <= 0) {
    return fail("Envoi suspendu : votre compte n’a plus le Premium. Après avoir renouvelé votre abonnement, cliquez sur « Reprendre ».");
  }

  try {
    await assertGuildAccess(gateway, msg.guildId, user.discordId, "manage");
  } catch (e) {
    if (e instanceof AccessDeniedError) return fail(`Envoi annulé : ${e.message} Seule une personne qui gère le serveur peut programmer des messages.`);
    if (e instanceof BotMissingError) return fail("Envoi impossible : le bot Make Your Server n’est plus sur ce serveur.");
    if (e instanceof GatewayError && !e.retriable) return fail(`Envoi impossible : ${e.message}`);
    return { kind: "retry", set: { lastError: "Discord ne répond pas pour le moment : nouvelle tentative automatique dans quelques instants." } };
  }

  try {
    await gateway.sendMessage(msg.channelId, { ...buildScheduledMessagePayload(msg), nonce: nonceFor(msg), enforce_nonce: true });
  } catch (e) {
    if (e instanceof GatewayError && e.retriable) {
      return { kind: "retry", set: { lastError: "Discord est momentanément indisponible : nouvelle tentative automatique dans quelques instants." } };
    }
    if (!(e instanceof GatewayError)) {
      await logError("worker", "Envoi d’un message programmé en échec", { scheduledMessageId: msg.id, error: e instanceof Error ? e.message : String(e) });
    }
    return fail(`Envoi impossible dans #${msg.channelName || "salon"} : ${e instanceof GatewayError ? e.message : "erreur inattendue."}`);
  }

  const next = nextScheduledOccurrence(planned, repeat, now);
  return {
    kind: "sent",
    set: next ? { lastSentAt: now, lastError: null, nextRunAt: next, status: "active" } : { lastSentAt: now, lastError: null, status: "done" },
  };
}

export interface ScheduledRunResult {
  sent: number;
  failed: number;
  retried: number;
  missed: number;
}

/**
 * Envoie les messages programmés échus. Chaque message est verrouillé
 * (FOR UPDATE SKIP LOCKED) pendant son traitement : plusieurs workers peuvent
 * tourner en parallèle sans jamais envoyer deux fois la même occurrence.
 * Les droits et le Premium du créateur sont revérifiés au moment de l’envoi.
 */
export async function runDueScheduledMessages(gateway: GuildGateway, now = new Date(), opts: { limit?: number } = {}): Promise<ScheduledRunResult> {
  const limit = opts.limit ?? 50;
  const result: ScheduledRunResult = { sent: 0, failed: 0, retried: 0, missed: 0 };
  const tried: string[] = [];
  for (let i = 0; i < limit; i++) {
    const outcome = await getDb().transaction(async (tx) => {
      const [msg] = await tx
        .select()
        .from(scheduledMessages)
        .where(and(eq(scheduledMessages.status, "active"), lte(scheduledMessages.nextRunAt, now), ...tried.map((id) => ne(scheduledMessages.id, id))))
        .orderBy(asc(scheduledMessages.nextRunAt))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!msg) return null;
      tried.push(msg.id);
      const out = await processOne(gateway, msg, now);
      await tx
        .update(scheduledMessages)
        .set({ ...out.set, updatedAt: new Date() })
        .where(eq(scheduledMessages.id, msg.id));
      if (out.kind === "failed") {
        await audit({ actorUserId: msg.userId, actorType: "system", action: "scheduled_message.failed", targetType: "scheduled_message", targetId: msg.id, guildId: msg.guildId, metadata: { error: out.set.lastError } }).catch(() => {});
      }
      return out.kind;
    });
    if (!outcome) break;
    if (outcome === "sent") result.sent++;
    else if (outcome === "failed") result.failed++;
    else if (outcome === "retry") result.retried++;
    else result.missed++;
  }
  return result;
}

/** Boucle périodique (worker du bot et worker du bac à sable). */
export function startScheduledMessages(gateway: GuildGateway, opts: { intervalMs?: number; log?: (m: string) => void } = {}) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await runDueScheduledMessages(gateway);
      if (r.sent || r.failed || r.missed) opts.log?.(`messages programmés : ${r.sent} envoyé(s), ${r.failed} en échec, ${r.missed} manqué(s)`);
    } catch (e) {
      await logError("worker", "Envoi des messages programmés en échec", { error: e instanceof Error ? e.message : String(e) });
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, opts.intervalMs ?? 30_000);
  void tick();
  return () => clearInterval(timer);
}
