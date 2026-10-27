// Active la liaison Hyperdrive dans apps/web/wrangler.jsonc si HYPERDRIVE_ID est défini.
import { readFileSync, writeFileSync } from "node:fs";

const id = process.env.HYPERDRIVE_ID?.trim();
if (!id) {
  console.log("Hyperdrive non configuré : connexion directe à la base.");
  process.exit(0);
}
const file = "apps/web/wrangler.jsonc";
const src = readFileSync(file, "utf8");
const line = /\/\/\s*,"hyperdrive": \[\{ "binding": "HYPERDRIVE", "id": "VOTRE_ID_HYPERDRIVE" \}\]/;
if (!line.test(src)) throw new Error(`Ligne Hyperdrive introuvable dans ${file}.`);
writeFileSync(file, src.replace(line, `,"hyperdrive": [{ "binding": "HYPERDRIVE", "id": ${JSON.stringify(id)} }]`));
console.log("Hyperdrive activé.");
