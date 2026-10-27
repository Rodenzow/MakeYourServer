"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Notice } from "../ui";
import { adminRequest } from "./client";

export interface PlanFormValues {
  key: string;
  name: string;
  priceLabel: string | null;
  description: string;
  purchasable: boolean;
  stripePriceId: string | null;
  discordSkuId: string | null;
  quotas: Record<string, number | boolean>;
}

/** Édition d’une offre : libellés, identifiants de paiement et quotas. */
export function PlanForm({ plan, quotaLabels }: { plan: PlanFormValues; quotaLabels: Record<string, string> }) {
  const router = useRouter();
  const [v, setV] = useState(plan);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const setQuota = (k: string, value: number | boolean) => {
    setSaved(false);
    setV((x) => ({ ...x, quotas: { ...x.quotas, [k]: value } }));
  };
  const set = <K extends keyof PlanFormValues>(k: K, value: PlanFormValues[K]) => {
    setSaved(false);
    setV((x) => ({ ...x, [k]: value }));
  };

  return (
    <form
      className="panel space-y-5 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await adminRequest(`/api/admin/plans/${v.key}`, "PUT", v);
          if (!r.ok) return setError(r.error);
          setSaved(true);
          router.refresh();
        });
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">
          {v.name} <span className="font-mono text-sm font-normal text-muted">({v.key})</span>
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${v.key}-name`}>Nom affiché</label>
          <input id={`${v.key}-name`} className="field" required maxLength={60} value={v.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={`${v.key}-price`}>Prix affiché (texte libre)</label>
          <input id={`${v.key}-price`} className="field" maxLength={80} value={v.priceLabel ?? ""} onChange={(e) => set("priceLabel", e.target.value || null)} placeholder="Ex. : 4,99 € / mois" />
          <p className="mt-1 text-xs text-muted">Purement informatif : le montant facturé est celui configuré chez Stripe ou dans le SKU Discord.</p>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor={`${v.key}-desc`}>Description</label>
          <textarea id={`${v.key}-desc`} className="field min-h-16" maxLength={500} value={v.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={`${v.key}-stripe`}>Identifiant de prix Stripe</label>
          <input id={`${v.key}-stripe`} className="field font-mono" value={v.stripePriceId ?? ""} onChange={(e) => set("stripePriceId", e.target.value.trim() || null)} placeholder="price_…" />
        </div>
        <div>
          <label className="label" htmlFor={`${v.key}-sku`}>SKU Discord (Premium Apps)</label>
          <input id={`${v.key}-sku`} className="field font-mono" value={v.discordSkuId ?? ""} onChange={(e) => set("discordSkuId", e.target.value.trim() || null)} placeholder="Identifiant numérique du SKU" />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2">
          <input type="checkbox" className="size-4 accent-[var(--color-night)]" checked={v.purchasable} onChange={(e) => set("purchasable", e.target.checked)} />
          Proposée à l’achat (nécessite un prix Stripe ou un SKU Discord)
        </label>
      </div>

      <fieldset>
        <legend className="eyebrow mb-3">Quotas (liés au compte, pas à un serveur)</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(quotaLabels).map(([k, label]) => {
            const value = v.quotas[k];
            const id = `${v.key}-q-${k}`;
            return typeof value === "boolean" ? (
              <label key={k} htmlFor={id} className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                <input id={id} type="checkbox" className="size-4 accent-[var(--color-night)]" checked={value} onChange={(e) => setQuota(k, e.target.checked)} />
                {label}
              </label>
            ) : (
              <div key={k} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-paper px-3 py-2">
                <label htmlFor={id} className="text-sm">{label}</label>
                <input id={id} type="number" min={0} step={1} className="field !w-36 text-right" value={Number(value ?? 0)} onChange={(e) => setQuota(k, Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
              </div>
            );
          })}
        </div>
      </fieldset>

      {error && <Notice tone="danger">{error}</Notice>}
      {saved && <Notice tone="success">Offre enregistrée. Les nouveaux quotas s’appliquent immédiatement.</Notice>}
      <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer l’offre"}</Button>
    </form>
  );
}
