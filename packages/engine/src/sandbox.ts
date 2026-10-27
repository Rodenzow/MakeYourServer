import { ALL_PERMISSIONS, type GuildState } from "@mys/core";
import { appSettings, eq, getDb } from "@mys/db";
import { FakeGateway } from "./fake-gateway";
import { GatewayError, type GuildGateway } from "./gateway";

/**
 * Serveur Discord simulé et persistant (DISCORD_SANDBOX=true), partagé entre le
 * site et le worker. Il permet de tester tout le parcours sans bot réel. Il est
 * toujours présenté comme une simulation.
 */
export const SANDBOX_GUILD_ID = "100000000000000000";
export const SANDBOX_BOT_ID = "900000000000000001";
const KEY = "sandbox_guild";
const ADMIN_ROLE = "100000000000000999";

type Saved = { state: GuildState; members: Record<string, string[]>; botUserId: string };

async function load(actor?: string): Promise<FakeGateway> {
  const [row] = await getDb().select().from(appSettings).where(eq(appSettings.key, KEY));
  let gw: FakeGateway;
  if (row) {
    const saved = row.value as Saved;
    gw = new FakeGateway(saved.state, saved.botUserId);
    for (const [k, v] of Object.entries(saved.members)) gw.members.set(k, v);
  } else {
    gw = FakeGateway.emptyGuild({ guildId: SANDBOX_GUILD_ID, ownerId: actor ?? "100000000000000001", name: "Serveur bac à sable" });
    gw.state.roles.push({ id: ADMIN_ROLE, name: "Testeurs (bac à sable)", color: 0xa7bdff, hoist: false, mentionable: false, permissions: ALL_PERMISSIONS.toString(), position: 1, managed: false });
    for (const r of gw.state.roles) if (r.managed) r.position = 2;
  }
  // Toute personne qui ouvre le bac à sable y est administratrice (environnement de test uniquement).
  if (actor && !gw.members.has(actor)) gw.members.set(actor, [ADMIN_ROLE]);
  return gw;
}

async function save(gw: FakeGateway) {
  const value: Saved = { state: gw.state, members: Object.fromEntries(gw.members), botUserId: gw.botUserId };
  await getDb().insert(appSettings).values({ key: KEY, value }).onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
}

/** Passerelle qui recharge et enregistre l’état simulé à chaque appel. */
export function createSandboxGateway(actorDiscordId?: string): GuildGateway {
  return new Proxy({} as GuildGateway, {
    get(_t, prop: string) {
      if (prop === "botUserId") return SANDBOX_BOT_ID;
      if (prop === "simulated") return true;
      if (prop === "then") return undefined;
      return async (...args: unknown[]) => {
        // Seul le serveur simulé existe : tout autre identifiant se comporte comme un serveur sans le bot.
        if (["fetchState", "fetchGuild", "getMember"].includes(prop) && args[0] !== SANDBOX_GUILD_ID) {
          throw new GatewayError("Serveur introuvable ou bot retiré du serveur.", 10004, 404, false);
        }
        const gw = await load(actorDiscordId);
        const fn = (gw as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[prop];
        if (typeof fn !== "function") throw new Error(`Méthode inconnue : ${prop}`);
        try {
          return await fn.apply(gw, args);
        } finally {
          await save(gw);
        }
      };
    },
  });
}

export async function resetSandbox() {
  await getDb().delete(appSettings).where(eq(appSettings.key, KEY));
}
