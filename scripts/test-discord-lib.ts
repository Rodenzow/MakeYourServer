import { buildPlan } from "@mys/core";
import { and, eq, getDb, projects, resourceMappings } from "@mys/db";
import type { GuildGateway } from "@mys/engine";

export { DiscordRestGateway, FakeGateway, confirmInstallation, prepareInstallation, runInstallation } from "@mys/engine";

/** Recalcule le plan après installation pour vérifier l’absence de doublons. */
export async function buildPlanForCheck(gateway: GuildGateway, guildId: string, projectId: string, userId: string) {
  const db = getDb();
  const [p] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  const rows = await db.select().from(resourceMappings).where(and(eq(resourceMappings.guildId, guildId), eq(resourceMappings.scopeId, `project:${projectId}`)));
  const state = await gateway.fetchState(guildId);
  return buildPlan({ spec: p!.spec, state, mapping: Object.fromEntries(rows.map((r) => [r.localId, r.discordId])), options: { mode: "merge" } });
}
