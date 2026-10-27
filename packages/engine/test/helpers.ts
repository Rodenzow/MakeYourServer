import { closeDb, getDb, sql, users, projects } from "@mys/db";
import { runMigrations } from "../../db/src/migrate";
import { seed } from "../../db/src/seed";
import { ServerSpecSchema, type ServerSpec } from "@mys/core";
import { OFFICIAL_TEMPLATES } from "@mys/core/templates";

export const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgres://mys:mys@localhost:5432/mys_test";

export async function setupDb() {
  process.env.DATABASE_URL = TEST_DB;
  await runMigrations();
  await resetDb();
  await seed();
}

export async function resetDb() {
  await getDb().execute(sql`truncate users, templates, plans, jobs, installations, installation_steps, resource_mappings, backups, backup_messages, backup_schedules, guild_features, audit_logs, error_logs, usage_counters, subscriptions, webhook_events, app_settings, bot_guilds, worker_heartbeats cascade`);
  await seed();
}

export async function teardownDb() {
  await closeDb();
}

export async function createUser(discordId: string, name = "Testeur") {
  const [u] = await getDb().insert(users).values({ discordId, username: name }).returning();
  return u!;
}

export function templateSpec(slug: string): ServerSpec {
  const t = OFFICIAL_TEMPLATES.find((x) => x.slug === slug)!;
  return ServerSpecSchema.parse(t.spec);
}

export async function createProject(userId: string, spec: ServerSpec) {
  const [p] = await getDb().insert(projects).values({ userId, name: spec.meta.name, sourceType: "template", spec }).returning();
  return p!;
}
