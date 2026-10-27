"use client";

import { motion, useReducedMotion } from "motion/react";
import { ServerTree, type TreeCategory } from "../server-tree";
import { IconArrowRight } from "../icons";

/** Comparaison avant / après côte à côte (empilée sur mobile). */
export function BeforeAfter({ before, after, beforeLabel = "Avant", afterLabel = "Après" }: { before: TreeCategory[]; after: TreeCategory[]; beforeLabel?: string; afterLabel?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
      <figure className="flex flex-col">
        <figcaption className="eyebrow mb-2">{beforeLabel}</figcaption>
        <ServerTree categories={before} dense animate={false} className="flex-1 !bg-[#2a2f40] opacity-90" />
      </figure>
      <div className="flex items-center justify-center text-fg" aria-hidden>
        <motion.span
          className="flex size-10 items-center justify-center rounded-full border-2 border-edge bg-light rotate-90 sm:rotate-0"
          animate={reduce ? undefined : { x: [0, 4, 0] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
        >
          <IconArrowRight size={18} />
        </motion.span>
      </div>
      <figure className="flex flex-col">
        <figcaption className="eyebrow mb-2">{afterLabel}</figcaption>
        <ServerTree categories={after} dense className="flex-1" />
      </figure>
    </div>
  );
}
