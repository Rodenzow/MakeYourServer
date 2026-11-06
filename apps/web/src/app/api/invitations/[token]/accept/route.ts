import { json, withUser } from "@/lib/api";
import { acceptInvite } from "@/lib/invitations";

/** Rejoindre un projet en tant que co-gestionnaire (lien d’invitation à usage unique). */
export const POST = withUser<{ token: string }>(async (_req, user, { token }) => {
  const { projectId, already } = await acceptInvite(token, user.id);
  return json({ projectId, already });
});
