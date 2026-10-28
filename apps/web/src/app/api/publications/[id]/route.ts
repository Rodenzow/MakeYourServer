import { json, withUser } from "@/lib/api";
import { withdrawPublication } from "@/lib/publications";

/** L’auteur retire sa proposition ou son template publié. */
export const DELETE = withUser<{ id: string }>(async (_req, user, { id }) => {
  await withdrawPublication(user.id, id);
  return json({ ok: true });
});
