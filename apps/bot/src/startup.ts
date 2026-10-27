import { createServer } from "node:http";
import { REST, Routes } from "discord.js";
import { runMigrations } from "@mys/db/migrate";
import { seed } from "@mys/db/seed";
import { commands } from "./commands";
import { config } from "./config";

/**
 * Démarrage en conteneur (Cloudflare Containers, Docker…) :
 * - point de santé HTTP (PORT) interrogé par l’hôte pour garder le bot éveillé ;
 * - migrations et données initiales (RUN_MIGRATIONS=true), idempotentes ;
 * - enregistrement des commandes /mys (REGISTER_COMMANDS=true), idempotent.
 */
export function startHealthServer(status: () => Record<string, unknown>) {
  const port = Number(process.env.PORT);
  if (!port) return;
  createServer((req, res) => {
    const body = JSON.stringify({ service: "make-your-server-bot", ...status() });
    res.writeHead(req.url === "/sante" || req.url === "/" ? 200 : 404, { "content-type": "application/json" });
    res.end(body);
  }).listen(port, () => console.log(`Point de santé sur le port ${port}.`));
}

export async function prepareEnvironment() {
  if (process.env.RUN_MIGRATIONS === "true") {
    await runMigrations();
    const r = await seed();
    console.log(`✅ Base à jour (${r.templates} templates officiels).`);
  }
  if (process.env.REGISTER_COMMANDS === "true") {
    const rest = new REST({ version: "10" }).setToken(config.token);
    const route = config.devGuildId ? Routes.applicationGuildCommands(config.applicationId, config.devGuildId) : Routes.applicationCommands(config.applicationId);
    await rest.put(route, { body: commands });
    console.log("✅ Commandes /mys enregistrées.");
  }
}
