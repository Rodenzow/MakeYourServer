"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Notice } from "../ui";
import { adminRequest } from "./client";

function useSave(url: string) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const save = (body: unknown) => {
    setError(null);
    setSaved(false);
    start(async () => {
      const r = await adminRequest(url, "PUT", body);
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
    });
  };
  return { error, saved, pending, save };
}

export interface AiSettingsValues {
  enabled: boolean;
  model: string;
  inputMicrosPerMTok: number;
  outputMicrosPerMTok: number;
  maxOutputTokens: number;
  monthlyBudgetMicros: number;
}

const toUsd = (m: number) => (m / 1_000_000).toString();
const fromUsd = (s: string) => Math.max(0, Math.round((Number(s.replace(",", ".")) || 0) * 1_000_000));

/** Réglages IA : modèle, prix fournisseur (USD) et budget global. */
export function AiSettingsForm({ initial }: { initial: AiSettingsValues }) {
  const { error, saved, pending, save } = useSave("/api/admin/settings/ai");
  const [v, setV] = useState({ ...initial, input: toUsd(initial.inputMicrosPerMTok), output: toUsd(initial.outputMicrosPerMTok), budget: toUsd(initial.monthlyBudgetMicros) });
  return (
    <form
      className="panel space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        save({
          enabled: v.enabled,
          model: v.model.trim(),
          inputMicrosPerMTok: fromUsd(v.input),
          outputMicrosPerMTok: fromUsd(v.output),
          maxOutputTokens: Math.max(1000, Math.floor(Number(v.maxOutputTokens) || 0)),
          monthlyBudgetMicros: fromUsd(v.budget),
        });
      }}
    >
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="size-4 accent-[var(--color-blue)]" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} />
        Conception IA activée pour les comptes Premium
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="ai-model">Modèle</label>
          <input id="ai-model" className="field font-mono" required value={v.model} onChange={(e) => setV({ ...v, model: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="ai-max">Jetons de sortie maximum par requête</label>
          <input id="ai-max" type="number" min={1000} className="field" value={v.maxOutputTokens} onChange={(e) => setV({ ...v, maxOutputTokens: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label" htmlFor="ai-in">Prix d’entrée ($ US par million de jetons)</label>
          <input id="ai-in" inputMode="decimal" className="field" value={v.input} onChange={(e) => setV({ ...v, input: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="ai-out">Prix de sortie ($ US par million de jetons)</label>
          <input id="ai-out" inputMode="decimal" className="field" value={v.output} onChange={(e) => setV({ ...v, output: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="ai-budget">Budget mensuel de la plateforme ($ US)</label>
          <input id="ai-budget" inputMode="decimal" className="field md:max-w-xs" value={v.budget} onChange={(e) => setV({ ...v, budget: e.target.value })} />
          <p className="mt-1 text-xs text-muted">Une fois le budget atteint, les nouvelles requêtes IA sont refusées jusqu’au mois suivant. 0 bloque l’IA.</p>
        </div>
      </div>
      <p className="text-xs text-muted">Les prix servent à estimer et plafonner les coûts : reportez ceux de votre contrat fournisseur (facturés en dollars US).</p>
      {error && <Notice tone="danger">{error}</Notice>}
      {saved && <Notice tone="success">Réglages IA enregistrés.</Notice>}
      <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
    </form>
  );
}

export interface MaintenanceValues {
  enabled: boolean;
  message: string;
  blockInstalls: boolean;
}

export function MaintenanceForm({ initial }: { initial: MaintenanceValues }) {
  const { error, saved, pending, save } = useSave("/api/admin/settings/maintenance");
  const [v, setV] = useState(initial);
  return (
    <form
      className="panel space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        save(v);
      }}
    >
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="size-4 accent-[var(--color-blue)]" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} />
        Afficher le bandeau de maintenance
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="size-4 accent-[var(--color-blue)]" checked={v.blockInstalls} onChange={(e) => setV({ ...v, blockInstalls: e.target.checked })} />
        Bloquer les nouvelles installations (celles en cours se terminent)
      </label>
      <div>
        <label className="label" htmlFor="mt-msg">Message affiché aux utilisateurs</label>
        <textarea id="mt-msg" className="field min-h-20" maxLength={300} value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} />
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {saved && <Notice tone="success">Mode maintenance mis à jour.</Notice>}
      <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
    </form>
  );
}
