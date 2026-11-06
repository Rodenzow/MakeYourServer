/**
 * Suivi de l’état du bot entre deux contrôles du cron (toutes les 5 minutes), pour
 * prévenir les administrateurs sans répéter l’alerte à chaque contrôle.
 * Logique pure, testée dans apps/bot-host/test/health.test.ts.
 */

/** Contrôles « non connecté » consécutifs avant d’alerter (2 × 5 min = 10 min). */
export const FAILURES_BEFORE_ALERT = 2;

export interface HealthState {
  /** Contrôles consécutifs où le bot n’était pas « connecté ». */
  failures: number;
  /** Une alerte de panne a été envoyée et le rétablissement pas encore annoncé. */
  alerted: boolean;
  /** Premier contrôle en échec de la série (ms). */
  since: number | null;
}

export const INITIAL_HEALTH: HealthState = { failures: 0, alerted: false, since: null };

/**
 * Nouvel état après un contrôle, et l’alerte éventuelle à envoyer :
 * « down » quand le bot n’est plus connecté deux contrôles de suite, « up » à son retour.
 * L’appelant applique `next` si l’envoi réussit, sinon `ifUnsent` (nouvel essai au contrôle suivant).
 */
export function decideHealth(prev: HealthState, statut: string, now: number): { next: HealthState; alert: "down" | "up" | null; ifUnsent: HealthState } {
  if (statut === "connecté") {
    const next = { ...INITIAL_HEALTH };
    return prev.alerted ? { next, alert: "up", ifUnsent: prev } : { next, alert: null, ifUnsent: next };
  }
  const failures = prev.failures + 1;
  const since = prev.since ?? now;
  if (failures >= FAILURES_BEFORE_ALERT && !prev.alerted) {
    return { next: { failures, since, alerted: true }, alert: "down", ifUnsent: { failures, since, alerted: false } };
  }
  const next = { failures, since, alerted: prev.alerted };
  return { next, alert: null, ifUnsent: next };
}

/** Retire ce qui pourrait ressembler à un secret (jeton Discord, adresse de base…) avant d’envoyer un message. */
export function scrub(text: string): string {
  return text
    .replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}/g, "[masqué]")
    .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s)]+/gi, "[adresse masquée]")
    .slice(0, 300);
}

export const isDiscordWebhook = (url: string | undefined): url is string => !!url && /^https:\/\/(?:[a-z]+\.)?discord(?:app)?\.com\/api\/webhooks\//.test(url);

export const minutes = (ms: number) => Math.max(1, Math.round(ms / 60_000));
