import { closeDb } from "./client";
import { runMigrations } from "./migrate";

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
