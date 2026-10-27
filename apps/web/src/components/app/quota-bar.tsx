"use client";

import { motion, useReducedMotion } from "motion/react";

/** Jauge de quota animée. */
export function QuotaBar({ label, used, max }: { label: string; used: number; max: number }) {
  const reduce = useReducedMotion();
  const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
  const tone = pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-gradient-to-r from-blue to-light";
  return (
    <div>
      <div className="flex justify-between gap-2 text-sm">
        <span className="text-ink">{label}</span>
        <span className="font-mono text-xs text-muted">{max > 0 ? `${used} / ${max}` : "Premium"}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-night">
        <motion.div className={`h-full rounded-full ${tone}`} initial={reduce ? false : { width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: [0.2, 0.9, 0.25, 1], delay: 0.2 }} />
      </div>
    </div>
  );
}
