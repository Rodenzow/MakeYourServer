"use client";

import { useState } from "react";
import { Button, Notice } from "@/components/ui";

async function redirectTo(endpoint: string, setError: (e: string | null) => void, setBusy: (b: boolean) => void) {
  setBusy(true);
  setError(null);
  try {
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
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
  return (
    <div className="space-y-2">
      <Button onClick={() => redirectTo("/api/billing/checkout", setError, setBusy)} disabled={busy}>
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
