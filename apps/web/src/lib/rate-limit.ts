/**
 * Limites anti-abus des API, appliquées par worker.ts AVANT le site (Cloudflare Workers
 * Rate Limiting, liaisons « ratelimits » de wrangler.jsonc). Compteurs par adresse IP,
 * par minute et par emplacement Cloudflare : une protection contre les rafales, pas un quota.
 *
 * Sans liaison (développement local, `next start`, tests e2e), rien n’est bloqué.
 */

/** Liaison Workers Rate Limiting. */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface RateLimitEnv {
  /** Limite générale : toutes les écritures vers /api/* (60 par minute). */
  RATE_LIMIT_API?: RateLimiter;
  /** Fonctions d’IA : /api/ai/* (10 par minute). */
  RATE_LIMIT_AI?: RateLimiter;
  /** Signalements de templates : /api/templates/<slug>/report (5 par minute). */
  RATE_LIMIT_REPORT?: RateLimiter;
}

const LIMITED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
/** Jamais limités : webhook Stripe (rejoué par Stripe) et connexion Discord. */
const EXEMPT = [/^\/api\/billing\/webhook\/?$/, /^\/api\/auth(\/|$)/];

/** Liaisons à consulter pour cette requête (de la plus stricte à la plus large). */
export function limitersFor(method: string, pathname: string, env: RateLimitEnv): { name: string; limiter: RateLimiter }[] {
  if (!LIMITED_METHODS.has(method.toUpperCase())) return [];
  if (!pathname.startsWith("/api/") || EXEMPT.some((re) => re.test(pathname))) return [];
  const out: { name: string; limiter: RateLimiter }[] = [];
  if (env.RATE_LIMIT_AI && /^\/api\/ai\//.test(pathname)) out.push({ name: "ai", limiter: env.RATE_LIMIT_AI });
  if (env.RATE_LIMIT_REPORT && /^\/api\/templates\/[^/]+\/report\/?$/.test(pathname)) out.push({ name: "report", limiter: env.RATE_LIMIT_REPORT });
  if (env.RATE_LIMIT_API) out.push({ name: "api", limiter: env.RATE_LIMIT_API });
  return out;
}

const MESSAGES: Record<string, string> = {
  ai: "Trop de demandes à l’IA en peu de temps. Patientez une minute avant de réessayer.",
  report: "Trop de signalements en peu de temps. Patientez une minute avant de réessayer.",
  api: "Trop de requêtes en peu de temps. Patientez une minute avant de réessayer.",
};

/**
 * Renvoie une réponse 429 si une limite est dépassée, sinon null.
 * En cas d’erreur de la liaison, la requête passe (on ne bloque jamais par erreur).
 */
export async function checkRateLimit(request: Request, pathname: string, env: RateLimitEnv): Promise<Response | null> {
  const limiters = limitersFor(request.method, pathname, env);
  if (!limiters.length) return null;
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "inconnue";
  for (const { name, limiter } of limiters) {
    let ok = true;
    try {
      ok = (await limiter.limit({ key: `${name}:${ip}` })).success;
    } catch {
      ok = true;
    }
    if (!ok) {
      return new Response(JSON.stringify({ error: MESSAGES[name], code: "rate_limited" }), {
        status: 429,
        headers: { "content-type": "application/json; charset=utf-8", "retry-after": "60", "cache-control": "no-store" },
      });
    }
  }
  return null;
}
