import { closeDb } from "./client";
import { seed } from "./seed";

seed()
  .then(async (r) => {
    console.log(`✅ Seed terminé (${r.templates} templates officiels).`);
    await closeDb();
  })
  .catch(async (e) => {
    console.error("❌ Échec du seed :", e);
    await closeDb();
    process.exit(1);
  });
