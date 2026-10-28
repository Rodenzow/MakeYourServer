// Point d’entrée Cloudflare du site : enveloppe le Worker généré par OpenNext.
// Quand un nom de domaine est configuré (APP_URL), l’ancienne adresse *.workers.dev
// redirige vers lui : la connexion Discord ne fonctionne que sur l’adresse de APP_URL
// (cookies liés au domaine, redirection OAuth déclarée).
// @ts-expect-error — fichier produit par `opennextjs-cloudflare build`
import handler from "./.open-next/worker.js";

// @ts-expect-error — idem
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

export default {
  async fetch(request: Request, env: { APP_URL?: string }, ctx: unknown) {
    const url = new URL(request.url);
    if (env.APP_URL && url.hostname.endsWith(".workers.dev")) {
      const target = new URL(env.APP_URL);
      if (target.hostname !== url.hostname) {
        return Response.redirect(`${target.origin}${url.pathname}${url.search}`, 308);
      }
    }
    return handler.fetch(request, env, ctx);
  },
};
