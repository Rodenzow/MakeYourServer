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

/** Connexion partagée (réutilisée entre rechargements à chaud en développement). */
export function getDb(): Database {
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
