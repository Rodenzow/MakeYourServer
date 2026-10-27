"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { moveCategory, moveChannel, uniqueId, simulateAsRoles, type ServerSpec } from "@mys/core";
import { ChannelIcon, IconArrowDown, IconArrowUp, IconGrip, IconLock, IconPlus } from "../icons";
import { cx } from "../ui";
import type { Editor, Selection } from "./state";

type Drag = { kind: "channel" | "category"; id: string } | null;

/**
 * Arborescence éditable : glisser-déposer (souris) et boutons haut / bas (clavier,
 * mobile). Les simulations d’accès « Voir comme ce rôle » s’affichent en direct.
 */
export function StructurePanel({ editor, selection, onSelect, asRole }: { editor: Editor; selection: Selection; onSelect: (s: Selection) => void; asRole: string | null }) {
  const { spec } = editor;
  const [drag, setDrag] = useState<Drag>(null);
  const [over, setOver] = useState<string | null>(null);
  const access = asRole !== null ? simulateAsRoles(spec, asRole === "everyone" ? [] : [asRole]) : null;
  const publicAccess = simulateAsRoles(spec, []);

  const dropOnChannel = (targetId: string, categoryId: string | null) => {
    if (!drag) return;
    if (drag.kind === "channel" && drag.id !== targetId) {
      const list = categoryId === null ? spec.uncategorized : spec.categories.find((c) => c.id === categoryId)!.channels;
      editor.replace(moveChannel(spec, drag.id, categoryId, list.findIndex((c) => c.id === targetId)));
    }
    setDrag(null);
    setOver(null);
  };
  const dropOnCategory = (categoryId: string) => {
    if (!drag) return;
    if (drag.kind === "channel") editor.replace(moveChannel(spec, drag.id, categoryId, 999));
    if (drag.kind === "category" && drag.id !== categoryId) editor.replace(moveCategory(spec, drag.id, spec.categories.findIndex((c) => c.id === categoryId)));
    setDrag(null);
    setOver(null);
  };

  const addChannel = (categoryId: string | null) => {
    const id = uniqueId(spec, "nouveau-salon");
    editor.edit((d) => {
      const ch = { id, name: "nouveau-salon", type: "text" as const, nsfw: false, slowmode: 0, syncPermissions: true, overwrites: [] };
      if (categoryId === null) d.uncategorized.push(ch);
      else d.categories.find((c) => c.id === categoryId)!.channels.push(ch);
    });
    onSelect({ kind: "channel", id });
  };
  const addCategory = () => {
    const id = uniqueId(spec, "nouvelle-categorie");
    editor.edit((d) => d.categories.push({ id, name: "Nouvelle catégorie", overwrites: [], channels: [] }));
    onSelect({ kind: "category", id });
  };

  const moveBy = (kind: "channel" | "category", id: string, delta: number) => {
    if (kind === "category") {
      const i = spec.categories.findIndex((c) => c.id === id);
      editor.replace(moveCategory(spec, id, i + delta));
      return;
    }
    const cat = spec.categories.find((c) => c.channels.some((x) => x.id === id));
    const list = cat ? cat.channels : spec.uncategorized;
    const i = list.findIndex((c) => c.id === id);
    const j = i + delta;
    if (j < 0 && cat) {
      // Monter au-dessus du premier salon : passer à la catégorie précédente.
      const ci = spec.categories.indexOf(cat);
      const prev = ci > 0 ? spec.categories[ci - 1]!.id : null;
      editor.replace(moveChannel(spec, id, prev, 999));
      return;
    }
    if (j >= list.length && cat) {
      const ci = spec.categories.indexOf(cat);
      const next = spec.categories[ci + 1];
      if (next) editor.replace(moveChannel(spec, id, next.id, 0));
      return;
    }
    editor.replace(moveChannel(spec, id, cat?.id ?? null, Math.max(0, j)));
  };

  const issueIds = new Set(editor.validation.errors.map((e) => e.elementId).filter(Boolean));

  const channelRow = (chId: string, name: string, type: string, categoryId: string | null) => {
    const sel = selection?.kind === "channel" && selection.id === chId;
    const a = access?.get(chId);
    const hidden = a && !a.canView;
    const readonly = a && a.canView && !a.canSend;
    return (
      <motion.li
        key={chId}
        layout="position"
        transition={{ duration: 0.18 }}
        draggable
        onDragStart={(e) => {
          setDrag({ kind: "channel", id: chId });
          (e as unknown as DragEvent).dataTransfer?.setData("text/plain", chId);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(chId);
        }}
        onDrop={() => dropOnChannel(chId, categoryId)}
        onDragEnd={() => {
          setDrag(null);
          setOver(null);
        }}
        className={cx("group relative", over === chId && drag?.kind === "channel" && "before:absolute before:inset-x-2 before:-top-px before:h-0.5 before:bg-light")}
      >
        <div className={cx("flex items-center gap-1 rounded-md pr-1", sel ? "bg-white/15" : "hover:bg-white/8", hidden && "opacity-35")}>
          <span className="cursor-grab px-0.5 text-light/30 group-hover:text-light/60" aria-hidden>
            <IconGrip size={13} />
          </span>
          <button type="button" onClick={() => onSelect({ kind: "channel", id: chId })} className={cx("flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-[13px]", sel ? "text-white" : "text-light/80")}>
            <ChannelIcon type={type} size={15} className="shrink-0 text-light/50" />
            <span className="truncate">{name}</span>
            {!access && !publicAccess.get(chId)?.canView && <IconLock size={11} className="shrink-0 text-light/40" />}
            {readonly && <span className="ml-auto rounded bg-white/10 px-1 text-[10px] text-light/70">lecture</span>}
            {issueIds.has(chId) && <span className="ml-auto size-2 shrink-0 rounded-full bg-[#ff8a80]" title="Problème à corriger" />}
          </button>
          <span className={cx("flex", sel ? "opacity-100" : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100")}>
            <button type="button" className="rounded p-0.5 text-light/60 hover:text-white" onClick={() => moveBy("channel", chId, -1)} aria-label={`Monter ${name}`}>
              <IconArrowUp size={13} />
            </button>
            <button type="button" className="rounded p-0.5 text-light/60 hover:text-white" onClick={() => moveBy("channel", chId, 1)} aria-label={`Descendre ${name}`}>
              <IconArrowDown size={13} />
            </button>
          </span>
        </div>
      </motion.li>
    );
  };

  return (
    <div className="rounded-[14px] bg-night-2 p-2">
      <ul className="space-y-px">{spec.uncategorized.map((c) => channelRow(c.id, c.name, c.type, null))}</ul>
      <ul className="mt-1 space-y-2">
        <AnimatePresence initial={false}>
          {spec.categories.map((cat) => {
            const sel = selection?.kind === "category" && selection.id === cat.id;
            return (
              <motion.li key={cat.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }}>
                <div
                  draggable
                  onDragStart={() => setDrag({ kind: "category", id: cat.id })}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOver(cat.id);
                  }}
                  onDrop={() => dropOnCategory(cat.id)}
                  onDragEnd={() => {
                    setDrag(null);
                    setOver(null);
                  }}
                  className={cx("group flex items-center gap-1 rounded-md pr-1", sel && "bg-white/10", over === cat.id && drag && "ring-1 ring-light/60")}
                >
                  <span className="cursor-grab px-0.5 text-light/30 group-hover:text-light/60" aria-hidden>
                    <IconGrip size={13} />
                  </span>
                  <button type="button" onClick={() => onSelect({ kind: "category", id: cat.id })} className="min-w-0 flex-1 truncate py-1 text-left text-[11px] font-bold tracking-wide text-light/60 uppercase hover:text-white">
                    {cat.name}
                    {issueIds.has(cat.id) && <span className="ml-1.5 inline-block size-2 rounded-full bg-[#ff8a80]" />}
                  </button>
                  <span className={cx("flex", sel ? "opacity-100" : "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100")}>
                    <button type="button" className="rounded p-0.5 text-light/60 hover:text-white" onClick={() => moveBy("category", cat.id, -1)} aria-label={`Monter la catégorie ${cat.name}`}>
                      <IconArrowUp size={13} />
                    </button>
                    <button type="button" className="rounded p-0.5 text-light/60 hover:text-white" onClick={() => moveBy("category", cat.id, 1)} aria-label={`Descendre la catégorie ${cat.name}`}>
                      <IconArrowDown size={13} />
                    </button>
                    <button type="button" className="rounded p-0.5 text-light/60 hover:text-white" onClick={() => addChannel(cat.id)} aria-label={`Ajouter un salon dans ${cat.name}`}>
                      <IconPlus size={13} />
                    </button>
                  </span>
                </div>
                <ul className="mt-px space-y-px">
                  <AnimatePresence initial={false}>{cat.channels.map((c) => channelRow(c.id, c.name, c.type, cat.id))}</AnimatePresence>
                </ul>
                {cat.channels.length === 0 && (
                  <button type="button" onClick={() => addChannel(cat.id)} className="ml-5 py-1 text-xs text-light/50 hover:text-white">
                    + Ajouter un salon
                  </button>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      <div className="mt-3 flex gap-2 border-t border-white/10 pt-2">
        <button type="button" onClick={addCategory} className="flex-1 rounded-md py-1.5 text-xs font-semibold text-light/70 hover:bg-white/10 hover:text-white">
          + Catégorie
        </button>
        <button type="button" onClick={() => addChannel(null)} className="flex-1 rounded-md py-1.5 text-xs font-semibold text-light/70 hover:bg-white/10 hover:text-white">
          + Salon hors catégorie
        </button>
      </div>
    </div>
  );
}

export function RolesPanel({ editor, selection, onSelect }: { editor: Editor; selection: Selection; onSelect: (s: Selection) => void }) {
  const { spec } = editor;
  const add = () => {
    const id = uniqueId(spec, "nouveau-role");
    editor.edit((d) => d.roles.push({ id, name: "Nouveau rôle", color: 0, hoist: false, mentionable: false, permissions: [], selfAssignable: false, staff: false }));
    onSelect({ kind: "role", id });
  };
  const move = (id: string, delta: number) =>
    editor.edit((d) => {
      const i = d.roles.findIndex((r) => r.id === id);
      const j = i + delta;
      if (j < 0 || j >= d.roles.length) return;
      [d.roles[i], d.roles[j]] = [d.roles[j]!, d.roles[i]!];
    });
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">Du plus haut au plus bas dans la hiérarchie. Les rôles seront placés sous celui du bot.</p>
      <ul className="space-y-1">
        <AnimatePresence initial={false}>
          {spec.roles.map((r, i) => {
            const sel = selection?.kind === "role" && selection.id === r.id;
            return (
              <motion.li key={r.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={cx("group flex items-center gap-2 rounded-lg border px-2 py-1.5", sel ? "border-night bg-white" : "border-transparent hover:bg-white")}>
                <span className="w-5 font-mono text-[10px] text-muted">{i + 1}</span>
                <span className="size-3 shrink-0 rounded-full border border-black/10" style={{ background: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "#99aab5" }} />
                <button type="button" className="min-w-0 flex-1 truncate text-left text-sm font-medium" onClick={() => onSelect({ kind: "role", id: r.id })}>
                  {r.name}
                </button>
                {r.selfAssignable && <span className="rounded bg-light/70 px-1 text-[10px] font-semibold">libre</span>}
                <span className="flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                  <button type="button" onClick={() => move(r.id, -1)} className="rounded p-0.5 text-muted hover:text-night" aria-label={`Monter ${r.name}`}>
                    <IconArrowUp size={13} />
                  </button>
                  <button type="button" onClick={() => move(r.id, 1)} className="rounded p-0.5 text-muted hover:text-night" aria-label={`Descendre ${r.name}`}>
                    <IconArrowDown size={13} />
                  </button>
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
        <li>
          <button type="button" onClick={() => onSelect({ kind: "panel", id: "everyone" })} className={cx("flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm", selection?.kind === "panel" && selection.id === "everyone" ? "border-night bg-white" : "border-transparent hover:bg-white")}>
            <span className="w-5" />
            <span className="size-3 rounded-full bg-[#99aab5]" /> @everyone <span className="text-xs text-muted">(tous les membres)</span>
          </button>
        </li>
      </ul>
      <button type="button" onClick={add} className="w-full rounded-lg border-2 border-dashed border-line py-2 text-sm font-semibold text-ink hover:border-night">
        + Ajouter un rôle
      </button>
    </div>
  );
}
