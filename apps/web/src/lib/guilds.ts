import "server-only";
import { botGuilds, getDb, inArray, isNull, and } from "@mys/db";
import { oauthGuildManageable, SANDBOX_GUILD_ID } from "@mys/engine";
import { fetchUserGuilds } from "./discord-oauth";
import { env } from "./env";

export interface ManageableGuild {
  id: string;
  name: string;
  iconUrl: string | null;
  owner: boolean;
  botPresent: boolean;
  sandbox?: boolean;
}

/**
 * Serveurs où l’utilisateur a « Gérer le serveur » (ou est propriétaire / administrateur).
 * Ce filtre sert à l’affichage : les droits sont revérifiés via le bot avant chaque opération.
 */
export async function listManageableGuilds(userId: string, force = false): Promise<{ guilds: ManageableGuild[]; needsReauth: boolean }> {
  if (env.sandbox) {
    return { guilds: [{ id: SANDBOX_GUILD_ID, name: "Serveur bac à sable (simulation)", iconUrl: null, owner: true, botPresent: true, sandbox: true }], needsReauth: false };
  }
  const all = await fetchUserGuilds(userId, force);
  if (!all) return { guilds: [], needsReauth: true };
  const manageable = all.filter(oauthGuildManageable);
  const ids = manageable.map((g) => g.id);
  const present = ids.length
    ? await getDb()
        .select({ id: botGuilds.guildId })
        .from(botGuilds)
        .where(and(inArray(botGuilds.guildId, ids), isNull(botGuilds.leftAt)))
    : [];
  const presentSet = new Set(present.map((p) => p.id));
  return {
    needsReauth: false,
    guilds: manageable
      .map((g) => ({
        id: g.id,
        name: g.name,
        iconUrl: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=96` : null,
        owner: g.owner,
        botPresent: presentSet.has(g.id),
      }))
      .sort((a, b) => Number(b.botPresent) - Number(a.botPresent) || a.name.localeCompare(b.name, "fr")),
  };
}

/** Lien d’invitation du bot, serveur présélectionné. */
export function inviteUrl(guildId?: string, variant: "admin" | "minimal" = "admin") {
  // Administrateur (8) recommandé pendant l’installation ; permissions minimales sinon.
  const minimal = (1n << 10n) | (1n << 4n) | (1n << 28n) | (1n << 5n) | (1n << 29n) | (1n << 13n) | (1n << 34n) | (1n << 51n) | (1n << 11n) | (1n << 38n) | (1n << 36n) | (1n << 14n) | (1n << 15n) | (1n << 16n) | (1n << 6n) | (1n << 18n);
  const p = new URLSearchParams({
    client_id: env.discordClientId,
    scope: "bot applications.commands",
    permissions: variant === "admin" ? "8" : minimal.toString(),
    integration_type: "0",
  });
  if (guildId) {
    p.set("guild_id", guildId);
    p.set("disable_guild_select", "true");
  }
  return `https://discord.com/oauth2/authorize?${p}`;
}
