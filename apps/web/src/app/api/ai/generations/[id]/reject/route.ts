import { json, withUser } from "@/lib/api";
import { rejectGeneration } from "@/lib/ai/service";

export const POST = withUser<{ id: string }>(async (_req, user, { id }) => {
  await rejectGeneration(user.id, id);
  return json({ ok: true });
});
