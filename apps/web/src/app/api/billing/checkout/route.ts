import { z } from "zod";
import { json, parseBody, withUser } from "@/lib/api";
import { createCheckout } from "@/lib/billing";

/** Acceptation des conditions et renonciation expresse au droit de rétractation (accès immédiat). */
const Body = z.object({
  acceptTerms: z.literal(true, { error: "Acceptez les conditions d’utilisation pour continuer." }),
  waiveWithdrawal: z.literal(true, { error: "Confirmez la demande d’accès immédiat pour continuer." }),
});

export const POST = withUser(async (req, user) => {
  await parseBody(req, Body);
  return json({ url: await createCheckout(user) });
});
