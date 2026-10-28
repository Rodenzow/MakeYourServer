"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Notice } from "@/components/ui";

async function redirectTo(endpoint: string, setError: (e: string | null) => void, setBusy: (b: boolean) => void, body: unknown = {}) {
  setBusy(true);
  setError(null);
  try {
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !data.url) throw new Error(data.error ?? "Opération impossible pour le moment.");
    window.location.assign(data.url);
  } catch (e) {
    setError((e as Error).message);
    setBusy(false);
  }
}

export function CheckoutButton({ label = "Payer par carte (Stripe)" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-start gap-2 text-xs text-ink">
        <input type="checkbox" className="mt-0.5 size-4 shrink-0" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span>
          J’accepte les{" "}
          <Link href="/conditions" target="_blank" className="link">
            conditions d’utilisation
          </Link>
          , je demande l’accès immédiat au Premium et renonce à mon droit de rétractation de 14 jours.
        </span>
      </label>
      <Button onClick={() => redirectTo("/api/billing/checkout", setError, setBusy, { acceptTerms: true, waiveWithdrawal: true })} disabled={busy || !accepted}>
        {busy ? "Redirection…" : label}
      </Button>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}

export function PortalButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button variant="secondary" size="sm" onClick={() => redirectTo("/api/billing/portal", setError, setBusy)} disabled={busy}>
        {busy ? "Redirection…" : "Gérer mon abonnement (factures, résiliation)"}
      </Button>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}
