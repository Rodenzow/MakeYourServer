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
  /** Adresse de contact affichée dans les conditions et la politique de confidentialité. */
  contactEmail: process.env.CONTACT_EMAIL ?? "",
  /** Éditeur du site (nom ou raison sociale), affiché dans les mentions légales. */
  legalEditor: process.env.LEGAL_EDITOR ?? "",
  /** Facultatif : jeton Cloudflare Web Analytics (mesure d’audience sans cookie). */
  cfAnalyticsToken: process.env.CF_ANALYTICS_TOKEN ?? "",
};

/** Jeton Cloudflare Web Analytics s’il est défini et bien formé, sinon null. */
export function analyticsToken() {
  const t = env.cfAnalyticsToken.trim();
  return /^[A-Za-z0-9_-]{8,128}$/.test(t) ? t : null;
}

export const discordConfigured = () => !!(env.discordClientId && env.discordClientSecret);
export const botConfigured = () => !!(env.discordBotToken && env.discordClientId) || env.sandbox;
