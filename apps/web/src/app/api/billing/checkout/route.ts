import { json, withUser } from "@/lib/api";
import { createCheckout } from "@/lib/billing";

export const POST = withUser(async (_req, user) => json({ url: await createCheckout(user) }));
