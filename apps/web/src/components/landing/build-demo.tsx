"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { RoleList, ServerTree, type TreeCategory } from "../server-tree";
import { IconCheck } from "../icons";

/** Séquence fidèle aux opérations réelles du bot : rôles, catégories, salons, messages, AutoMod. */
const OPS: Array<{ kind: "role" | "category" | "channel" | "message" | "automod" | "onboarding"; label: string; cat?: string; name?: string; type?: string; color?: number; priv?: boolean }> = [
  { kind: "role", label: "Rôle « Administration » créé", name: "🛠️ Administration", color: 0xe5534b },
  { kind: "role", label: "Rôle « Modération » créé", name: "🛡️ Modération", color: 0x83a8f3 },
  { kind: "role", label: "Rôle « Animation » créé", name: "🎉 Animation", color: 0xa7bdff },
  { kind: "category", label: "Catégorie « Bienvenue »", cat: "📌 Bienvenue" },
  { kind: "channel", label: "#👋・bienvenue", cat: "📌 Bienvenue", name: "👋・bienvenue", type: "text" },
  { kind: "channel", label: "#📜・règlement", cat: "📌 Bienvenue", name: "📜・règlement", type: "text" },
  { kind: "channel", label: "#📣・annonces", cat: "📌 Bienvenue", name: "📣・annonces", type: "announcement" },
  { kind: "category", label: "Catégorie « Discussions »", cat: "💬 Discussions" },
  { kind: "channel", label: "#💬・général", cat: "💬 Discussions", name: "💬・général", type: "text" },
  { kind: "channel", label: "Forum 🤝・entraide", cat: "💬 Discussions", name: "🤝・entraide", type: "forum" },
  { kind: "channel", label: "Vocal 🛋️ Détente", cat: "💬 Discussions", name: "🛋️ Détente", type: "voice" },
  { kind: "category", label: "Catégorie privée « Équipe »", cat: "🛡️ Équipe" },
  { kind: "channel", label: "#📋・logs (privé)", cat: "🛡️ Équipe", name: "📋・logs-arrivées", type: "text", priv: true },
  { kind: "message", label: "Règlement publié et épinglé" },
  { kind: "automod", label: "4 règles AutoMod actives" },
  { kind: "onboarding", label: "Onboarding : 2 questions" },
];

export function BuildDemo() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? OPS.length : 0);

  useEffect(() => {
    if (reduce) return;
    const delay = step >= OPS.length ? 3200 : step === 0 ? 700 : 420;
    const t = setTimeout(() => setStep((s) => (s >= OPS.length ? 0 : s + 1)), delay);
    return () => clearTimeout(t);
  }, [step, reduce]);

  const done = OPS.slice(0, step);
  const categories = useMemo<TreeCategory[]>(() => {
    const cats: TreeCategory[] = [];
    for (const op of done) {
      if (op.kind === "category") cats.push({ key: op.cat!, name: op.cat!, channels: [] });
      if (op.kind === "channel") cats.find((c) => c.key === op.cat)?.channels.push({ key: op.name!, name: op.name!, type: op.type!, private: op.priv });
    }
    return cats;
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  const roles = done.filter((o) => o.kind === "role").map((o) => ({ key: o.name!, name: o.name!, color: o.color! }));
  const finished = step >= OPS.length;

  return (
    <div className="relative grid gap-3 sm:grid-cols-[1fr_0.9fr]" aria-label="Animation : un serveur se construit étape par étape">
      <div className="rounded-[18px] border-2 border-light/20 bg-night-2/60 p-2 shadow-[6px_6px_0_0_rgb(131_168_243/0.35)]">
        <ServerTree name="Communauté conviviale" categories={categories} dense emptyLabel="Serveur vide…" className="min-h-[320px] sm:min-h-[380px]" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="rounded-[14px] border border-light/15 bg-night-2/50 p-3">
          <p className="eyebrow !text-light/50">Rôles</p>
          <div className="mt-2 min-h-[56px] [&_li]:border-white/10 [&_li]:bg-white/5 [&_li]:text-light">
            <RoleList roles={roles} />
          </div>
        </div>
        <div className="flex-1 rounded-[14px] border border-light/15 bg-night-2/50 p-3 font-mono text-[11.5px] text-light/80">
          <p className="eyebrow !text-light/50">Journal du bot</p>
          <ul className="mt-2 space-y-1" aria-live="off">
            <AnimatePresence initial={false}>
              {done.slice(-6).map((op) => (
                <motion.li key={op.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  <IconCheck size={13} className="shrink-0 text-[#6fd3a0]" />
                  <span className="truncate">{op.label}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <AnimatePresence>
            {finished && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 rounded-md bg-[#6fd3a0]/15 px-2 py-1.5 text-[#9fe3bf]">
                Installé : {OPS.length} opérations, aucun doublon.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
