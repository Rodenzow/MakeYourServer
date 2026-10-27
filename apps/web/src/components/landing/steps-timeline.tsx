"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";

const STEPS = [
  ["Choisir", "Un template complet et gratuit, ou une conception sur mesure par l’IA."],
  ["Personnaliser", "Renommez, réorganisez, ajustez rôles, permissions et messages. Tout est enregistré."],
  ["Inviter le bot", "Créez votre serveur dans Discord, puis invitez le bot en un clic."],
  ["Installer et suivre", "Le site analyse l’existant, vous confirmez, le bot installe sous vos yeux."],
] as const;

/** Frise du parcours : la ligne se dessine au fil du défilement. */
export function StepsTimeline() {
  const ref = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 55%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  return (
    <ol ref={ref} className="relative grid gap-10 md:grid-cols-4 md:gap-6">
      <div className="absolute top-5 right-0 left-0 hidden h-px bg-line md:block" aria-hidden />
      <motion.div className="absolute top-5 left-0 hidden h-px origin-left bg-gradient-to-r from-light via-blue to-peri md:block" style={{ scaleX: reduce ? 1 : progress, width: "100%" }} aria-hidden />
      <div className="absolute top-0 bottom-0 left-5 w-px bg-line md:hidden" aria-hidden />
      <motion.div className="absolute top-0 left-5 w-px origin-top bg-gradient-to-b from-light via-blue to-peri md:hidden" style={{ scaleY: reduce ? 1 : progress, height: "100%" }} aria-hidden />
      {STEPS.map(([title, text], i) => (
        <motion.li
          key={title}
          className="relative pl-14 md:pl-0"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: i * 0.12, ease: [0.2, 0.9, 0.25, 1] }}
        >
          <span className="absolute top-0 left-0 flex size-10 items-center justify-center rounded-xl border border-edge bg-surface font-mono text-sm font-bold text-light shadow-[3px_3px_0_0_rgb(131_168_243/0.3)] md:relative">
            {String(i + 1).padStart(2, "0")}
          </span>
          <h3 className="mt-0 text-xl font-bold md:mt-5">{title}</h3>
          <p className="mt-2 text-sm text-ink">{text}</p>
        </motion.li>
      ))}
    </ol>
  );
}
