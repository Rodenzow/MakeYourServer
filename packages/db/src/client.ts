import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __mysSql?: postgres.Sql; __mysDb?: Database };

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL n’est pas défini. Copiez .env.example vers .env et renseignez la connexion PostgreSQL.");
  return url;
}

/**
 * Sur Cloudflare Workers, une connexion ne peut pas être partagée entre deux requêtes :
 * on crée un client par requête, rattaché au contexte de la requête (exposé par OpenNext
 * sous ce symbole). Hyperdrive est utilisé s’il est configuré (pool de connexions géré).
 */
const CLOUDFLARE_CONTEXT = Symbol.for("__cloudflare-context__");
const perRequest = new WeakMap<object, Database>();

interface CloudflareRequestContext {
  env?: { HYPERDRIVE?: { connectionString: string }; DATABASE_URL?: string };
}

function cloudflareDb(cf: CloudflareRequestContext): Database {
  let db = perRequest.get(cf);
  if (!db) {
    const url = cf.env?.HYPERDRIVE?.connectionString ?? cf.env?.DATABASE_URL ?? getDatabaseUrl();
    // connect_timeout court : sur Workers, mieux vaut une erreur rapide qu’une page bloquée 30 s.
    const sql = postgres(url, { max: 1, fetch_types: false, connect_timeout: 10, onnotice: () => {} });
    db = drizzle(sql, { schema });
    perRequest.set(cf, db);
  }
  return db;
}

/** Connexion partagée (réutilisée entre rechargements à chaud en développement). */
export function getDb(): Database {
  const cf = (globalThis as Record<symbol, CloudflareRequestContext | undefined>)[CLOUDFLARE_CONTEXT];
  if (cf) return cloudflareDb(cf);
  if (!globalForDb.__mysDb) {
    globalForDb.__mysSql = postgres(getDatabaseUrl(), {
      max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
      onnotice: () => {},
    });
    globalForDb.__mysDb = drizzle(globalForDb.__mysSql, { schema });
  }
  return globalForDb.__mysDb;
}

export async function closeDb() {
  await globalForDb.__mysSql?.end({ timeout: 5 });
  globalForDb.__mysSql = undefined;
  globalForDb.__mysDb = undefined;
}

/** Proxy pratique : `db.select()…` sans appeler getDb() partout. */
export const db: Database = new Proxy({} as Database, {
  get(_t, prop) {
    return Reflect.get(getDb() as object, prop);
  },
});
