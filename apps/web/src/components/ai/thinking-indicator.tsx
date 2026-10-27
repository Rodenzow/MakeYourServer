"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const DEFAULT_STEPS = [
  "Analyse de votre demande…",
  "Organisation des catégories et des salons…",
  "Définition des rôles et de leurs permissions…",
  "Rédaction des messages d’accueil et du règlement…",
  "Réglage de la modération et de l’onboarding…",
  "Vérification par le moteur Make Your Server…",
];

/** Indicateur d’attente : les étapes affichées sont indicatives (l’IA travaille en une seule passe). */
export function ThinkingIndicator({ steps = DEFAULT_STEPS, label = "L’IA conçoit votre proposition" }: { steps?: string[]; label?: string }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 7000);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div className="brick blueprint flex flex-col items-center gap-4 px-6 py-10 text-center" role="status" aria-live="polite">
      <div className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((k) => (
          <motion.span
            key={k}
            className="size-3 rounded-[3px] bg-night"
            animate={reduce ? undefined : { y: [0, -8, 0], rotate: [0, 45, 90] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: k * 0.15, ease: "easeInOut" }}
          />
        ))}
      </div>
      <p className="font-display text-lg font-semibold">{label}</p>
      <div className="h-6">
        <AnimatePresence mode="wait">
          <motion.p key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="text-sm text-muted">
            {steps[i]}
          </motion.p>
        </AnimatePresence>
      </div>
      <p className="text-xs text-muted">Cela prend généralement entre 30 secondes et 2 minutes. Ne fermez pas la page.</p>
    </div>
  );
}
