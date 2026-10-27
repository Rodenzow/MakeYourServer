import type { GuildState } from "@mys/core";

export interface RawMessage {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  authorIsBot: boolean;
  content: string;
  embeds: Array<Record<string, unknown>>;
  attachments: Array<{ name: string; url: string }>;
  timestamp: string;
  nonce?: string | number | null;
}

export type GuildBasics = Pick<GuildState, "id" | "name" | "ownerId" | "roles" | "features"> & { iconUrl?: string | null };

export interface MemberInfo {
  userId: string;
  roles: string[];
}

/**
 * Accès à Discord utilisé par le moteur. Deux implémentations :
 *  - DiscordRestGateway : l’API officielle (production) ;
 *  - FakeGateway : un serveur simulé en mémoire (tests et mode « simulation »).
 */
export interface GuildGateway {
  readonly botUserId: string;
  readonly simulated: boolean;
  fetchState(guildId: string): Promise<GuildState>;
  /** Lecture légère : propriétaire, rôles et fonctionnalités (contrôles d’accès). */
  fetchGuild(guildId: string): Promise<GuildBasics>;
  getMember(guildId: string, userId: string): Promise<MemberInfo | null>;

  createRole(guildId: string, body: Record<string, unknown>, reason: string): Promise<{ id: string }>;
  editRole(guildId: string, roleId: string, body: Record<string, unknown>, reason: string): Promise<void>;
  deleteRole(guildId: string, roleId: string, reason: string): Promise<void>;
  setRolePositions(guildId: string, positions: Array<{ id: string; position: number }>, reason: string): Promise<void>;

  createChannel(guildId: string, body: Record<string, unknown>, reason: string): Promise<{ id: string }>;
  editChannel(channelId: string, body: Record<string, unknown>, reason: string): Promise<void>;
  deleteChannel(channelId: string, reason: string): Promise<void>;
  setChannelPositions(guildId: string, positions: Array<{ id: string; position: number; parent_id?: string | null; lock_permissions?: boolean }>, reason: string): Promise<void>;

  editGuild(guildId: string, body: Record<string, unknown>, reason: string): Promise<void>;

  sendMessage(channelId: string, body: Record<string, unknown>): Promise<{ id: string }>;
  editMessage(channelId: string, messageId: string, body: Record<string, unknown>): Promise<void>;
  messageExists(channelId: string, messageId: string): Promise<boolean>;
  listMessages(channelId: string, opts: { limit: number; before?: string }): Promise<RawMessage[]>;
  pinMessage(channelId: string, messageId: string, reason: string): Promise<void>;

  createAutomodRule(guildId: string, body: Record<string, unknown>, reason: string): Promise<{ id: string }>;
  editAutomodRule(guildId: string, ruleId: string, body: Record<string, unknown>, reason: string): Promise<void>;

  putOnboarding(guildId: string, body: Record<string, unknown>, reason: string): Promise<void>;
  editWelcomeScreen(guildId: string, body: Record<string, unknown>, reason: string): Promise<void>;

  /** Republication de messages archivés (webhook temporaire). */
  createWebhook(channelId: string, name: string, reason: string): Promise<{ id: string; token: string }>;
  executeWebhook(webhookId: string, token: string, body: Record<string, unknown>): Promise<{ id: string }>;
  deleteWebhook(webhookId: string, reason: string): Promise<void>;
}

/** Erreur Discord traduite en français, avec indication de réessai. */
export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly code: number | string,
    public readonly status: number,
    public readonly retriable: boolean,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

const KNOWN_CODES: Record<number, string> = {
  10003: "Salon introuvable (il a peut-être été supprimé entre-temps).",
  10004: "Serveur introuvable ou bot retiré du serveur.",
  10008: "Message introuvable.",
  10011: "Rôle introuvable (il a peut-être été supprimé entre-temps).",
  10066: "Règle AutoMod introuvable.",
  30005: "Le serveur a atteint la limite de 250 rôles.",
  30013: "Le serveur a atteint la limite de 500 salons.",
  30003: "Le salon a atteint la limite de 250 messages épinglés.",
  30035: "Limite de règles AutoMod atteinte pour ce type.",
  50001: "Le bot n’a pas accès à cet élément (vérifiez ses permissions et la visibilité du salon).",
  50013: "Le bot n’a pas les permissions nécessaires (ou le rôle visé est au-dessus du sien).",
  50024: "Action impossible sur ce type de salon.",
  50028: "Rôle invalide.",
  50035: "Données refusées par Discord.",
  160002: "Ce salon ne peut pas recevoir de messages du bot.",
  220001: "Discord exige au moins 7 salons par défaut dans l’onboarding.",
  220002: "Discord exige qu’au moins 5 salons par défaut soient accessibles en écriture à @everyone.",
  350000: "Configuration d’onboarding refusée par Discord.",
};

export function translateDiscordError(e: unknown): GatewayError {
  if (e instanceof GatewayError) return e;
  const err = e as { code?: number | string; status?: number; message?: string; rawError?: { message?: string; errors?: unknown } };
  const status = typeof err.status === "number" ? err.status : 0;
  const code = err.code ?? "unknown";
  const known = typeof code === "number" ? KNOWN_CODES[code] : undefined;
  let detail = "";
  if (code === 50035 && err.rawError?.errors) detail = ` Détail : ${summarizeFormErrors(err.rawError.errors)}`;
  const retriable = status === 0 || status >= 500 || status === 429;
  if (status === 401) return new GatewayError("Le jeton du bot est invalide ou a été régénéré : mettez à jour DISCORD_BOT_TOKEN.", code, status, false);
  const message = known
    ? `${known}${detail}`
    : retriable
      ? `Discord est momentanément indisponible (${status || "réseau"}). Nouvelle tentative automatique.`
      : `Erreur Discord ${code} : ${err.rawError?.message ?? err.message ?? "inconnue"}.`;
  return new GatewayError(message, code, status, retriable);
}

function summarizeFormErrors(errors: unknown, path: string[] = []): string {
  if (!errors || typeof errors !== "object") return "";
  const out: string[] = [];
  for (const [k, v] of Object.entries(errors as Record<string, unknown>)) {
    if (k === "_errors" && Array.isArray(v)) out.push(`${path.join(".")} : ${v.map((x: { message?: string }) => x.message).join(", ")}`);
    else out.push(summarizeFormErrors(v, [...path, k]));
  }
  return out.filter(Boolean).slice(0, 3).join(" ; ");
}
