import { json, withUser } from "@/lib/api";
import { aiStatus } from "@/lib/ai/status";

export const GET = withUser(async (_req, user) => json(await aiStatus(user.id)));
