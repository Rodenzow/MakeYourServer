import "server-only";

/** Lecture centralisée des variables d’environnement côté serveur. */
export const env = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  discordClientId: process.env.DISCORD_CLIENT_ID ?? "",
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
  discordBotToken: process.env.DISCORD_BOT_TOKEN ?? "",
  encryptionKey: process.env.APP_ENCRYPTION_KEY ?? "",
  adminDiscordIds: (process.env.ADMIN_DISCORD_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  /** Connexion de développement sans Discord : refusée en production. */
  devLogin: process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "true",
  /** Serveur Discord simulé (persisté en base) pour tester le parcours sans bot réel. */
  sandbox: process.env.DISCORD_SANDBOX === "true",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  aiProvider: (process.env.AI_PROVIDER ?? "anthropic") as "anthropic" | "mock",
};

export const discordConfigured = () => !!(env.discordClientId && env.discordClientSecret);
export const botConfigured = () => !!(env.discordBotToken && env.discordClientId) || env.sandbox;
