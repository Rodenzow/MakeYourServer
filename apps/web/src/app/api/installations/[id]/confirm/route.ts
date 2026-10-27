import { z } from "zod";
import { and, eq, getDb, installations } from "@mys/db";
import { confirmInstallation } from "@mys/engine";
import { HttpError, json, parseBody, withUser } from "@/lib/api";
import { getGateway } from "@/lib/gateway";

const Body = z.object({
  /** Pour une opération destructive : le nom exact du serveur doit être retapé. */
  confirmationText: z.string().max(120).optional(),
  excluded: z.array(z.string()).max(500).optional(),
});

export const POST = withUser<{ id: string }>(async (req, user, { id }) => {
  const body = await parseBody(req, Body);
  const [inst] = await getDb().select({ guildName: installations.guildName, plan: installations.plan }).from(installations).where(and(eq(installations.id, id), eq(installations.userId, user.id)));
  if (!inst) throw new HttpError(404, "Installation introuvable.");
  const excluded = new Set(body.excluded ?? []);
  const destructive = inst.plan.ops.some((o) => o.destructive && !(o.optional && excluded.has(o.key)));
  const confirmDestructive = destructive && body.confirmationText?.trim() === inst.guildName.trim();
  if (destructive && !confirmDestructive) {
    throw new HttpError(428, `Pour confirmer les opérations destructives, saisissez exactement le nom du serveur : « ${inst.guildName} ».`, "confirmation_required");
  }
  const result = await confirmInstallation(getGateway(user.discordId), { installationId: id, userId: user.id, confirmDestructive, excluded: body.excluded });
  return json(result);
});
