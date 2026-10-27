import { Client, Events, GatewayIntentBits, MessageFlags, Partials, type Interaction } from "discord.js";
import { botGuilds, closeDb, eq, getDb, logError } from "@mys/db";
import { DiscordRestGateway, expireMissingDiscordEntitlements, startWorker, syncDiscordEntitlement } from "@mys/engine";
import { config } from "./config";
import { handleBackup, handleBackupList } from "./handlers/backup";
import {
  handleRoleToggle,
  handleRulesAccept,
  handleSuggestionOpen,
  handleSuggestionSubmit,
  handleTicketClose,
  handleTicketOpen,
  onMemberAdd,
  onMemberRemove,
} from "./handlers/features";
import {
  autocompleteBackups,
  autocompleteProjects,
  handleAbandonButton,
  handleCancel,
  handleConfirmButton,
  handleInstall,
  handleRestore,
  handleStatus,
  updateFollowup,
} from "./handlers/install";
import { handlePanel } from "./handlers/panel";
import { errorEmbed } from "./ui";
import { prepareEnvironment, startHealthServer } from "./startup";

function createClient(memberEvents: boolean) {
  const intents = [GatewayIntentBits.Guilds];
  if (memberEvents) intents.push(GatewayIntentBits.GuildMembers);
  return new Client({ intents, partials: [Partials.GuildMember] });
}

let client = createClient(config.memberEvents);
let gateway: DiscordRestGateway;

async function syncGuilds() {
  const db = getDb();
  for (const g of client.guilds.cache.values()) {
    await db
      .insert(botGuilds)
      .values({ guildId: g.id, name: g.name, icon: g.icon, ownerId: g.ownerId })
      .onConflictDoUpdate({ target: botGuilds.guildId, set: { name: g.name, icon: g.icon, ownerId: g.ownerId, leftAt: null, updatedAt: new Date() } });
  }
}

async function syncEntitlements() {
  try {
    const list = await client.application!.entitlements.fetch({ excludeEnded: true, cache: false });
    const active = new Set<string>();
    for (const e of list.values()) {
      const row = await syncDiscordEntitlement({ id: e.id, userId: e.userId, skuId: e.skuId, startsAt: e.startsAt, endsAt: e.endsAt, deleted: e.deleted });
      if (row?.status === "active") active.add(e.id);
    }
    await expireMissingDiscordEntitlements(active);
  } catch (e) {
    await logError("bot", "Synchronisation des abonnements Discord impossible", { error: e });
  }
}

function bind() {
  client.once(Events.ClientReady, async (c) => {
    console.log(`🤖 Connecté en tant que ${c.user.tag} sur ${c.guilds.cache.size} serveur(s).`);
    gateway = new DiscordRestGateway(c.rest, c.user.id);
    await syncGuilds();
    await syncEntitlements();
    setInterval(syncEntitlements, 60 * 60_000);
    startWorker({
      gateway,
      instanceId: `bot-${c.user.id.slice(-4)}-${process.pid}`,
      onInstallationProgress: (id) => updateFollowup(client, id),
      heartbeat: () => ({ guildCount: client.guilds.cache.size, gatewayStatus: client.ws.status === 0 ? "connecté" : `statut ${client.ws.status}` }),
    });
  });

  client.on(Events.GuildCreate, async (g) => {
    await getDb()
      .insert(botGuilds)
      .values({ guildId: g.id, name: g.name, icon: g.icon, ownerId: g.ownerId })
      .onConflictDoUpdate({ target: botGuilds.guildId, set: { name: g.name, icon: g.icon, leftAt: null, updatedAt: new Date() } });
  });
  client.on(Events.GuildDelete, async (g) => {
    await getDb().update(botGuilds).set({ leftAt: new Date(), updatedAt: new Date() }).where(eq(botGuilds.guildId, g.id));
  });
  client.on(Events.GuildUpdate, async (_old, g) => {
    await getDb().update(botGuilds).set({ name: g.name, icon: g.icon, updatedAt: new Date() }).where(eq(botGuilds.guildId, g.id));
  });

  client.on(Events.GuildMemberAdd, (m) => void onMemberAdd(m).catch((e) => logError("bot", "Arrivée de membre", { error: e })));
  client.on(Events.GuildMemberRemove, (m) => void onMemberRemove(m).catch((e) => logError("bot", "Départ de membre", { error: e })));

  // Premium Apps : achats et renouvellements effectués dans Discord.
  const onEntitlement = (e: { id: string; userId: string | null; skuId: string; startsAt: Date | null; endsAt: Date | null; deleted: boolean }, deleted = false) =>
    void syncDiscordEntitlement({ id: e.id, userId: e.userId, skuId: e.skuId, startsAt: e.startsAt, endsAt: e.endsAt, deleted: deleted || e.deleted });
  client.on(Events.EntitlementCreate, (e) => onEntitlement(e));
  client.on(Events.EntitlementUpdate, (_o, e) => onEntitlement(e));
  client.on(Events.EntitlementDelete, (e) => onEntitlement(e, true));

  client.on(Events.InteractionCreate, (i) => void route(i));
}

