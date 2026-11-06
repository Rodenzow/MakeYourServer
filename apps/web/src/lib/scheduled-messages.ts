import "server-only";
import { z } from "zod";
import { SCHEDULED_LIMITS, SCHEDULED_REPEATS, dateToParisInput, parisInputToDate, type ScheduledRepeat } from "@mys/core";
import { ScheduledMessageError, type ScheduledMessageInput, type ScheduledMessageRow } from "@mys/engine";
import { HttpError } from "./api";

const snowflake = z.string().regex(/^\d{17,20}$/, "identifiant Discord invalide");

/** Corps envoyé par le formulaire : la date est saisie à l’heure de Paris (« 2026-11-20T18:30 »). */
export const ScheduledMessageBody = z.object({
  guildId: snowflake,
  channelId: snowflake,
  content: z.string().max(SCHEDULED_LIMITS.content).default(""),
  embedTitle: z.string().max(SCHEDULED_LIMITS.embedTitle).nullish(),
  embedDescription: z.string().max(SCHEDULED_LIMITS.embedDescription).nullish(),
  embedColor: z.number().int().min(0).max(0xffffff).nullish(),
  sendAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "date et heure attendues"),
  repeat: z.enum(SCHEDULED_REPEATS),
});

export function toInput(body: z.infer<typeof ScheduledMessageBody>): ScheduledMessageInput {
  const nextRunAt = parisInputToDate(body.sendAt);
  if (!nextRunAt) throw new HttpError(400, "Date ou heure invalide.", "validation");
  return {
    guildId: body.guildId,
    channelId: body.channelId,
    content: body.content,
    embedTitle: body.embedTitle ?? null,
    embedDescription: body.embedDescription ?? null,
    embedColor: body.embedColor ?? null,
    nextRunAt,
    repeat: body.repeat as ScheduledRepeat,
  };
}

/** Traduit les erreurs de saisie du moteur en réponses HTTP lisibles. */
export async function translate<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ScheduledMessageError) throw new HttpError(e.status, e.message, e.status === 404 ? "not_found" : "validation");
    throw e;
  }
}

/** Forme sérialisable pour le navigateur (date pré-remplie à l’heure de Paris). */
export function toClient(row: ScheduledMessageRow) {
  return {
    id: row.id,
    guildId: row.guildId,
    channelId: row.channelId,
    channelName: row.channelName,
    content: row.content,
    embedTitle: row.embedTitle,
    embedDescription: row.embedDescription,
    embedColor: row.embedColor,
    repeat: row.repeat as ScheduledRepeat,
    status: row.status as "active" | "paused" | "done" | "failed",
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    sendAt: row.nextRunAt ? dateToParisInput(row.nextRunAt) : "",
    lastSentAt: row.lastSentAt?.toISOString() ?? null,
    lastError: row.lastError,
  };
}

export type ClientScheduledMessage = ReturnType<typeof toClient>;
