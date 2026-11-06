"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { TemplateAdditions } from "@mys/core";
import { Button, Notice, colorHex } from "../ui";
import { ChannelIcon, IconShield, IconSparkle } from "../icons";
import { Modal, apiCall, relativeTime } from "./common";

export type UpdateNotice = { projectId: string; projectName: string; templateName: string; templateSlug: string; updatedAt: string | Date; summary?: string };
type Preview = { template: { name: string; slug: string; updatedAt: string | null }; pending: boolean; added: TemplateAdditions; count: number; summary: string };

/** Clé de stockage local : liste des nouveautés ajoutées, affichée ensuite dans l’éditeur. */
export const additionsKey = (projectId: string) => `mys:nouveautes:${projectId}`;

/**
 * Avis « Le template X a été amélioré » (tableau de bord, liste des projets),
 * avec « Voir les nouveautés » et « Ignorer ».
 */
export function TemplateUpdateNotices({ notices, compact }: { notices: UpdateNotice[]; compact?: boolean }) {
  const reduce = useReducedMotion();
  const [hidden, setHidden] = useState<string[]>([]);
  const visible = notices.filter((n) => !hidden.includes(n.projectId));
  if (!visible.length) return null;
  return (
    <section aria-label="Mises à jour de templates" className="space-y-3">
      <AnimatePresence initial={false}>
        {visible.map((n) => (
          <motion.div key={n.projectId} layout={!reduce} initial={reduce ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, height: 0, marginTop: 0 }} className="overflow-hidden">
            <UpdateCard notice={n} compact={compact} onHidden={() => setHidden((h) => [...h, n.projectId])} />
          </motion.div>
        ))}
      </AnimatePresence>
    </section>
  );
}

