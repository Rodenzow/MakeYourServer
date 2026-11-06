import { OG_CONTENT_TYPE, OG_SIZE, siteCard } from "@/lib/og/card";

// Image de partage par défaut du site (toutes les pages sans image dédiée).
// Calculée à la demande puis mise en cache en périphérie par worker.ts.
export const dynamic = "force-dynamic";
export const alt = "Make Your Server — votre serveur Discord, prêt à l’emploi";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return siteCard();
}
