import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getDb } from "./client";

const here = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  // MIGRATIONS_DIR : utilisé par l’image Docker du bot (code regroupé en un seul fichier).
  await migrate(getDb(), { migrationsFolder: process.env.MIGRATIONS_DIR ?? path.join(here, "..", "migrations") });
}
