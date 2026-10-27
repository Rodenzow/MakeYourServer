import { REST, Routes } from "discord.js";
import { commands } from "./commands";
import { config } from "./config";

/** Enregistre les commandes : sur le serveur de développement (instantané) ou globalement. */
const rest = new REST({ version: "10" }).setToken(config.token);
const route = config.devGuildId ? Routes.applicationGuildCommands(config.applicationId, config.devGuildId) : Routes.applicationCommands(config.applicationId);
await rest.put(route, { body: commands });
console.log(`✅ Commandes enregistrées ${config.devGuildId ? `sur le serveur ${config.devGuildId}` : "globalement (propagation de quelques minutes)"}.`);
