"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ChannelIcon, IconCheck, IconSparkle } from "../icons";
import { cx } from "../ui";

/* -------------------------------------------------------------------------- */
/*  Démonstrations animées du Premium (jouées quand elles deviennent visibles) */
/* -------------------------------------------------------------------------- */

function useLoop(steps: number, interval: number, active: boolean) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setStep((s) => (s + 1) % steps), interval);
    return () => clearInterval(t);
  }, [active, steps, interval]);
  return step;
}

const PROMPT = "Un serveur pour ma team e-sport : recrutement, entraînements et tournois";
const GENERATED = [
  { cat: "📌 ACCUEIL", channels: [["text", "👋・bienvenue"], ["text", "📜・règlement"]] },
  { cat: "🎯 TEAM", channels: [["forum", "📝・recrutement"], ["text", "📅・entraînements"]] },
  { cat: "🏆 TOURNOIS", channels: [["announcement", "📣・inscriptions"], ["voice", "🎙️ Match officiel"]] },
] as const;

/** 1. Conception par IA : une phrase → un serveur complet. */
export function AiDesignDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState(reduce ? PROMPT.length : 0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    setTyped(0);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setTyped(i);
      if (i >= PROMPT.length) clearInterval(t);
    }, 28);
    const restart = setTimeout(() => setCycle((c) => c + 1), 9000);
    return () => {
      clearInterval(t);
      clearTimeout(restart);
    };
  }, [inView, reduce, cycle]);

  const done = typed >= PROMPT.length;
  return (
    <div ref={ref} className="flex h-full flex-col gap-3">
      <div className="rounded-xl border border-line bg-night p-3 text-sm">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-peri uppercase">
          <IconSparkle size={13} /> Votre demande
        </p>
        <p className="min-h-[2.6em] text-fg">
          {PROMPT.slice(0, typed)}
          {!done && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-light" />}
        </p>
      </div>
      <div className="relative flex-1 overflow-hidden rounded-xl bg-night-2 p-3 text-[12.5px] text-light/85">
        <AnimatePresence mode="wait">
          {done ? (
            <motion.ul key={`res-${cycle}`} className="space-y-2" initial="hidden" animate="show" exit={{ opacity: 0 }} variants={{ show: { transition: { staggerChildren: 0.12 } } }}>
              {GENERATED.map((g) => (
                <motion.li key={g.cat} variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}>
                  <p className="text-[10px] font-bold tracking-wide text-light/50">⌄ {g.cat}</p>
                  {g.channels.map(([type, name]) => (
                    <p key={name} className="flex items-center gap-1.5 py-px">
                      <ChannelIcon type={type} size={13} className="text-light/45" /> {name}
                    </p>
                  ))}
                </motion.li>
              ))}
            </motion.ul>
          ) : (
            <motion.div key="thinking" className="grid h-full place-items-center text-muted" exit={{ opacity: 0 }}>
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="size-1.5 rounded-full bg-peri" animate={reduce ? undefined : { y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
                ))}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const CHANGES = [
  { sign: "+", text: "Catégorie 🏆 Tournois", tone: "text-success" },
  { sign: "+", text: "#📣・inscriptions (lecture seule)", tone: "text-success" },
  { sign: "+", text: "Rôle « Orga tournois »", tone: "text-success" },
  { sign: "~", text: "Permissions de #annonces", tone: "text-warning" },
];

/** 2. Modifications ciblées : chaque changement s’accepte un par un. */
export function AiEditDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });
  const reduce = useReducedMotion();
  const step = useLoop(CHANGES.length + 3, 900, inView && !reduce);
  const accepted = reduce ? CHANGES.length : Math.max(0, step - 1);
  return (
    <div ref={ref} className="flex h-full flex-col gap-3">
      <div className="self-end rounded-xl rounded-br-sm bg-accent px-3 py-2 text-sm font-medium text-on-accent">Ajoute un espace tournois avec inscriptions</div>
      <ul className="flex-1 space-y-1.5 rounded-xl border border-line bg-night p-3 text-sm">
        {CHANGES.map((c, i) => {
          const ok = i < accepted;
          return (
            <li key={c.text} className="flex items-center gap-2">
              <span className={cx("w-3 font-mono font-bold", c.tone)}>{c.sign}</span>
              <span className="min-w-0 flex-1 truncate">{c.text}</span>
              <motion.span
                animate={{ scale: ok ? 1 : 0.85, opacity: ok ? 1 : 0.4 }}
                className={cx("grid size-5 place-items-center rounded-md border", ok ? "border-success bg-success-soft text-success" : "border-line text-transparent")}
              >
                <IconCheck size={13} />
              </motion.span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">Vous gardez la main : acceptez ou refusez chaque changement.</p>
    </div>
  );
}

const VERSIONS = ["Lun. 03:00", "Mar. 03:00", "Mer. 03:00", "Jeu. 03:00", "Ven. 03:00"];

/** 3. Sauvegardes programmées et restauration sélective. */
export function BackupDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });
  const reduce = useReducedMotion();
  const step = useLoop(VERSIONS.length + 3, 850, inView && !reduce);
  const shown = reduce ? VERSIONS.length : Math.min(step + 1, VERSIONS.length);
  const restoring = reduce || step >= VERSIONS.length;
  return (
    <div ref={ref} className="flex h-full flex-col gap-3">
      <ol className="relative space-y-2 rounded-xl border border-line bg-night p-3 pl-7 text-sm">
        <span className="absolute top-4 bottom-4 left-[15px] w-px bg-line" />
        {VERSIONS.map((v, i) => (
          <li key={v} className={cx("relative flex items-center justify-between transition-opacity duration-300", i < shown ? "opacity-100" : "opacity-20")}>
            <span className={cx("absolute -left-[17px] size-2.5 rounded-full ring-4 ring-night", i < shown ? "bg-peri" : "bg-line")} />
            <span>Version {i + 1}</span>
            <span className="font-mono text-xs text-muted">{v}</span>
          </li>
        ))}
      </ol>
      <motion.div animate={{ opacity: restoring ? 1 : 0.35, y: restoring ? 0 : 6 }} className="rounded-xl border border-edge bg-surface p-3 text-sm">
        <p className="font-semibold">Restaurer seulement :</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["Rôles", "Permissions", "Salons supprimés"].map((x, i) => (
            <span key={x} className={cx("rounded-full border px-2.5 py-0.5 text-xs", i < 2 ? "border-light bg-accent text-on-accent" : "border-line text-ink")}>
              {x}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
