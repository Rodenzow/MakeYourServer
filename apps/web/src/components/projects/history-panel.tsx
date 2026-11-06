"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { specStats, type ServerSpec } from "@mys/core";
import { SpecPreview } from "../spec/spec-preview";
import { Badge, Button, Notice, cx } from "../ui";
import { IconChevronDown, IconClock, IconSparkle, IconUndo } from "../icons";
import { ConfirmDialog, Modal, apiCall, fullDate, relativeTime } from "./common";

type Revision = {
  id: string;
  revision: number;
  author: "user" | "ai" | "restore";
  note: string | null;
  createdAt: string;
  stats: { roles: number; categories: number; channels: number; messages: number };
};

const AUTHORS: Record<Revision["author"], { label: string; tone: "neutral" | "blue" | "success"; icon: React.ReactNode }> = {
  user: { label: "Modification", tone: "neutral", icon: <IconClock size={12} /> },
  ai: { label: "IA", tone: "blue", icon: <IconSparkle size={12} /> },
  restore: { label: "Restauration", tone: "success", icon: <IconUndo size={12} /> },
};

/**
 * Historique des versions d’un projet : consultation, aperçu et restauration
 * (qui crée une nouvelle version : rien n’est jamais perdu).
 */
export function HistoryPanel({
  open,
  onClose,
  projectId,
  currentSpec,
  currentRevision,
  canRestore,
  onRestored,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  currentSpec: ServerSpec;
  currentRevision: number;
  /** Faux tant qu’un enregistrement est en cours (on restaure sur la dernière version enregistrée). */
  canRestore: boolean;
  onRestored: (spec: ServerSpec, revision: number, from: number) => void;
}) {
  const reduce = useReducedMotion();
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, ServerSpec | "loading" | { error: string }>>({});
  const [confirm, setConfirm] = useState<Revision | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiCall<{ revisions: Revision[] }>(`/api/projects/${projectId}/revisions`);
      setRevisions(data.revisions);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load, currentRevision]);

  async function loadPreview(r: Revision) {
    if (previews[r.id] && typeof previews[r.id] === "object" && !("error" in (previews[r.id] as object))) return;
    setPreviews((p) => ({ ...p, [r.id]: "loading" }));
    try {
      const data = await apiCall<{ revision: { spec: ServerSpec } }>(`/api/projects/${projectId}/revisions/${r.id}`);
      setPreviews((p) => ({ ...p, [r.id]: data.revision.spec }));
    } catch (e) {
      setPreviews((p) => ({ ...p, [r.id]: { error: (e as Error).message } }));
    }
  }

  async function restore() {
    if (!confirm) return;
    setBusy(true);
    setRestoreError(null);
    try {
      const data = await apiCall<{ spec: ServerSpec; revision: number }>(`/api/projects/${projectId}/revisions/${confirm.id}/restore`, { method: "POST", body: { revision: currentRevision } });
      const from = confirm.revision;
      setConfirm(null);
      onRestored(data.spec, data.revision, from);
    } catch (e) {
      const err = e as Error & { status?: number };
      setRestoreError(err.status === 409 ? "Le projet vient d’être modifié (par vous dans un autre onglet, ou par un co-gestionnaire). Rechargez la page pour récupérer la dernière version, puis réessayez." : err.message);
    } finally {
      setBusy(false);
    }
  }

  const current = specStats(currentSpec);
  const latest = revisions?.[0];

  return (
    <>
      <Modal open={open} onClose={onClose} variant="side" title="Historique des versions" description="Chaque enregistrement important crée une version. Restaurer une version en crée une nouvelle : vous pourrez toujours revenir en arrière.">
        {!canRestore && (
          <Notice tone="warning" className="mb-4">
            Enregistrement en cours… Patientez un instant avant de restaurer une version.
          </Notice>
        )}
        {error ? (
          <Notice tone="danger" title="Impossible d’afficher l’historique">
            {error}{" "}
            <button type="button" className="font-semibold underline" onClick={() => void load()}>
              Réessayer
            </button>
          </Notice>
        ) : !revisions ? (
          <ul className="space-y-3" aria-busy="true" aria-label="Chargement de l’historique">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="h-16 animate-pulse rounded-xl bg-mist" />
            ))}
          </ul>
        ) : revisions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
            <IconClock size={28} className="mx-auto text-muted" />
            <p className="mt-2 font-semibold">Pas encore d’historique</p>
            <p className="mt-1 text-sm text-muted">Les versions apparaîtront ici au fil de vos modifications.</p>
          </div>
        ) : (
          <ol className="relative space-y-2 before:absolute before:top-3 before:bottom-3 before:left-[15px] before:w-px before:bg-line" aria-label="Versions, de la plus récente à la plus ancienne">
            {revisions.map((r, index) => {
              const a = AUTHORS[r.author] ?? AUTHORS.user;
              const isCurrent = index === 0 && r.revision === currentRevision;
              const isOpen = expanded === r.id;
              const preview = previews[r.id];
              const delta = (n: number, cur: number) => (n === cur ? null : `${n > cur ? "+" : ""}${n - cur}`);
              return (
                <motion.li key={r.id} initial={reduce ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, delay: Math.min(index, 8) * 0.025 }} className="relative pl-10">
                  <span aria-hidden className={cx("absolute top-3 left-[9px] grid size-[13px] place-items-center rounded-full border-2", isCurrent ? "border-light bg-accent" : "border-line bg-surface")} />
                  <div className={cx("rounded-xl border bg-surface transition-colors", isOpen ? "border-edge" : "border-line hover:border-edge")}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
                      aria-expanded={isOpen}
                      aria-controls={`version-${r.id}`}
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">Version {r.revision}</span>
                          <Badge tone={a.tone}>
                            {a.icon} {a.label}
                          </Badge>
                          {isCurrent && <Badge tone="success">Version actuelle</Badge>}
                        </span>
                        {r.note && <span className="mt-0.5 block text-sm text-ink">{r.note}</span>}
                        <span className="mt-0.5 block text-xs text-muted">
                          <time dateTime={r.createdAt} title={fullDate(r.createdAt)}>
                            {relativeTime(r.createdAt)}
                          </time>{" "}
                          · {r.stats.channels} salons · {r.stats.roles} rôles
                        </span>
                      </span>
                      <IconChevronDown size={16} className={cx("mt-1 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          id={`version-${r.id}`}
                          initial={reduce ? false : { height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={reduce ? undefined : { height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-3 border-t border-line px-3 py-3">
                            <dl className="grid grid-cols-4 gap-2 text-center">
                              {(
                                [
                                  ["Catégories", r.stats.categories, current.categories],
                                  ["Salons", r.stats.channels, current.channels],
                                  ["Rôles", r.stats.roles, current.roles],
                                  ["Messages", r.stats.messages, current.messages],
                                ] as const
                              ).map(([label, n, cur]) => (
                                <div key={label} className="rounded-lg bg-night px-1 py-2">
                                  <dt className="text-[11px] text-muted">{label}</dt>
                                  <dd className="font-display text-lg font-bold">{n}</dd>
                                  {delta(n, cur) && <dd className="text-[11px] text-muted">{delta(n, cur)} par rapport à maintenant</dd>}
                                </div>
                              ))}
                            </dl>
                            {preview && typeof preview === "object" && !("error" in preview) ? (
                              <div className="overflow-hidden rounded-xl border border-line">
                                <SpecPreview spec={preview as ServerSpec} height={340} />
                              </div>
                            ) : preview && typeof preview === "object" && "error" in preview ? (
                              <p role="alert" className="text-sm text-danger">
                                {preview.error}
                              </p>
                            ) : (
                              <Button variant="secondary" size="sm" onClick={() => void loadPreview(r)} disabled={preview === "loading"}>
                                {preview === "loading" ? "Chargement de l’aperçu…" : "Voir l’aperçu de cette version"}
                              </Button>
                            )}
                            {!isCurrent && (
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs text-muted">Votre version actuelle restera dans l’historique.</p>
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setRestoreError(null);
                                    setConfirm(r);
                                  }}
                                  disabled={!canRestore}
                                >
                                  <IconUndo size={14} /> Restaurer cette version
                                </Button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        )}
        {latest && latest.revision !== currentRevision && (
          <p className="mt-4 text-xs text-muted">Les enregistrements automatiques rapprochés sont regroupés : la version en cours d’édition ({currentRevision}) n’a pas toujours sa propre ligne.</p>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={`Restaurer la version ${confirm?.revision ?? ""} ?`}
        confirmLabel="Restaurer cette version"
        busy={busy}
        error={restoreError}
        onCancel={() => setConfirm(null)}
        onConfirm={restore}
      >
        <p>
          Le projet reprendra exactement le contenu de la version {confirm?.revision}
          {confirm ? ` (${confirm.stats.channels} salons, ${confirm.stats.roles} rôles)` : ""}. Une nouvelle version « Restauration de la version {confirm?.revision} » sera créée : votre version actuelle reste
          dans l’historique.
        </p>
        <p className="mt-2 text-muted">Rien n’est modifié sur Discord tant que vous n’installez pas le projet.</p>
      </ConfirmDialog>
    </>
  );
}
