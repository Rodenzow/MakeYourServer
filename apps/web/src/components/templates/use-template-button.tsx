"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "../ui";
import { IconArrowRight } from "../icons";

/**
 * « Personnaliser ce template » : crée le projet puis enchaîne vers l’éditeur avec une
 * transition qui fait « s’ouvrir » l’aperçu en espace de travail.
 */
export function UseTemplateButton({ slug, loggedIn, label = "Personnaliser ce template" }: { slug: string; loggedIn: boolean; label?: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [state, setState] = useState<"idle" | "loading" | "opening">("idle");
  const [error, setError] = useState<string | null>(null);

  async function go() {
    if (!loggedIn) {
      router.push(`/connexion?suivant=${encodeURIComponent(`/templates/${slug}`)}`);
      return;
    }
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "template", slug }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Création impossible.");
      setState("opening");
      router.prefetch(`/projets/${data.project.id}`);
      setTimeout(() => router.push(`/projets/${data.project.id}?depuis=template`), reduce ? 0 : 520);
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  }

  return (
    <>
      <Button size="lg" onClick={go} disabled={state !== "idle"}>
        {state === "loading" ? "Création du projet…" : label} <IconArrowRight size={18} />
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      <AnimatePresence>
        {state === "opening" && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-night"
            initial={{ clipPath: "inset(40% 30% 40% 30% round 24px)", opacity: 0.6 }}
            animate={{ clipPath: "inset(0% 0% 0% 0% round 0px)", opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.2, 0.9, 0.25, 1] }}
            aria-live="polite"
          >
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="blueprint-dark absolute inset-0" />
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="relative font-display text-2xl font-semibold text-white">
              Ouverture de l’éditeur…
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
