"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "../ui";

const KEY = "mys-guide-editeur-v1";
const STEPS = [
  { title: "1. Votre serveur, à gauche", text: "Cliquez sur un salon ou une catégorie pour le modifier. Glissez-déposez (ou utilisez les flèches) pour réorganiser." },
  { title: "2. Les réglages, au centre", text: "Nom, type, permissions, messages… Chaque modification est vérifiée et enregistrée automatiquement." },
  { title: "3. L’aperçu, à droite", text: "Lisez les messages et choisissez « Voir comme » un rôle pour vérifier qui voit quoi." },
  { title: "4. Quand c’est prêt : Installer", text: "Le site analysera votre serveur Discord avant toute modification. Rien n’est supprimé sans votre accord." },
];

/** Mini-guide affiché à la première ouverture de l’éditeur (mémorisé dans le navigateur). */
export function QuickGuide() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<number | null>(null);
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setStep(0);
    } catch {
      /* stockage indisponible : pas de guide */
    }
  }, []);
  const close = () => {
    setStep(null);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignoré */
    }
  };
  return (
    <AnimatePresence>
      {step !== null && (
        <motion.div
          role="dialog"
          aria-label="Guide de l’éditeur"
          className="fixed right-4 bottom-4 z-40 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-light/60 bg-surface p-5 shadow-[6px_6px_0_0_rgb(131_168_243/0.35)]"
          initial={reduce ? false : { opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, y: 24, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
        >
          <div className="mb-3 flex gap-1" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-light" : "bg-line"}`} />
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={reduce ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
              <p className="font-display text-lg font-semibold">{STEPS[step]!.title}</p>
              <p className="mt-1 text-sm text-ink">{STEPS[step]!.text}</p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-4 flex items-center justify-between">
            <button type="button" onClick={close} className="text-sm text-muted hover:text-fg">
              Passer
            </button>
            <Button size="sm" onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : close())}>
              {step < STEPS.length - 1 ? "Suivant" : "C’est parti !"}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
