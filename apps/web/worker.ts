// Point d’entrée Cloudflare du site : enveloppe le Worker généré par OpenNext.
//
// 1. Quand un nom de domaine est configuré (APP_URL), l’ancienne adresse *.workers.dev
//    redirige vers lui : la connexion Discord ne fonctionne que sur l’adresse de APP_URL
//    (cookies liés au domaine, redirection OAuth déclarée).
// 2. Les pages publiques vues par un visiteur NON connecté sont mises en cache en
//    périphérie (Cache API) : affichage quasi instantané, rafraîchi en arrière-plan.
//    Un visiteur connecté (cookie de session) obtient toujours une page calculée pour lui.
// @ts-expect-error — fichier produit par `opennextjs-cloudflare build`
import handler from "./.open-next/worker.js";

// @ts-expect-error — idem
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

interface Ctx {
  waitUntil(p: Promise<unknown>): void;
}

const SESSION_COOKIE = "mys_session";
/** Pages publiques identiques pour tous les visiteurs non connectés. */
const PUBLIC_PAGES = [/^\/$/, /^\/templates$/, /^\/templates\/[a-z0-9-]{1,120}$/, /^\/fonctionnement$/, /^\/confidentialite$/, /^\/conditions$/, /^\/connexion$/, /^\/abonnement$/];
/** Au-delà, la page en cache est encore servie mais recalculée en arrière-plan. */
const FRESH_SECONDS = 30;
/** Durée maximale de conservation en cache. */
const MAX_AGE_SECONDS = 600;

function isCacheable(request: Request, url: URL) {
  if (request.method !== "GET") return false;
  if (!PUBLIC_PAGES.some((re) => re.test(url.pathname))) return false;
  // Navigations internes de Next.js (RSC), préchargements et actions serveur : jamais en cache.
  const h = request.headers;
  if (h.get("rsc") || h.get("next-router-prefetch") || h.get("next-action") || url.searchParams.has("_rsc")) return false;
  const cookie = h.get("cookie") ?? "";
  return !cookie.split(";").some((c) => c.trim().startsWith(`${SESSION_COOKIE}=`));
}

async function renderAndStore(request: Request, env: unknown, ctx: Ctx, cache: Cache, key: Request) {
  const res: Response = await handler.fetch(request, env, ctx);
  const type = res.headers.get("content-type") ?? "";
  if (res.status === 200 && type.includes("text/html") && !res.headers.has("set-cookie")) {
    const stored = new Response(res.clone().body, res);
    stored.headers.set("cache-control", `public, max-age=${MAX_AGE_SECONDS}`);
    stored.headers.set("x-mys-rendered-at", String(Date.now()));
    ctx.waitUntil(cache.put(key, stored));
  }
  return res;
}

export default {
  async fetch(request: Request, env: { APP_URL?: string; CF_VERSION_METADATA?: { id: string } }, ctx: Ctx) {
    const url = new URL(request.url);
    if (env.APP_URL && url.hostname.endsWith(".workers.dev")) {
      const target = new URL(env.APP_URL);
      if (target.hostname !== url.hostname) {
        return Response.redirect(`${target.origin}${url.pathname}${url.search}`, 308);
      }
    }

    const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
    if (!cache || !isCacheable(request, url)) return handler.fetch(request, env, ctx);

    // La version du déploiement fait partie de la clé : une page en cache ne référence
    // jamais les fichiers JavaScript d’un déploiement précédent.
    const keyUrl = new URL(url);
    keyUrl.searchParams.set("__v", env.CF_VERSION_METADATA?.id ?? "dev");
    const key = new Request(keyUrl.toString(), { method: "GET" });
    const hit = await cache.match(key);
    if (hit) {
      const age = (Date.now() - Number(hit.headers.get("x-mys-rendered-at") ?? 0)) / 1000;
      if (age > FRESH_SECONDS) ctx.waitUntil(renderAndStore(new Request(request), env, ctx, cache, key).catch(() => {}));
      const out = new Response(hit.body, hit);
      // Le navigateur ne doit pas garder la page : après connexion, il doit voir sa version.
      out.headers.set("cache-control", "private, no-cache");
      out.headers.set("x-mys-cache", age > FRESH_SECONDS ? "STALE" : "HIT");
      return out;
    }
    const res = await renderAndStore(request, env, ctx, cache, key);
    const out = new Response(res.body, res);
    out.headers.set("x-mys-cache", "MISS");
    return out;
  },
};