async function route(i: Interaction) {
  try {
    if (i.isAutocomplete()) {
      const sub = i.options.getSubcommand();
      if (sub === "installer") return await autocompleteProjects(i);
      if (sub === "restaurer") return await autocompleteBackups(i);
      return await i.respond([]);
    }
    if (i.isChatInputCommand() && i.commandName === "mys") {
      if (!i.inGuild()) return await i.reply({ content: "Cette commande s’utilise sur un serveur.", flags: MessageFlags.Ephemeral });
      switch (i.options.getSubcommand()) {
        case "panneau":
          return await handlePanel(i);
        case "installer":
          return await handleInstall(i, gateway);
        case "sauvegarder":
          return await handleBackup(i, gateway);
        case "sauvegardes":
          return await handleBackupList(i);
        case "restaurer":
          return await handleRestore(i, gateway);
        case "statut":
          return await handleStatus(i);
        case "annuler":
          return await handleCancel(i);
      }
    }
    if (i.isButton() && i.customId.startsWith("mys:")) {
      const [, kind, arg] = i.customId.split(":");
      if (kind === "rt") return await handleRoleToggle(i, arg!);
      if (kind === "ra") return await handleRulesAccept(i, arg!);
      if (kind === "tk" && arg === "open") return await handleTicketOpen(i);
      if (kind === "tk" && arg === "close") return await handleTicketClose(i);
      if (kind === "sg" && arg === "open") return await handleSuggestionOpen(i);
      if (kind === "ic") return await handleConfirmButton(i, gateway, arg!);
      if (kind === "ix") return await handleAbandonButton(i, arg!);
      if (kind === "panel" && arg === "backup") return await handleBackup(i, gateway);
      if (kind === "panel" && arg === "status") return await handleStatus(i);
    }
    if (i.isModalSubmit() && i.customId === "mys:sg:submit") return await handleSuggestionSubmit(i);
  } catch (e) {
    await logError("bot", "Interaction en échec", { customId: "customId" in i ? i.customId : undefined, error: e });
    if (i.isRepliable()) {
      const payload = { embeds: [errorEmbed("Une erreur est survenue. Réessayez dans un instant.")], flags: MessageFlags.Ephemeral as const };
      if (i.deferred || i.replied) await i.followUp(payload).catch(() => {});
      else await i.reply(payload).catch(() => {});
    }
  }
}

const startedAt = Date.now();
let startupError: string | null = null;

async function main() {
  startHealthServer(() => ({
    statut: client.isReady() ? "connecté" : startupError ? "erreur" : "démarrage",
    ...(startupError ? { erreur: startupError } : {}),
    serveurs: client.isReady() ? client.guilds.cache.size : 0,
    depuis: Math.round((Date.now() - startedAt) / 1000),
    memoireMo: Math.round(process.memoryUsage().rss / 1048576),
  }));
  await prepareEnvironment();
  bind();
  try {
    await client.login(config.token);
  } catch (e) {
    if (config.memberEvents && String(e).includes("disallowed intents")) {
      console.warn("⚠️ L’intention « Server Members » n’est pas activée dans le portail développeur : bienvenue et logs d’arrivées désactivés.");
      client = createClient(false);
      bind();
      await client.login(config.token);
    } else throw e;
  }
}

const shutdown = async () => {
  console.log("Arrêt du bot…");
  await client.destroy();
  await closeDb();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("unhandledRejection", (e) => void logError("bot", "Promesse rejetée non gérée", { error: e }));

/** Explique en français les causes de démarrage raté les plus courantes. */
function explainStartupError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/invalid token|TokenInvalid/i.test(msg)) return "Jeton du bot invalide : régénérez-le (portail développeur → Bot) et mettez à jour DISCORD_BOT_TOKEN.";
  if (/disallowed intents/i.test(msg)) return "Intention refusée par Discord : activez « Server Members Intent » (portail développeur → Bot) ou mettez BOT_MEMBER_EVENTS=false.";
  if (/password authentication|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|getaddrinfo|Tenant or user not found/i.test(msg))
    return `Base de données injoignable : vérifiez DATABASE_URL (${msg}).`;
  return msg;
}

main().catch((e) => {
  startupError = explainStartupError(e);
  console.error("❌ Démarrage impossible :", startupError);
  // L’erreur reste lisible sur /sante quelques minutes, puis le processus s’arrête :
  // l’hôte (cron Cloudflare, Docker restart…) relance une tentative propre.
  setTimeout(() => process.exit(1), process.env.PORT ? 4 * 60_000 : 0);
});
