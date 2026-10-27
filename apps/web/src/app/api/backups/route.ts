import { z } from "zod";
import { assertGuildAccess, createBackup, listBackups } from "@mys/engine";
import { json, parseBody, withUser } from "@/lib/api";
import { getGateway } from "@/lib/gateway";

/** Les sauvegardes ne sont listées que pour leur propriétaire. */
export const GET = withUser(async (req, user) => {
  const guildId = req.nextUrl.searchParams.get("serveur") ?? undefined;
  return json({ backups: await listBackups(user.id, guildId) });
});

const Body = z.object({
  guildId: z.string().regex(/^\d{17,20}$/),
  label: z.string().max(80).optional(),
  messageChannelIds: z.array(z.string().regex(/^\d{17,20}$/)).max(50).optional(),
});

export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, Body);
  const gw = getGateway(user.discordId);
  await assertGuildAccess(gw, body.guildId, user.discordId, "manage");
  const b = await createBackup(gw, { userId: user.id, guildId: body.guildId, kind: "manual", label: body.label, messageChannelIds: body.messageChannelIds });
  return json({ backup: { id: b.id, version: b.version } }, 201);
});

export const maxDuration = 120;
