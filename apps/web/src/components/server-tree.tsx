"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChannelIcon, IconChevronDown, IconLock } from "./icons";
import { colorHex, cx } from "./ui";

export type TreeStatus = "new" | "updated" | "kept" | "reused" | "archived" | "deleted" | "hidden" | "readonly";

export interface TreeChannel {
  key: string;
  name: string;
  type: string;
  status?: TreeStatus;
  private?: boolean;
}
export interface TreeCategory {
  key: string;
  name: string | null;
  status?: TreeStatus;
  channels: TreeChannel[];
}

const STATUS_LABEL: Partial<Record<TreeStatus, [string, string]>> = {
  new: ["nouveau", "bg-success-soft text-success"],
  updated: ["modifié", "bg-light text-on-accent"],
  reused: ["réutilisé", "bg-mist text-ink"],
  archived: ["archivé", "bg-warning-soft text-warning"],
  deleted: ["supprimé", "bg-danger-soft text-danger"],
  readonly: ["lecture", "bg-mist text-muted"],
};

/**
 * Aperçu d’un serveur sous forme d’arborescence, inspiré de la colonne de salons
 * de Discord, avec l’identité Make Your Server. Utilisé partout : accueil,
 * fiches templates, éditeur, comparaison avant/après.
 */
export function ServerTree({
  name,
  categories,
  selected,
  onSelect,
  dense = false,
  animate = true,
  className,
  emptyLabel = "Aucun salon",
}: {
  name?: string;
  categories: TreeCategory[];
  selected?: string | null;
  onSelect?: (key: string) => void;
  dense?: boolean;
  animate?: boolean;
  className?: string;
  emptyLabel?: string;
}) {
  const reduce = useReducedMotion();
  const anim = animate && !reduce;
  return (
    <div className={cx("rounded-[14px] bg-night-2 p-2 text-[13px] text-light/85", className)}>
      {name && (
        <div className="mb-2 flex items-center justify-between rounded-lg px-2 py-2 font-display text-[15px] font-semibold text-white">
          <span className="truncate">{name}</span>
          <IconChevronDown size={14} />
        </div>
      )}
      {categories.length === 0 && <p className="px-2 py-4 text-center text-light/50">{emptyLabel}</p>}
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {categories.map((cat) => (
            <motion.li
              key={cat.key}
              layout={anim ? "position" : false}
              initial={anim ? { opacity: 0, y: -6 } : false}
              animate={{ opacity: cat.status === "deleted" ? 0.45 : 1, y: 0 }}
              exit={anim ? { opacity: 0, height: 0 } : undefined}
              transition={{ duration: 0.22, ease: [0.2, 0.9, 0.25, 1] }}
            >
              {cat.name !== null && (
                <button
                  type="button"
                  onClick={onSelect ? () => onSelect(cat.key) : undefined}
                  disabled={!onSelect}
                  className={cx(
                    "flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[11px] font-bold uppercase tracking-wide text-light/60",
                    onSelect && "hover:text-white",
                    selected === cat.key && "bg-white/10 text-white",
                  )}
                >
                  <IconChevronDown size={11} />
                  <span className="truncate">{cat.name}</span>
                  <StatusPill status={cat.status} />
                </button>
              )}
              <ul className="mt-0.5 space-y-px">
                <AnimatePresence initial={false}>
                  {cat.channels.map((ch) => (
                    <motion.li
                      key={ch.key}
                      layout={anim ? "position" : false}
                      initial={anim ? { opacity: 0, x: -8 } : false}
                      animate={{ opacity: ch.status === "hidden" || ch.status === "deleted" ? 0.35 : 1, x: 0 }}
                      exit={anim ? { opacity: 0, x: 8 } : undefined}
                      transition={{ duration: 0.2, ease: [0.2, 0.9, 0.25, 1] }}
                    >
                      <button
                        type="button"
                        onClick={onSelect ? () => onSelect(ch.key) : undefined}
                        disabled={!onSelect}
                        className={cx(
                          "group flex w-full items-center gap-1.5 rounded-md px-2 text-left",
                          dense ? "py-[3px]" : "py-[5px]",
                          onSelect && "hover:bg-white/8 hover:text-white",
                          selected === ch.key && "bg-white/15 text-white",
                          ch.status === "deleted" && "line-through",
                        )}
                      >
                        <span className="shrink-0 text-light/55">
                          <ChannelIcon type={ch.type} size={15} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{ch.name}</span>
                        {(ch.private || ch.status === "hidden") && <IconLock size={12} className="shrink-0 text-light/45" />}
                        <StatusPill status={ch.status} />
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function StatusPill({ status }: { status?: TreeStatus }) {
  const s = status && STATUS_LABEL[status];
  if (!s) return null;
  return <span className={cx("ml-auto shrink-0 rounded px-1.5 py-px text-[10px] font-bold normal-case tracking-normal", s[1])}>{s[0]}</span>;
}

export function RoleList({ roles, className }: { roles: Array<{ key: string; name: string; color: number; status?: TreeStatus }>; className?: string }) {
  return (
    <ul className={cx("flex flex-wrap gap-1.5", className)}>
      <AnimatePresence initial={false}>
        {roles.map((r) => (
          <motion.li
            key={r.key}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: r.status === "deleted" ? 0.45 : 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium"
          >
            <span className="size-2.5 rounded-full" style={{ background: colorHex(r.color) }} />
            <span className={r.status === "deleted" ? "line-through" : undefined}>{r.name}</span>
            {r.status && STATUS_LABEL[r.status] && <span className={cx("rounded px-1 text-[10px] font-bold", STATUS_LABEL[r.status]![1])}>{STATUS_LABEL[r.status]![0]}</span>}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
