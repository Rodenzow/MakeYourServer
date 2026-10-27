"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { specStats, type ServerSpec } from "@mys/core";
import { AiPanel } from "../ai/ai-panel";
import { SpecPreview } from "../spec/spec-preview";
import { Button, ButtonLink, cx } from "../ui";
import { IconAlert, IconArrowRight, IconCheck, IconSparkle, IconUndo } from "../icons";
import { CategoryInspector, ChannelInspector, EveryoneInspector, MessageInspector, RoleInspector } from "./inspectors";
import { AutomodPanel, FeaturesPanel, SettingsPanel, WelcomePanel } from "./settings-panels";
import { RolesPanel, StructurePanel } from "./structure-panel";
import { useEditor, type Selection } from "./state";
import { QuickGuide } from "./quick-guide";

const PANELS = [
  { id: "settings", label: "Réglages" },
  { id: "automod", label: "Modération" },
  { id: "welcome", label: "Accueil" },
  { id: "features", label: "Fonctionnalités" },
] as const;

export function ProjectEditor({ project, fromTemplate, aiAvailable }: { project: { id: string; name: string; spec: ServerSpec; revision: number }; fromTemplate?: boolean; aiAvailable: boolean }) {
  const editor = useEditor(project.id, project.spec, project.revision);
  const reduce = useReducedMotion();
  const [left, setLeft] = useState<"structure" | "roles">("structure");
  const [selection, setSelection] = useState<Selection>({ kind: "panel", id: "settings" });
  const [asRole, setAsRole] = useState<string | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [aiOpen, setAiOpen] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const { spec, validation } = editor;
  const stats = specStats(spec);

  useEffect(() => {
    const first = spec.categories[0]?.channels[0];
    if (fromTemplate && first) setSelection({ kind: "channel", id: first.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectIssue = (elementId?: string) => {
    if (!elementId) return;
    if (spec.roles.some((r) => r.id === elementId)) setSelection({ kind: "role", id: elementId });
    else if (spec.categories.some((c) => c.id === elementId)) setSelection({ kind: "category", id: elementId });
    else if (spec.messages.some((m) => m.id === elementId)) setSelection({ kind: "message", id: elementId });
    else if (spec.automod.some((a) => a.id === elementId)) setSelection({ kind: "panel", id: "automod" });
    else setSelection({ kind: "channel", id: elementId });
    setIssuesOpen(false);
  };

  return (
    <motion.div initial={fromTemplate && !reduce ? { opacity: 0, scale: 0.985 } : false} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, ease: [0.2, 0.9, 0.25, 1] }} className="flex min-h-[calc(100dvh-4rem)] flex-col">
      {/* Barre d’outils */}
      <div className="glass sticky top-16 z-20 border-b border-line">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2.5">
          <Link href="/projets" className="text-sm font-semibold text-muted hover:text-fg">
            ← Projets
          </Link>
          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-bold">{spec.meta.name}</h1>
          <SaveBadge status={editor.status} />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={editor.undo} disabled={!editor.canUndo} aria-label="Annuler (Ctrl+Z)" title="Annuler (Ctrl+Z)">
              <IconUndo size={16} />
            </Button>
            <Button variant="ghost" size="sm" onClick={editor.redo} disabled={!editor.canRedo} aria-label="Rétablir (Ctrl+Maj+Z)" title="Rétablir">
              <IconUndo size={16} className="-scale-x-100" />
            </Button>
          </div>
          <button type="button" onClick={() => setIssuesOpen((v) => !v)} className={cx("rounded-lg px-2.5 py-1.5 text-sm font-semibold", validation.errors.length ? "bg-danger-soft text-danger" : validation.warnings.length ? "bg-warning-soft text-warning" : "bg-success-soft text-success")} aria-expanded={issuesOpen}>
            {validation.errors.length ? `${validation.errors.length} erreur(s)` : validation.warnings.length ? `${validation.warnings.length} remarque(s)` : "Projet valide"}
          </button>
          <div className="flex rounded-lg border-2 border-edge bg-surface p-0.5 lg:hidden">
            {(["edit", "preview"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={cx("rounded-md px-2.5 py-1 text-xs font-semibold", view === v ? "bg-accent text-on-accent" : "text-ink")}>
                {v === "edit" ? "Édition" : "Aperçu"}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setAiOpen(true)}>
            <IconSparkle size={15} /> IA
          </Button>
          <ButtonLink href={`/projets/${project.id}/installer`} size="sm">
            Installer <IconArrowRight size={15} />
          </ButtonLink>
        </div>
        {editor.status === "conflict" && (
          <div className="bg-danger-soft px-4 py-2 text-center text-sm text-danger">
            {editor.error}{" "}
            <button type="button" className="font-semibold underline" onClick={() => location.reload()}>
              Recharger la dernière version
            </button>
          </div>
        )}
        {editor.status === "error" && <div className="bg-warning-soft px-4 py-2 text-center text-sm text-warning">Enregistrement impossible : {editor.error} Vos modifications sont conservées dans cette page ; nouvelle tentative à la prochaine modification.</div>}
        <AnimatePresence>
          {issuesOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-line bg-surface">
              <ul className="mx-auto max-h-64 max-w-[1600px] space-y-1 overflow-y-auto px-4 py-3 text-sm">
                {validation.issues.length === 0 && <li className="text-success">Aucun problème détecté : le projet est prêt à être installé.</li>}
                {validation.issues.map((i, k) => (
                  <li key={k}>
                    <button type="button" onClick={() => selectIssue(i.elementId)} className="flex w-full items-start gap-2 rounded-md px-2 py-1 text-left hover:bg-mist">
                      <IconAlert size={15} className={cx("mt-0.5 shrink-0", i.level === "error" ? "text-danger" : "text-warning")} />
                      {i.message}
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mx-auto grid w-full max-w-[1600px] flex-1 gap-4 px-4 py-4 lg:grid-cols-[300px_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Colonne gauche : arborescence */}
        <aside className={cx("space-y-3", view === "preview" && "hidden lg:block")}>
          <div className="flex rounded-lg border-2 border-edge bg-surface p-0.5">
            {(["structure", "roles"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setLeft(t)} className={cx("relative flex-1 rounded-md py-1.5 text-sm font-semibold", left === t ? "text-on-accent" : "text-ink hover:text-fg")}>
                {left === t && <motion.span layoutId="left-tab" className="absolute inset-0 rounded-md bg-accent" transition={{ type: "spring", bounce: 0.12, duration: 0.3 }} />}
                <span className="relative">{t === "structure" ? `Salons (${stats.channels})` : `Rôles (${stats.roles})`}</span>
              </button>
            ))}
          </div>
          {left === "structure" ? (
            <>
              <div className="flex items-center gap-2">
                <label htmlFor="as-role" className="shrink-0 text-xs font-semibold text-muted">
                  Voir comme
                </label>
                <select id="as-role" className="field !py-1 text-sm" value={asRole ?? ""} onChange={(e) => setAsRole(e.target.value || null)}>
                  <option value="">— vue complète —</option>
                  <option value="everyone">@everyone</option>
                  {spec.roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <StructurePanel editor={editor} selection={selection} onSelect={setSelection} asRole={asRole} />
            </>
          ) : (
            <RolesPanel editor={editor} selection={selection} onSelect={setSelection} />
          )}
          <nav className="grid grid-cols-2 gap-1.5" aria-label="Réglages du projet">
            {PANELS.map((p) => (
              <button key={p.id} type="button" onClick={() => setSelection({ kind: "panel", id: p.id })} className={cx("rounded-lg border-2 px-2 py-1.5 text-sm font-semibold", selection?.kind === "panel" && selection.id === p.id ? "border-edge bg-accent text-on-accent" : "border-line bg-surface hover:border-edge")}>
                {p.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Inspecteur */}
        <section className={cx("panel min-w-0 p-5", view === "preview" && "hidden lg:block")} aria-label="Propriétés">
          <AnimatePresence mode="wait">
            <motion.div key={selection ? `${selection.kind}:${selection.id}` : "none"} initial={reduce ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
              {selection?.kind === "category" && <CategoryInspector editor={editor} id={selection.id} onSelect={setSelection} />}
              {selection?.kind === "channel" && <ChannelInspector editor={editor} id={selection.id} onSelect={setSelection} />}
              {selection?.kind === "role" && <RoleInspector editor={editor} id={selection.id} onSelect={setSelection} />}
              {selection?.kind === "message" && <MessageInspector editor={editor} id={selection.id} onSelect={setSelection} />}
              {selection?.kind === "panel" && selection.id === "settings" && <SettingsPanel editor={editor} />}
              {selection?.kind === "panel" && selection.id === "automod" && <AutomodPanel editor={editor} />}
              {selection?.kind === "panel" && selection.id === "welcome" && <WelcomePanel editor={editor} />}
              {selection?.kind === "panel" && selection.id === "features" && <FeaturesPanel editor={editor} />}
              {selection?.kind === "panel" && selection.id === "everyone" && <EveryoneInspector editor={editor} />}
              {!selection && <p className="text-sm text-muted">Sélectionnez un salon, une catégorie ou un rôle.</p>}
            </motion.div>
          </AnimatePresence>
        </section>

        {/* Aperçu */}
        <section className={cx("min-w-0", view === "edit" && "hidden lg:block")} aria-label="Aperçu">
          <div className="lg:sticky lg:top-36">
            <SpecPreview spec={spec} height={560} />
          </div>
        </section>
      </div>

      <QuickGuide />

      <AnimatePresence>
        {aiOpen && (
          <motion.div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAiOpen(false)}>
            <motion.aside
              role="dialog"
              aria-label="Modifications par l’IA"
              className="h-full w-full max-w-xl overflow-y-auto border-l-2 border-edge bg-paper p-5"
              initial={reduce ? false : { x: 40 }}
              animate={{ x: 0 }}
              exit={reduce ? undefined : { x: 40 }}
              transition={{ duration: 0.22, ease: [0.2, 0.9, 0.25, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">Modifier avec l’IA</h2>
                <Button variant="ghost" size="sm" onClick={() => setAiOpen(false)}>
                  Fermer
                </Button>
              </div>
              {!aiAvailable && <p className="mb-3 text-sm text-muted">Les modifications par IA font partie de l’offre Premium.</p>}
              {editor.status !== "saved" ? (
                <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">Enregistrement en cours… Les modifications IA s’appliquent sur la dernière version enregistrée : patientez un instant.</p>
              ) : (
                <AiPanel
                  projectId={project.id}
                  revision={editor.revision}
                  onApplied={(newSpec, revision) => {
                    editor.load(newSpec, revision);
                    setAiOpen(false);
                  }}
                />
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SaveBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    saved: ["Brouillon enregistré", "text-success"],
    dirty: ["Modifications non enregistrées", "text-muted"],
    saving: ["Enregistrement…", "text-muted"],
    error: ["Échec de l’enregistrement", "text-warning"],
    conflict: ["Conflit de version", "text-danger"],
  };
  const [label, cls] = map[status] ?? map.saved!;
  return (
    <span className={cx("hidden items-center gap-1 text-xs font-semibold sm:inline-flex", cls)} aria-live="polite">
      {status === "saved" && <IconCheck size={13} />}
      {label}
    </span>
  );
}
