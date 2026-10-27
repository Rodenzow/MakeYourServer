"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import type { ServerSpec } from "@mys/core";
import { Button, Notice, buttonClass } from "../ui";
import { IconSparkle } from "../icons";
import { ChangeList, type ChangePreviewData } from "./change-list";
import { ThinkingIndicator } from "./thinking-indicator";
import { postJson } from "./api";

interface Status {
  enabled: boolean;
  configured: boolean;
  simulated: boolean;
  premium: boolean;
  edits: { used: number; limit: number };
}

interface EditResult {
  generationId: string;
  changeSet: { summary: string };
  previews: ChangePreviewData[];
  revision: number;
  simulated: boolean;
}

const SUGGESTIONS = ["Simplifie les salons", "Ajoute un espace événements", "Réécris le règlement", "Rends le ton plus professionnel", "Ajoute un onboarding avec des centres d’intérêt"];

/**
 * Modifications ciblées par IA dans l’éditeur. L’IA propose ; l’utilisateur choisit
 * les changements à appliquer. Rien n’est installé sur Discord à cette étape.
 */
export function AiPanel({ projectId, revision, onApplied }: { projectId: string; revision: number; onApplied: (spec: ServerSpec, revision: number) => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [instruction, setInstruction] = useState("");
  const [lockRoles, setLockRoles] = useState(false);
  const [noRemovals, setNoRemovals] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EditResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  async function propose() {
    setLoading(true);
    setError(null);
    setDone(null);
    setResult(null);
    try {
      const res = await postJson<EditResult>("/api/ai/edit", { projectId, instruction, lockRoles, noRemovals });
      setResult(res);
      setSelected(new Set(res.previews.filter((p) => p.valid).map((p) => p.index)));
      setStatus((s) => (s ? { ...s, edits: { ...s.edits, used: s.edits.used + 1 } } : s));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!result) return;
    setApplying(true);
    setError(null);
    try {
      const res = await postJson<{ spec: ServerSpec; revision: number }>(`/api/ai/generations/${result.generationId}/apply`, { accepted: [...selected], revision });
      onApplied(res.spec, res.revision);
      setDone(`${selected.size} modification(s) appliquée(s) au brouillon. Vous pouvez les ajuster ou revenir à la version précédente dans l’historique.`);
      setResult(null);
      setInstruction("");
    } catch (e) {
      const err = e as Error & { status?: number };
      setError(err.status === 409 ? "Le projet a été modifié entre-temps (autre onglet ou enregistrement). Enregistrez ou rechargez puis relancez la demande." : err.message);
    } finally {
      setApplying(false);
    }
  }

  async function reject() {
    if (!result) return;
    await postJson(`/api/ai/generations/${result.generationId}/reject`, {}).catch(() => {});
    setResult(null);
  }

  if (status && !status.premium) {
    return (
      <div className="panel blueprint p-5">
        <p className="flex items-center gap-2 font-display font-semibold">
          <IconSparkle /> Modifications par IA
        </p>
        <p className="mt-2 text-sm text-muted">Décrivez un changement (« Ajoute un espace événements », « Réécris le règlement ») et l’IA propose des modifications à accepter une par une. Fonction réservée au Premium.</p>
        <Link href="/abonnement" className={buttonClass("primary", "sm", "mt-4")}>
          Découvrir le Premium
        </Link>
      </div>
    );
  }

  const remaining = status ? Math.max(0, status.edits.limit - status.edits.used) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display font-semibold">
          <IconSparkle /> Modifier avec l’IA
        </p>
        {remaining !== null && <span className="text-xs text-muted">{remaining} modification(s) restante(s) ce mois-ci</span>}
      </div>
      {status?.simulated && (
        <Notice tone="warning" title="Mode simulation">
          Réponses simulées (AI_PROVIDER=mock) : utiles pour tester, sans appel à un vrai modèle.
        </Notice>
      )}
      {status && !status.configured && (
        <Notice tone="warning" title="IA non configurée">
          La clé ANTHROPIC_API_KEY n’est pas renseignée. Un abonnement personnel à Claude ne donne pas accès à l’API.
        </Notice>
      )}

      {!result && !loading && (
        <div className="space-y-3">
          <label className="label" htmlFor="ai-instruction">
            Que voulez-vous changer ?
          </label>
          <textarea
            id="ai-instruction"
            className="field min-h-24"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Ex. : Ajoute un espace pour les collaborations entre artistes, avec un forum et un salon vocal."
            maxLength={1500}
          />
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => setInstruction(s)} className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs hover:border-edge">
                {s}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-[var(--color-blue)]" checked={lockRoles} onChange={(e) => setLockRoles(e.target.checked)} />
              Conserver mes rôles actuels
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-[var(--color-blue)]" checked={noRemovals} onChange={(e) => setNoRemovals(e.target.checked)} />
              Ne rien supprimer
            </label>
          </div>
          <Button onClick={propose} disabled={instruction.trim().length < 5 || (status !== null && !status.enabled)}>
            Proposer des modifications
          </Button>
        </div>
      )}

      {loading && <ThinkingIndicator label="L’IA prépare ses propositions" steps={["Lecture de votre projet…", "Préparation des changements ciblés…", "Vérification par le moteur…"]} />}

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Notice tone="danger">{error}</Notice>
          </motion.div>
        )}
        {done && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Notice tone="success">{done}</Notice>
          </motion.div>
        )}
      </AnimatePresence>

      {result && (
        <div className="space-y-3">
          {result.simulated && <p className="text-xs font-semibold text-warning">Réponse simulée</p>}
          <p className="text-sm text-ink">{result.changeSet.summary}</p>
          <ChangeList
            previews={result.previews}
            selected={selected}
            disabled={applying}
            onToggle={(i) =>
              setSelected((s) => {
                const n = new Set(s);
                if (n.has(i)) n.delete(i);
                else n.add(i);
                return n;
              })
            }
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={apply} disabled={!selected.size || applying}>
              {applying ? "Application…" : `Appliquer ${selected.size} modification(s)`}
            </Button>
            <Button variant="ghost" onClick={reject} disabled={applying}>
              Tout refuser
            </Button>
          </div>
          <p className="text-xs text-muted">Les modifications sont appliquées à votre brouillon uniquement. L’installation sur Discord reste une étape séparée, avec analyse et confirmation.</p>
        </div>
      )}
    </div>
  );
}