function UpdateCard({ notice, compact, onHidden }: { notice: UpdateNotice; compact?: boolean; onHidden: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function dismiss() {
    setBusy(true);
    setError(null);
    try {
      await apiCall(`/api/projects/${notice.projectId}/template-update`, { method: "DELETE" });
      onHidden();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-l-4 border-line border-l-blue bg-blue/[0.07] px-4 py-3 sm:flex-row sm:items-center">
      <span className="hidden size-9 shrink-0 place-items-center rounded-lg bg-blue/15 text-blue-strong sm:grid" aria-hidden>
        <IconSparkle size={18} />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-fg">{`Le template « ${notice.templateName} » a été amélioré`}</p>
        <p className="text-ink">
          {compact
            ? `Projet « ${notice.projectName} »`
            : `Votre projet « ${notice.projectName} » peut recevoir ses nouveautés${notice.summary ? ` (${notice.summary})` : ""}. Vos personnalisations ne seront ni supprimées ni modifiées.`}
        </p>
        <p className="text-xs text-muted" suppressHydrationWarning>
          {`Amélioré ${relativeTime(notice.updatedAt)}`}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-danger">
            {error}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog">
          Voir les nouveautés
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss} disabled={busy}>
          {busy ? "…" : "Ignorer"}
        </Button>
      </div>
      <TemplateUpdateDialog open={open} onClose={() => setOpen(false)} notice={notice} onDismissed={onHidden} />
    </div>
  );
}

export function TemplateUpdateDialog({ open, onClose, notice, onDismissed }: { open: boolean; onClose: () => void; notice: UpdateNotice; onDismissed: () => void }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"apply" | "dismiss" | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPreview(null);
    apiCall<Preview>(`/api/projects/${notice.projectId}/template-update`)
      .then(setPreview)
      .catch((e: Error) => setError(e.message));
  }, [open, notice.projectId]);

  async function apply() {
    setBusy("apply");
    setError(null);
    try {
      const res = await apiCall<{ added: TemplateAdditions; count: number }>(`/api/projects/${notice.projectId}/template-update`, { method: "POST", body: {} });
      if (res.count === 0) {
        onDismissed();
        onClose();
        router.refresh();
        return;
      }
      try {
        sessionStorage.setItem(additionsKey(notice.projectId), JSON.stringify({ templateName: notice.templateName, added: res.added }));
      } catch {
        /* stockage indisponible : l’éditeur affichera un message générique */
      }
      router.push(`/projets/${notice.projectId}?nouveautes=1`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function dismiss() {
    setBusy("dismiss");
    try {
      await apiCall(`/api/projects/${notice.projectId}/template-update`, { method: "DELETE" });
      onDismissed();
      onClose();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={open} onClose={() => busy === null && onClose()} title={`Nouveautés de « ${notice.templateName} »`} description={`Pour votre projet « ${notice.projectName} ».`}>
      {error && (
        <Notice tone="danger" className="mb-4">
          {error}
        </Notice>
      )}
      {!preview && !error && (
        <div className="space-y-2" aria-busy="true" aria-label="Recherche des nouveautés">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-mist" />
          ))}
        </div>
      )}
      {preview && preview.count === 0 && (
        <div className="py-4 text-center">
          <p className="font-semibold">Votre projet est déjà à jour</p>
          <p className="mt-1 text-sm text-muted">Tout ce que le template apporte de nouveau est déjà présent dans votre projet (ou vous l’aviez retiré volontairement).</p>
          <div className="mt-5 flex justify-center">
            <Button onClick={apply} disabled={busy !== null}>
              {busy === "apply" ? "…" : "Masquer cet avis"}
            </Button>
          </div>
        </div>
      )}
      {preview && preview.count > 0 && (
        <>
          <p className="text-sm text-ink">
            À ajouter à votre projet : <strong>{preview.summary}</strong>. Rien n’est supprimé ni remplacé : vos noms, couleurs, messages et réglages restent les vôtres.
          </p>
          <AdditionsList added={preview.added} className="mt-4" />
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-night p-3 text-sm text-ink">
            <IconShield size={16} className="mt-0.5 shrink-0 text-light" />
            <p>
              Les nouveautés sont d’abord ajoutées au <strong>projet</strong> : relisez-les dans l’éditeur, puis installez en mode « Ajout à un serveur existant ». Votre serveur Discord n’est pas modifié avant cette étape.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={dismiss} disabled={busy !== null}>
              {busy === "dismiss" ? "…" : "Ignorer ces nouveautés"}
            </Button>
            <Button onClick={apply} disabled={busy !== null}>
              {busy === "apply" ? "Ajout en cours…" : "Ajouter au projet et relire"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

type AdditionKind = "role" | "category" | "channel" | "message" | "automod" | "onboarding";

function AdditionItem({ kind, id, onSelect, children }: { kind: AdditionKind; id: string; onSelect?: (kind: AdditionKind, id: string) => void; children: React.ReactNode }) {
  if (!onSelect) return <li className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-sm">{children}</li>;
  return (
    <li>
      <button type="button" onClick={() => onSelect(kind, id)} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-left text-sm hover:border-edge">
        {children}
      </button>
    </li>
  );
}

/** Liste lisible des éléments ajoutés (cliquables dans l’éditeur via `onSelect`). */
export function AdditionsList({ added, className, onSelect }: { added: TemplateAdditions; className?: string; onSelect?: (kind: AdditionKind, id: string) => void }) {
  const p = { onSelect };
  const groups: Array<[string, React.ReactNode[]]> = [
    ["Rôles", added.roles.map((r) => <AdditionItem key={r.id} kind="role" id={r.id} {...p}><span className="size-2.5 rounded-full" style={{ background: colorHex(r.color) }} aria-hidden />{r.name}</AdditionItem>)],
    ["Catégories", added.categories.map((c) => <AdditionItem key={c.id} kind="category" id={c.id} {...p}>{c.name}<span className="text-xs text-muted">({c.channels} salon{c.channels > 1 ? "s" : ""})</span></AdditionItem>)],
    ["Salons", added.channels.map((c) => <AdditionItem key={c.id} kind="channel" id={c.id} {...p}><ChannelIcon type={c.type} size={14} className="text-muted" />{c.name}{c.categoryName && <span className="text-xs text-muted">· {c.categoryName}</span>}</AdditionItem>)],
    ["Messages", added.messages.map((m) => <AdditionItem key={m.id} kind="message" id={m.id} {...p}><span className="max-w-[16rem] truncate">{m.title}</span><span className="text-xs text-muted">· #{m.channelName}</span></AdditionItem>)],
    ["Règles AutoMod", added.automod.map((a) => <AdditionItem key={a.id} kind="automod" id={a.id} {...p}>{a.name}</AdditionItem>)],
    ["Questions d’accueil (onboarding)", added.onboardingPrompts.map((q) => <AdditionItem key={q.id} kind="onboarding" id={q.id} {...p}>{q.title}</AdditionItem>)],
  ];
  return (
    <div className={className}>
      {groups
        .filter(([, items]) => items.length)
        .map(([label, items]) => (
          <div key={label} className="mb-3">
            <p className="mb-1.5 text-xs font-semibold text-muted">
              {label} ({items.length})
            </p>
            <ul className="flex flex-wrap gap-1.5">{items}</ul>
          </div>
        ))}
    </div>
  );
}
