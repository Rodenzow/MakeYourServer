import { Container, getContainer } from "@cloudflare/containers";
import { decideHealth, INITIAL_HEALTH, isDiscordWebhook, minutes, scrub, type HealthState } from "./health";

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
  /** Facultatif : webhook Discord du salon des administrateurs (alertes). */
  ALERT_WEBHOOK_URL?: string;
}

const CONFIG_KEY = "configFingerprint";
const HEALTH_KEY = "healthState";

/** Envoie un message au webhook Discord des administrateurs. Ne lève jamais d’erreur. */
async function sendAlert(webhookUrl: string | undefined, embed: { title: string; description: string; color: number; fields?: { name: string; value: string; inline?: boolean }[] }) {
  if (!isDiscordWebhook(webhookUrl)) return false;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "Make Your Server — alertes", allowed_mentions: { parse: [] }, embeds: [{ ...embed, timestamp: new Date().toISOString() }] }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) console.warn(`Alerte refusée par Discord (HTTP ${res.status}).`);
    return res.ok;
  } catch {
    // L’adresse du webhook contient un secret : elle n’est jamais écrite dans les journaux.
    console.warn("Alerte impossible à envoyer.");
    return false;
  }
}

async function fingerprint(values: Record<string, string>): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(Object.entries(values).sort(([a], [b]) => a.localeCompare(b))));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type NativeContainer = NonNullable<DurableObjectState["container"]>;

/** Nom de l’image dans wrangler.jsonc (containers[].images). */
const BOT_IMAGE = "bot";
/** lite = 1/16 vCPU, 256 Mio. Si le bot manque de mémoire : "standard-1" (1/2 vCPU, 4 Gio). */
const BOT_INSTANCE = "lite";

export class BotContainer extends Container<Env> {
  defaultPort = 8080;
  // Renouvelé toutes les 5 minutes par le cron : le conteneur ne s’arrête que si le cron cesse.
  sleepAfter = "30m";
  enableInternet = true;

  constructor(ctx: DurableObjectState<Record<string, never>>, env: Env) {
    super(ctx, env);
    // Politique « durable_object » (imposée aux nouveaux comptes) : l’image et le type
    // d’instance se choisissent au démarrage. La bibliothèque ne les transmet pas encore,
    // on les ajoute à chaque appel de start().
    const native = ctx.container!;
    (this as unknown as { container: NativeContainer }).container = new Proxy(native, {
      get(target, prop) {
        if (prop === "start") {
          return (options: ContainerStartupOptions) =>
            target.start({ ...options, image: target.images[BOT_IMAGE], instance: BOT_INSTANCE } as ContainerStartupOptions);
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    this.envVars = {
      NODE_ENV: "production",
      PORT: "8080",
      RUN_MIGRATIONS: "true",
      // Le site partage la même base : un petit pool laisse des connexions au pooler.
      DATABASE_POOL_SIZE: "5",
      REGISTER_COMMANDS: "true",
      DATABASE_URL: env.DATABASE_URL,
      DISCORD_BOT_TOKEN: env.DISCORD_BOT_TOKEN,
      DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID,
      APP_URL: env.APP_URL,
      BOT_MEMBER_EVENTS: env.BOT_MEMBER_EVENTS ?? "true",
      ...(env.DISCORD_DEV_GUILD_ID ? { DISCORD_DEV_GUILD_ID: env.DISCORD_DEV_GUILD_ID } : {}),
      ...(env.ALERT_WEBHOOK_URL ? { ALERT_WEBHOOK_URL: env.ALERT_WEBHOOK_URL } : {}),
    };
  }

  /**
   * Mémorise le résultat d’un contrôle (cron) et prévient les administrateurs :
   * une alerte quand le bot n’est plus « connecté » deux contrôles de suite, puis un
   * message quand il est rétabli. Rien n’est répété à chaque contrôle.
   */
  async recordHealth(statut: string, detail?: string): Promise<HealthState> {
    const now = Date.now();
    const prev = (await this.ctx.storage.get<HealthState>(HEALTH_KEY)) ?? INITIAL_HEALTH;
    const decision = decideHealth(prev, statut, now);
    let sent = true;
    if (decision.alert === "down") {
      const fields = [{ name: "État", value: scrub(statut) || "inconnu" }];
      if (detail) fields.push({ name: "Détail", value: scrub(detail) });
      sent = await sendAlert(this.env.ALERT_WEBHOOK_URL, {
        title: "🔴 Le bot n’est plus connecté à Discord",
        description: `${decision.next.failures} contrôles de suite en échec (depuis environ ${minutes(now - (decision.next.since ?? now))} minute(s)). Journaux : Workers & Pages → make-your-server-bot → Logs.`,
        color: 0xff5f57,
        fields,
      });
    } else if (decision.alert === "up") {
      sent = await sendAlert(this.env.ALERT_WEBHOOK_URL, {
        title: "🟢 Le bot est de nouveau connecté à Discord",
        description: `Rétabli après environ ${minutes(now - (prev.since ?? now))} minute(s) d’interruption.`,
        color: 0x5fd39a,
      });
    }
    // Sans webhook configuré : l’état est suivi, mais aucune alerte n’est « en attente ».
    const next = !isDiscordWebhook(this.env.ALERT_WEBHOOK_URL) ? { ...decision.next, alerted: false } : sent ? decision.next : decision.ifUnsent;
    await this.ctx.storage.put(HEALTH_KEY, next);
    return next;
  }

  /**
   * Redémarre le bot si sa configuration (secrets, adresse du site…) a changé depuis
   * son démarrage : sans cela, un conteneur déjà lancé garderait les anciennes valeurs.
   */
  async refreshIfConfigChanged(): Promise<boolean> {
    const digest = await fingerprint(this.envVars ?? {});
    if ((await this.ctx.storage.get<string>(CONFIG_KEY)) === digest) return false;
    await this.ctx.storage.put(CONFIG_KEY, digest);
    if (!this.ctx.container?.running) return false;
    console.log("Configuration du bot modifiée : redémarrage.");
    await this.stop("SIGTERM");
    for (let i = 0; i < 30 && this.ctx.container?.running; i++) await new Promise((r) => setTimeout(r, 1000));
    if (this.ctx.container?.running) await this.destroy();
    return true;
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
    if (url.pathname === "/sante") {
      const stub = bot(env);
      await stub.refreshIfConfigChanged();
      return stub.fetch(new Request("http://bot/sante"));
    }
    return new Response("Make Your Server — hôte du bot Discord. État : /sante", { headers: { "content-type": "text/plain; charset=utf-8" } });
  },

  /** Toutes les 5 minutes : démarre le bot s’il est arrêté, le maintient éveillé et applique une nouvelle configuration. */
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const stub = bot(env);
    ctx.waitUntil(
      (async () => {
        let statut = "injoignable";
        let detail: string | undefined;
        try {
          await stub.refreshIfConfigChanged();
          const r = await stub.fetch(new Request("http://bot/sante"));
          console.log(`Battement de cœur du bot : HTTP ${r.status}`);
          const body = (await r.json().catch(() => null)) as { statut?: string; erreur?: string } | null;
          statut = body?.statut ?? `HTTP ${r.status}`;
          detail = body?.erreur;
        } catch (e) {
          console.error("Bot injoignable :", e);
          detail = e instanceof Error ? e.message : String(e);
        }
        await stub.recordHealth(statut, detail).catch((e) => console.error("Suivi de l’état impossible :", e));
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
