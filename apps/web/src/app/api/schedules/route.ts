import { z } from "zod";
import { audit, backupSchedules, eq, getDb } from "@mys/db";
import { assertGuildAccess, getEntitlement, QuotaError } from "@mys/engine";
import { json, parseBody, withUser } from "@/lib/api";
import { getGateway } from "@/lib/gateway";

export const GET = withUser(async (_req, user) => {
  const rows = await getDb().select().from(backupSchedules).where(eq(backupSchedules.userId, user.id));
  return json({ schedules: rows });
});

const Body = z.object({
  guildId: z.string().regex(/^\d{17,20}$/),
  intervalHours: z.number().int().min(1).max(24 * 30),
  messageChannelIds: z.array(z.string().regex(/^\d{17,20}$/)).max(50).default([]),
});

/** Sauvegardes programmées (Premium) : une programmation par serveur. */
export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, Body);
  const ent = await getEntitlement(user.id);
  const q = ent.quotas;
  if (q.scheduledBackups === 0) throw new QuotaError("Les sauvegardes programmées sont réservées au Premium.");
  if (body.intervalHours < q.scheduleMinIntervalHours) throw new QuotaError(`Intervalle minimal pour votre offre : ${q.scheduleMinIntervalHours} h.`);
  if (body.messageChannelIds.length > q.messageBackupChannels) throw new QuotaError(`Votre offre permet d’exporter les messages de ${q.messageBackupChannels} salon(s).`);
  const existing = await getDb().select().from(backupSchedules).where(eq(backupSchedules.userId, user.id));
  if (!existing.some((s) => s.guildId === body.guildId) && existing.length >= q.scheduledBackups) throw new QuotaError(`Votre offre permet ${q.scheduledBackups} programmation(s).`);
  const gw = getGateway(user.discordId);
  const { guild } = await assertGuildAccess(gw, body.guildId, user.discordId, "manage");
  const values = { userId: user.id, guildId: body.guildId, guildName: guild.name, intervalHours: body.intervalHours, messageChannelIds: body.messageChannelIds, enabled: true, nextRunAt: new Date(Date.now() + 5 * 60_000) };
  const [row] = await getDb()
    .insert(backupSchedules)
    .values(values)
    .onConflictDoUpdate({ target: [backupSchedules.userId, backupSchedules.guildId], set: values })
    .returning();
  await audit({ actorUserId: user.id, actorType: "user", action: "schedule.save", targetType: "schedule", targetId: row!.id, guildId: body.guildId });
  return json({ schedule: row }, 201);
});
