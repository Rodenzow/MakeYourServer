function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`❌ Variable d’environnement manquante : ${name}. Voir .env.example.`);
    process.exit(1);
  }
  return v;
}

export const config = {
  token: required("DISCORD_BOT_TOKEN"),
  applicationId: required("DISCORD_CLIENT_ID"),
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  /** Serveur de développement : les commandes y sont enregistrées instantanément. */
  devGuildId: process.env.DISCORD_DEV_GUILD_ID || undefined,
  /** Intention privilégiée « Server Members » : nécessaire au message de bienvenue et aux logs d’arrivées. */
  memberEvents: process.env.BOT_MEMBER_EVENTS !== "false",
};
