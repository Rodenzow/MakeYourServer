import "server-only";
import { DiscordRestGateway, createSandboxGateway, type GuildGateway } from "@mys/engine";
import { env } from "./env";

let real: DiscordRestGateway | null = null;

/** Accès Discord côté site (lecture d’état, contrôles d’accès). Les modifications sont exécutées par le worker du bot. */
export function getGateway(userDiscordId: string): GuildGateway {
  if (env.sandbox) return createSandboxGateway(userDiscordId);
  if (!env.discordBotToken) throw new Error("DISCORD_BOT_TOKEN manquant : le site ne peut pas lire l’état des serveurs.");
  real ??= DiscordRestGateway.fromToken(env.discordBotToken, env.discordClientId);
  return real;
}
