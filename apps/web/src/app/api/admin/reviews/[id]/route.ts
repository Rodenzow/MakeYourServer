import { z } from "zod";
import { json, parseBody, withAdmin } from "@/lib/api";
import { setReviewHidden } from "@/lib/reviews";

const Action = z.object({ action: z.enum(["hide", "show"]) });

/** Modération d’un avis : masquer ou réafficher (les compteurs du template sont recalculés). */
export const POST = withAdmin<{ id: string }>(async (req, admin, { id }) => {
  const { action } = await parseBody(req, Action);
  const result = await setReviewHidden(admin.id, id, action === "hide");
  return json({ ok: true, hidden: action === "hide", ratingCount: result.ratingCount, ratingSum: result.ratingSum });
});
