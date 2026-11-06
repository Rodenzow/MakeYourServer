/**
 * Messages programmés (Premium) : règles communes au site, au moteur et au bot.
 * Les dates sont saisies et affichées à l’heure de Paris ; elles sont stockées en UTC.
 */

export const SCHEDULE_TIMEZONE = "Europe/Paris";

export const SCHEDULED_REPEATS = ["none", "daily", "weekly"] as const;
export type ScheduledRepeat = (typeof SCHEDULED_REPEATS)[number];

export const SCHEDULED_REPEAT_LABELS: Record<ScheduledRepeat, string> = {
  none: "Une seule fois",
  daily: "Chaque jour",
  weekly: "Chaque semaine",
};

export const SCHEDULED_STATUSES = ["active", "paused", "done", "failed"] as const;
export type ScheduledStatus = (typeof SCHEDULED_STATUSES)[number];

export const SCHEDULED_STATUS_LABELS: Record<ScheduledStatus, string> = {
  active: "Programmé",
  paused: "En pause",
  done: "Envoyé",
  failed: "En échec",
};

/** Limites imposées par Discord. */
export const SCHEDULED_LIMITS = { content: 2000, embedTitle: 256, embedDescription: 4096, maxDaysAhead: 366 } as const;

export interface ScheduledMessageContent {
  content: string;
  embedTitle?: string | null;
  embedDescription?: string | null;
  embedColor?: number | null;
}

/** Vérifie le contenu ; renvoie un message d’erreur en français, ou null si tout va bien. */
export function validateScheduledContent(m: ScheduledMessageContent): string | null {
  const content = m.content.trim();
  const title = m.embedTitle?.trim() ?? "";
  const description = m.embedDescription?.trim() ?? "";
  if (!content && !title && !description) return "Le message est vide : saisissez un texte ou un encadré (titre ou description).";
  if (content.length > SCHEDULED_LIMITS.content) return `Le texte dépasse ${SCHEDULED_LIMITS.content} caractères (limite de Discord).`;
  if (title.length > SCHEDULED_LIMITS.embedTitle) return `Le titre de l’encadré dépasse ${SCHEDULED_LIMITS.embedTitle} caractères.`;
  if (description.length > SCHEDULED_LIMITS.embedDescription) return `La description de l’encadré dépasse ${SCHEDULED_LIMITS.embedDescription} caractères.`;
  if (m.embedColor != null && (!Number.isInteger(m.embedColor) || m.embedColor < 0 || m.embedColor > 0xffffff)) return "Couleur de l’encadré invalide.";
  return null;
}

/**
 * Corps envoyé à Discord. `allowed_mentions` vide : aucune mention ne notifie
 * personne (ni @everyone, ni @here, ni rôle, ni membre), quel que soit le texte.
 */
export function buildScheduledMessagePayload(m: ScheduledMessageContent): Record<string, unknown> {
  const title = m.embedTitle?.trim();
  const description = m.embedDescription?.trim();
  const body: Record<string, unknown> = { allowed_mentions: { parse: [] } };
  const content = m.content.trim();
  if (content) body.content = content;
  if (title || description) {
    const embed: Record<string, unknown> = {};
    if (title) embed.title = title;
    if (description) embed.description = description;
    if (m.embedColor != null) embed.color = m.embedColor;
    body.embeds = [embed];
  }
  return body;
}

interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: SCHEDULE_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function parisParts(d: Date): WallTime & { second: number } {
  const p: Record<string, number> = {};
  for (const part of fmt.formatToParts(d)) if (part.type !== "literal") p[part.type] = Number(part.value);
  return { year: p.year!, month: p.month!, day: p.day!, hour: p.hour! % 24, minute: p.minute!, second: p.second! };
}

/** Décalage de Paris par rapport à UTC à cet instant (en millisecondes). */
function parisOffset(d: Date): number {
  const p = parisParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** Instant UTC correspondant à une heure murale de Paris. */
export function parisWallTimeToDate(w: WallTime): Date {
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  const first = asUtc - parisOffset(new Date(asUtc));
  const second = asUtc - parisOffset(new Date(first));
  return new Date(second);
}

/** « 2026-11-20T18:30 » (heure de Paris, format des champs datetime-local) → Date, ou null si invalide. */
export function parisInputToDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number) as [number, number, number, number, number];
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  return parisWallTimeToDate({ year, month, day, hour, minute });
}

/** Date → « 2026-11-20T18:30 » à l’heure de Paris (pour pré-remplir un champ datetime-local). */
export function dateToParisInput(d: Date): string {
  const p = parisParts(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Ajoute des jours calendaires en conservant l’heure de Paris (changements d’heure compris). */
export function addParisDays(d: Date, days: number): Date {
  const p = parisParts(d);
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return parisWallTimeToDate({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate(), hour: p.hour, minute: p.minute });
}

/**
 * Prochaine occurrence strictement postérieure à `now` d’un message répété,
 * à partir de l’occurrence prévue `from` (les occurrences manquées sont sautées).
 * Renvoie null pour un envoi unique.
 */
export function nextScheduledOccurrence(from: Date, repeat: ScheduledRepeat, now: Date): Date | null {
  if (repeat === "none") return null;
  const step = repeat === "daily" ? 1 : 7;
  let next = addParisDays(from, step);
  // Rattrapage si le service a été longtemps indisponible.
  if (next.getTime() <= now.getTime()) {
    const behind = Math.floor((now.getTime() - next.getTime()) / (step * 86400_000));
    if (behind > 0) next = addParisDays(next, behind * step);
    while (next.getTime() <= now.getTime()) next = addParisDays(next, step);
  }
  return next;
}

/** Affichage français à l’heure de Paris (« ven. 20 nov. 2026 à 18:30 »). */
export function formatParisDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: SCHEDULE_TIMEZONE });
}
