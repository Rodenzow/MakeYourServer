import { json, withUser } from "@/lib/api";
import { createPortal } from "@/lib/billing";

export const POST = withUser(async (_req, user) => json({ url: await createPortal(user.id) }));
