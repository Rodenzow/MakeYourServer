// Écrit un fichier JSON de secrets pour `wrangler secret bulk` à partir des variables
// d’environnement nommées. Les valeurs vides sont ignorées ; rien n’est affiché.
// Usage : node scripts/ci/secrets-json.mjs <sortie.json> NOM1 NOM2 …
import { writeFileSync } from "node:fs";

const [out, ...names] = process.argv.slice(2);
const secrets = {};
for (const name of names) {
  const value = process.env[name];
  if (value !== undefined && value.trim() !== "") secrets[name] = value.trim();
}
writeFileSync(out, JSON.stringify(secrets), { mode: 0o600 });
console.log(`${Object.keys(secrets).length} secret(s) préparé(s) : ${Object.keys(secrets).join(", ")}`);
