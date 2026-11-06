import { sanitize } from "@mys/db";

/**
 * Alertes envoyées aux administrateurs dans un salon Discord, via un webhook
 * (variable facultative ALERT_WEBHOOK_URL). Sans cette variable, rien n’est envoyé.
 *
 * Règles : jamais de mention (@everyone…), jamais de données sensibles (textes nettoyés
 * par `sanitize`, pas de nom de serveur ni de pseudo), et un débit limité pour ne pas
 * inonder le salon. Une alerte qui échoue n’interrompt jamais le service.
 */

export type AlertLevel = "error" | "warning" | "success" | "info";

export interface AlertInput {
  title: string;
  description?: string;
  level?: AlertLevel;
  fields?: { name: string; value: string; inline?: boolean }[];
  /** Lien ouvert en cliquant sur le titre (page d’administration). */
  url?: string;
}

export interface AlertOptions {
  /** Par défaut : process.env.ALERT_WEBHOOK_URL. */
  webhookUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const COLORS: Record<AlertLevel, number> = { error: 0xff5f57, warning: 0xf2c14e, success: 0x5fd39a, info: 0x83a8f3 };

/** Seuls les webhooks Discord (https) sont acceptés. */
export function isDiscordWebhookUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    return u.protocol === "https:" && (host === "discord.com" || host.endsWith(".discord.com") || host === "discordapp.com") && u.pathname.startsWith("/api/webhooks/");
  } catch {
    return false;
  }
}

const clean = (s: string, max: number) => String(sanitize(s)).slice(0, max);

/** Construit le message Discord (exporté pour les tests). */
export function alertPayload(input: AlertInput) {
  return {
    username: "Make Your Server — alertes",
    allowed_mentions: { parse: [] as string[] },
    embeds: [
      {
        title: clean(input.title, 250),
        ...(input.description ? { description: clean(input.description, 2000) } : {}),
        color: COLORS[input.level ?? "info"],
        ...(input.url ? { url: input.url } : {}),
        fields: (input.fields ?? []).slice(0, 10).map((f) => ({ name: clean(f.name, 250), value: clean(f.value, 1000) || "—", inline: f.inline ?? true })),
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

let warnedInvalid = false;

/** Envoie une alerte. Renvoie true si Discord l’a acceptée ; ne lève jamais d’erreur. */
export async function sendAlert(input: AlertInput, opts: AlertOptions = {}): Promise<boolean> {
  const url = (opts.webhookUrl ?? process.env.ALERT_WEBHOOK_URL ?? "").trim();
  if (!url) return false;
  if (!isDiscordWebhookUrl(url)) {
    if (!warnedInvalid) console.warn("[alertes] ALERT_WEBHOOK_URL n’est pas une adresse de webhook Discord (https://discord.com/api/webhooks/…) : alertes désactivées.");
    warnedInvalid = true;
    return false;
  }
  try {
    const res = await (opts.fetchImpl ?? fetch)(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(alertPayload(input)),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 5_000),
    });
    if (!res.ok) console.warn(`[alertes] envoi refusé par Discord (HTTP ${res.status}).`);
    return res.ok;
  } catch (e) {
    // L’adresse du webhook contient un secret : on ne l’écrit jamais dans les journaux.
    console.warn(`[alertes] envoi impossible : ${e instanceof Error ? e.name : "erreur"}.`);
    return false;
  }
}

/* ------------------------------------------------------------------------- */
/*                         Installations en échec                             */
/* ------------------------------------------------------------------------- */

/** Une alerte par serveur et par heure au plus, et 20 par heure au total. */
const PER_GUILD_MS = 3_600_000;
const GLOBAL_PER_HOUR = 20;
const lastByGuild = new Map<string, number>();
let globalWindow: { start: number; count: number } = { start: 0, count: 0 };

/** Décide si une alerte peut partir maintenant (et l’enregistre). Exporté pour les tests. */
export function takeAlertSlot(key: string, now = Date.now()): boolean {
  const last = lastByGuild.get(key);
  if (last !== undefined && now - last < PER_GUILD_MS) return false;
  if (now - globalWindow.start >= 3_600_000) globalWindow = { start: now, count: 0 };
  if (globalWindow.count >= GLOBAL_PER_HOUR) return false;
  globalWindow.count++;
  lastByGuild.set(key, now);
  // Nettoyage : la table ne grossit pas indéfiniment.
  if (lastByGuild.size > 1000) for (const [k, t] of lastByGuild) if (now - t >= PER_GUILD_MS) lastByGuild.delete(k);
  return true;
}

/** Réinitialise le limiteur (tests). */
export function resetAlertThrottle() {
  lastByGuild.clear();
  globalWindow = { start: 0, count: 0 };
}

export interface InstallationAlert {
  installationId: string;
  guildId: string;
  /** install | restore */
  kind: string;
  status: "failed" | "partial";
  dryRun?: boolean;
  failedSteps?: number;
  totalSteps?: number;
  reason?: string | null;
}

/**
 * Prévient les administrateurs qu’une installation a échoué (totalement ou en partie).
 * Les simulations sont ignorées. Limité : 1 alerte par serveur et par heure.
 */
export async function alertInstallationProblem(info: InstallationAlert, opts: AlertOptions & { now?: number } = {}): Promise<boolean> {
  if (info.dryRun) return false;
  if (!(opts.webhookUrl ?? process.env.ALERT_WEBHOOK_URL)) return false;
  if (!takeAlertSlot(`guild:${info.guildId}`, opts.now)) return false;
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const fields: AlertInput["fields"] = [
    { name: "Serveur Discord (ID)", value: info.guildId },
    { name: "Type", value: info.kind === "restore" ? "Restauration" : "Installation" },
    { name: "Installation", value: info.installationId.slice(0, 8) },
  ];
  if (info.totalSteps) fields.push({ name: "Étapes en échec", value: `${info.failedSteps ?? 0} sur ${info.totalSteps}` });
  if (info.reason) fields.push({ name: "Raison", value: clean(info.reason, 300), inline: false });
  return sendAlert(
    {
      title: info.status === "partial" ? "⚠️ Installation partiellement réussie" : "❌ Installation en échec",
      description: "Les détails sont dans l’administration. Les autres alertes pour ce serveur sont suspendues pendant une heure.",
      level: info.status === "partial" ? "warning" : "error",
      fields,
      url: /^https:\/\//.test(appUrl) ? `${appUrl}/admin/installations/${info.installationId}` : undefined,
    },
    opts,
  );
}
