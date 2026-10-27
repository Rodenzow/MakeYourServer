import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { closeDb, getDb } from "./client";

const here = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  await migrate(getDb(), { migrationsFolder: path.join(here, "..", "migrations") });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigrations()
    .then(async () => {
      console.log("✅ Migrations appliquées.");
      await closeDb();
    })
    .catch(async (e) => {
      console.error("❌ Échec des migrations :", e);
      await closeDb();
      process.exit(1);
    });
}
