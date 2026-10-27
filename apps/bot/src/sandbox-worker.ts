import { createSandboxGateway, startWorker } from "@mys/engine";

/**
 * Worker du bac à sable : exécute les installations sur le serveur simulé
 * (DISCORD_SANDBOX=true), sans connexion à Discord. Pour le développement et les tests.
 */
if (process.env.DISCORD_SANDBOX !== "true") {
  console.error("Ce worker ne fonctionne qu’avec DISCORD_SANDBOX=true.");
  process.exit(1);
}
startWorker({ gateway: createSandboxGateway(), instanceId: `sandbox-${process.pid}`, heartbeat: () => ({ guildCount: 1, gatewayStatus: "bac à sable" }) });
console.log("🧪 Worker du bac à sable démarré.");
