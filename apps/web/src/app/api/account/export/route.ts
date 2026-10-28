import { backups, desc, eq, getDb, installations, projects, templates } from "@mys/db";
import { withUser } from "@/lib/api";

/** Export des données du compte (droit d’accès et de portabilité), au format JSON. */
export const GET = withUser(async (_req, user) => {
  const db = getDb();
  const [proj, backs, inst, pubs] = await Promise.all([
    db.select({ id: projects.id, name: projects.name, createdAt: projects.createdAt, updatedAt: projects.updatedAt, spec: projects.spec }).from(projects).where(eq(projects.userId, user.id)),
    db
      .select({ id: backups.id, guildId: backups.guildId, guildName: backups.guildName, kind: backups.kind, label: backups.label, version: backups.version, summary: backups.summary, createdAt: backups.createdAt })
      .from(backups)
      .where(eq(backups.userId, user.id))
      .orderBy(desc(backups.createdAt)),
    db.select({ id: installations.id, guildId: installations.guildId, guildName: installations.guildName, status: installations.status, createdAt: installations.createdAt }).from(installations).where(eq(installations.userId, user.id)),
    db
      .select({ id: templates.id, name: templates.name, status: templates.status, viewCount: templates.viewCount, installCount: templates.installCount, submittedAt: templates.submittedAt })
      .from(templates)
      .where(eq(templates.authorUserId, user.id)),
  ]);
  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      account: { discordId: user.discordId, username: user.username, globalName: user.globalName, createdAt: user.createdAt },
      projects: proj,
      backups: backs,
      installations: inst,
      publications: pubs,
    },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="make-your-server-${user.discordId}.json"`,
      "cache-control": "no-store",
    },
  });
});
