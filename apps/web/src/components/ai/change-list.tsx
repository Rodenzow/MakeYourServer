"use client";

import { motion } from "motion/react";
import { IconAlert, IconCheck } from "../icons";
import { cx } from "../ui";

export interface ChangePreviewData {
  index: number;
  title: string;
  reason: string;
  valid: boolean;
  errors: string[];
  rejected: string[];
  diff: { added: string[]; removed: string[]; modified: string[] };
}

/** Liste des changements proposés par l’IA, acceptables un par un. */
export function ChangeList({
  previews,
  selected,
  onToggle,
  disabled,
}: {
  previews: ChangePreviewData[];
  selected: Set<number>;
  onToggle: (i: number) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="space-y-3">
      {previews.map((p, n) => (
        <motion.li
          key={p.index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: n * 0.05, duration: 0.2 }}
          className={cx("panel p-4 transition-colors", selected.has(p.index) && p.valid && "border-night")}
        >
          <label className={cx("flex items-start gap-3", p.valid && !disabled ? "cursor-pointer" : "cursor-not-allowed")}>
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[var(--color-night)]"
              checked={selected.has(p.index)}
              disabled={!p.valid || disabled}
              onChange={() => onToggle(p.index)}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 font-semibold">
                {p.title}
                {p.valid ? (
                  <span className="inline-flex items-center gap-1 rounded bg-success-soft px-1.5 text-[11px] text-success">
                    <IconCheck size={11} /> valide
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-danger-soft px-1.5 text-[11px] text-danger">
                    <IconAlert size={11} /> non applicable seul
                  </span>
                )}
              </span>
              {p.reason && <span className="mt-0.5 block text-sm text-muted">{p.reason}</span>}
              <span className="mt-2 flex flex-col gap-1 text-[13px]">
                {p.diff.added.map((d) => (
                  <span key={`a${d}`} className="text-success">+ {d}</span>
                ))}
                {p.diff.modified.map((d) => (
                  <span key={`m${d}`} className="text-ink">~ {d}</span>
                ))}
                {p.diff.removed.map((d) => (
                  <span key={`r${d}`} className="text-danger">− {d}</span>
                ))}
                {!p.diff.added.length && !p.diff.modified.length && !p.diff.removed.length && <span className="text-muted">Aucun changement visible.</span>}
              </span>
              {p.rejected.length > 0 && <span className="mt-2 block text-xs text-warning">Ignoré : {p.rejected.join(" ; ")}</span>}
              {!p.valid && p.errors.length > 0 && <span className="mt-2 block text-xs text-danger">{p.errors.join(" ; ")}</span>}
            </span>
          </label>
        </motion.li>
      ))}
    </ul>
  );
}
