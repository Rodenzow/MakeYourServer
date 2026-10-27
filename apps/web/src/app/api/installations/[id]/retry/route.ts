import { retryInstallation } from "@mys/engine";
import { json, withUser } from "@/lib/api";

/** Relance : seules les étapes en échec ou annulées sont rejouées, sans doublon. */
export const POST = withUser<{ id: string }>(async (_req, user, { id }) => {
  await retryInstallation(id, user.id);
  return json({ queued: true });
});
