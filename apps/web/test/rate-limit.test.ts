import { describe, expect, it } from "vitest";
import { checkRateLimit, limitersFor, type RateLimiter } from "../src/lib/rate-limit";

/** Limiteur en mémoire : `max` requêtes par clé. */
function fakeLimiter(max: number): RateLimiter & { keys: string[] } {
  const counts = new Map<string, number>();
  const keys: string[] = [];
  return {
    keys,
    async limit({ key }) {
      keys.push(key);
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return { success: n <= max };
    },
  };
}

const req = (method: string, path: string, ip = "203.0.113.7") => new Request(`https://exemple.test${path}`, { method, headers: { "cf-connecting-ip": ip } });

describe("limites anti-abus", () => {
  it("ne limite que les écritures vers /api/*, hors webhook Stripe et connexion", () => {
    const env = { RATE_LIMIT_API: fakeLimiter(1), RATE_LIMIT_AI: fakeLimiter(1), RATE_LIMIT_REPORT: fakeLimiter(1) };
    expect(limitersFor("GET", "/api/projects", env)).toEqual([]);
    expect(limitersFor("POST", "/templates/x", env)).toEqual([]);
    expect(limitersFor("POST", "/api/billing/webhook", env)).toEqual([]);
    expect(limitersFor("POST", "/api/auth/logout", env)).toEqual([]);
    expect(limitersFor("GET", "/api/auth/callback", env)).toEqual([]);
    expect(limitersFor("POST", "/api/projects", env).map((l) => l.name)).toEqual(["api"]);
    expect(limitersFor("DELETE", "/api/projects/1", env).map((l) => l.name)).toEqual(["api"]);
    expect(limitersFor("POST", "/api/ai/generate", env).map((l) => l.name)).toEqual(["ai", "api"]);
    expect(limitersFor("POST", "/api/templates/mon-serveur/report", env).map((l) => l.name)).toEqual(["report", "api"]);
    expect(limitersFor("POST", "/api/templates/mon-serveur/save", env).map((l) => l.name)).toEqual(["api"]);
  });

  it("ne bloque rien sans liaison (local, e2e)", async () => {
    expect(await checkRateLimit(req("POST", "/api/ai/generate"), "/api/ai/generate", {})).toBeNull();
  });

  it("répond 429 en JSON français au-delà de la limite, par adresse IP", async () => {
    const env = { RATE_LIMIT_API: fakeLimiter(100), RATE_LIMIT_AI: fakeLimiter(2) };
    const path = "/api/ai/edit";
    expect(await checkRateLimit(req("POST", path), path, env)).toBeNull();
    expect(await checkRateLimit(req("POST", path), path, env)).toBeNull();
    const res = await checkRateLimit(req("POST", path), path, env);
    expect(res?.status).toBe(429);
    expect(res?.headers.get("retry-after")).toBe("60");
    const body = (await res!.json()) as { error: string; code: string };
    expect(body.code).toBe("rate_limited");
    expect(body.error).toMatch(/IA/);
    // Une autre adresse IP n’est pas concernée.
    expect(await checkRateLimit(req("POST", path, "198.51.100.1"), path, env)).toBeNull();
    expect(env.RATE_LIMIT_AI.keys[0]).toBe("ai:203.0.113.7");
  });

  it("laisse passer si la liaison échoue", async () => {
    const broken: RateLimiter = { limit: async () => Promise.reject(new Error("panne")) };
    expect(await checkRateLimit(req("POST", "/api/projects"), "/api/projects", { RATE_LIMIT_API: broken })).toBeNull();
  });
});
