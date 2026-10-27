import { Container, getContainer } from "@cloudflare/containers";

/**
 * Hôte du bot Make Your Server sur Cloudflare.
 *
 * Le bot (passerelle Discord + worker de la file de tâches) a besoin d’un processus
 * permanent : il tourne dans un Cloudflare Container (image apps/bot/Dockerfile).
 * Un déclencheur planifié (cron) le démarre s’il est arrêté et renouvelle son activité,
 * pour qu’il ne s’endorme pas. Une seule instance tourne (nommée « bot »).
 */

interface Env {
  BOT: DurableObjectNamespace<BotContainer>;
  // Secrets (wrangler secret put …) transmis au conteneur
  DATABASE_URL: string;
  DISCORD_BOT_TOKEN: string;
  DISCORD_CLIENT_ID: string;
  APP_URL: string;
  BOT_MEMBER_EVENTS?: string;
  DISCORD_DEV_GUILD_ID?: string;
}

export class BotContainer extends Container<Env> {
  defaultPort = 8080;
  // Renouvelé toutes les 5 minutes par le cron : le conteneur ne s’arrête que si le cron cesse.
  sleepAfter = "30m";
  enableInternet = true;

  constructor(ctx: DurableObjectState<Record<string, never>>, env: Env) {
    super(ctx, env);
    this.envVars = {
      NODE_ENV: "production",
      PORT: "8080",
      RUN_MIGRATIONS: "true",
      REGISTER_COMMANDS: "true",
      DATABASE_URL: env.DATABASE_URL,
      DISCORD_BOT_TOKEN: env.DISCORD_BOT_TOKEN,
      DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID,
      APP_URL: env.APP_URL,
      BOT_MEMBER_EVENTS: env.BOT_MEMBER_EVENTS ?? "true",
      ...(env.DISCORD_DEV_GUILD_ID ? { DISCORD_DEV_GUILD_ID: env.DISCORD_DEV_GUILD_ID } : {}),
    };
  }

  override onStart() {
    console.log("Conteneur du bot démarré.");
  }

  override onStop(params: { exitCode?: number; reason?: string }) {
    console.log(`Conteneur du bot arrêté (code ${params.exitCode ?? "?"}, ${params.reason ?? "raison inconnue"}).`);
  }

  override onError(error: unknown) {
    console.error("Erreur du conteneur du bot :", error);
    throw error;
  }
}

const bot = (env: Env) => getContainer(env.BOT, "bot");

export default {
  /** /sante : état du bot (démarre le conteneur si besoin). Aucune donnée sensible exposée. */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/sante") return bot(env).fetch(new Request("http://bot/sante"));
    return new Response("Make Your Server — hôte du bot Discord. État : /sante", { headers: { "content-type": "text/plain; charset=utf-8" } });
  },

  /** Toutes les 5 minutes : démarre le bot s’il est arrêté et le maintient éveillé. */
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      bot(env)
        .fetch(new Request("http://bot/sante"))
        .then((r) => console.log(`Battement de cœur du bot : HTTP ${r.status}`))
        .catch((e) => console.error("Bot injoignable :", e)),
    );
  },
} satisfies ExportedHandler<Env>;
