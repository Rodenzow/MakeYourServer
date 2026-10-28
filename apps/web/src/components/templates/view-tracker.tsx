"use client";

import { useEffect } from "react";

/** Compte une vue après l’affichage réel de la fiche (pas lors d’un préchargement). */
export function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const t = setTimeout(() => {
      void fetch(`/api/templates/${slug}/view`, { method: "POST", keepalive: true }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [slug]);
  return null;
}
