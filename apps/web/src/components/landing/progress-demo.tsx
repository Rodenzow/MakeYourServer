"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { StepIcon } from "../step-icon";

const STEPS: Array<{ label: string; outcome: "succeeded" | "failed" | "skipped"; detail?: string }> = [
  { label: "Sauvegarde de sécurité de la configuration actuelle", outcome: "succeeded" },
  { label: "Créer le rôle « Modération »", outcome: "succeeded" },
  { label: "Réutiliser le salon existant « général »", outcome: "succeeded", detail: "Salon existant réutilisé." },
  { label: "Créer le forum « entraide »", outcome: "succeeded" },
  { label: "Publier le règlement (épinglé)", outcome: "succeeded" },
  { label: "Créer la règle AutoMod « Anti-spam »", outcome: "failed", detail: "Le bot n’a pas la permission « Gérer le serveur »." },
  { label: "Configurer l’onboarding", outcome: "succeeded" },
];

/** Démonstration du suivi : chaque ligne correspond à une vraie opération du bot. Un échec reste visible. */
export function ProgressDemo() {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? STEPS.length : 0);
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setN((x) => (x > STEPS.length ? 0 : x + 1)), n > STEPS.length - 1 ? 3500 : 650);
    return () => clearTimeout(t);
  }, [n, reduce]);
  const done = Math.min(n, STEPS.length);
  const failed = STEPS.slice(0, done).filter((s) => s.outcome === "failed").length;
  return (
    <div className="brick p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display font-semibold">Installation sur « Les Copains d’abord »</p>
        <span className="font-mono text-xs text-muted">
          {done}/{STEPS.length}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-mist">
        <motion.div className="h-full bg-blue" animate={{ width: `${(done / STEPS.length) * 100}%` }} transition={{ duration: 0.3 }} />
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {STEPS.map((s, i) => {
          const status = i < done ? s.outcome : i === done ? "running" : "pending";
          return (
            <li key={s.label} className="flex items-start gap-2.5">
              <StepIcon status={status} />
              <div className="min-w-0">
                <p className={status === "pending" ? "text-muted" : undefined}>{s.label}</p>
                {i < done && s.detail && <p className={s.outcome === "failed" ? "text-xs text-danger" : "text-xs text-muted"}>{s.detail}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      {done === STEPS.length && (
        <p className="mt-4 rounded-lg bg-warning-soft px-3 py-2 text-sm font-medium text-warning">
          Installation partielle : {failed} étape en échec. Corrigez la permission puis relancez : seule cette étape sera rejouée.
        </p>
      )}
    </div>
  );
}
