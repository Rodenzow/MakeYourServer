/**
 * Validation sur un VRAI serveur Discord de test.
 *
 *   DISCORD_TEST_GUILD_ID=… pnpm test:discord [slug-du-template] [--simulation] [--vide]
 *
 * - Installe le template (par défaut « communaute ») sur le serveur de test avec le
 *   moteur réel, puis relance une analyse pour vérifier qu’aucun doublon ne serait créé.
 * - --simulation : rejoue l’installation sur une copie en mémoire (aucune écriture Discord).
 * - --vide : mode « Serveur vide » avec archivage des salons existants.
 * ⚠️ Sans --simulation, le serveur de test est réellement modifié : utilisez un serveur dédié.
 */
import { ServerSpecSchema } from "@mys/core";
import { OFFICIAL_TEMPLATES } from "@mys/core/templates";
import { closeDb, getDb, installationSteps, eq, projects, users, asc } from "@mys/db";
import { DiscordRestGateway, FakeGateway, buildPlanForCheck, confirmInstallation, prepareInstallation, runInstallation } from "./test-discord-lib";

const token = process.env.DISCORD_BOT_TOKEN;
const appId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_TEST_GUILD_ID;
if (!token || !appId || !guildId || !process.env.DATABASE_URL) {
  console.error("Variables requises : DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_TEST_GUILD_ID, DATABASE_URL.");
  process.exit(1);
}
const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--")) ?? "communaute";
const simulation = args.includes("--simulation");
const empty = args.includes("--vide");

const template = OFFICIAL_TEMPLATES.find((t) => t.slug === slug);
if (!template) {
  console.error(`Template inconnu : ${slug}. Disponibles : ${OFFICIAL_TEMPLATES.map((t) => t.slug).join(", ")}`);
  process.exit(1);
}

const real = DiscordRestGateway.fromToken(token, appId);
const guild = await real.fetchGuild(guildId);
console.log(`Serveur de test : ${guild.name} (${guild.id}) — propriétaire ${guild.ownerId}`);

const db = getDb();
const [owner] = await db
  .insert(users)
  .values({ discordId: guild.ownerId, username: "proprietaire-test" })
  .onConflictDoUpdate({ target: users.discordId, set: { lastLoginAt: new Date() } })
  .returning();
const [project] = await db
  .insert(projects)
  .values({ userId: owner!.id, name: `[test] ${template.name}`, sourceType: "template", spec: ServerSpecSchema.parse(template.spec) })
  .returning();

const options = empty ? { mode: "empty" as const, existingChannels: "archive" as const } : { mode: "merge" as const };
const { installation, plan } = await prepareInstallation(real, { userId: owner!.id, guildId, source: { projectId: project!.id }, options, dryRun: simulation });
console.log(`Analyse : ${plan.summary.create} créations, ${plan.summary.update} modifications, ${plan.conflicts.length} conflits, ${plan.blockers.length} blocages.`);
if (plan.blockers.length) {
  plan.blockers.forEach((b) => console.error(`  ⛔ ${b.message}`));
  await closeDb();
  process.exit(1);
}
await confirmInstallation(real, { installationId: installation.id, userId: owner!.id, confirmDestructive: false });
const gateway = simulation ? FakeGateway.fromState(await real.fetchState(guildId), appId) : real;
if (simulation) (gateway as FakeGateway).members.set(guild.ownerId, []);
const result = await runInstallation(installation.id, { gateway, onProgress: () => void process.stdout.write(".") });
console.log(`\nRésultat : ${result.status}${result.error ? ` — ${result.error}` : ""}`);
const steps = await db.select().from(installationSteps).where(eq(installationSteps.installationId, installation.id)).orderBy(asc(installationSteps.seq));
for (const s of steps.filter((x) => x.status === "failed")) console.log(`  ❌ ${s.label} : ${s.error}`);

if (!simulation) {
  const check = await buildPlanForCheck(real, guildId, project!.id, owner!.id);
  const dupes = check.ops.filter((o) => o.kind.endsWith(".create") || o.kind === "message.send");
  console.log(dupes.length === 0 ? "✅ Relance vérifiée : aucune création en double." : `⚠️ ${dupes.length} opération(s) de création à la relance.`);
}
await closeDb();
process.exit(result.status === "succeeded" ? 0 : 1);
