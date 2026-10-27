import { cancelInstallation } from "@mys/engine";
import { json, withUser } from "@/lib/api";

export const POST = withUser<{ id: string }>(async (_req, user, { id }) => {
  await cancelInstallation(id, user.id);
  return json({ cancelled: true });
});
