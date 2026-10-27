"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "../ui";
import { adminRequest } from "./client";

/** Attribution manuelle du Premium (geste commercial, partenaires, tests). */
export function GrantPremiumForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [until, setUntil] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await adminRequest(`/api/admin/users/${userId}`, "POST", { action: "grant-premium", until: until || null, note: note || undefined });
          if (!r.ok) setError(r.error);
          else router.refresh();
        });
      }}
    >
      <div>
        <label className="label" htmlFor="premium-until">Fin (facultatif)</label>
        <input id="premium-until" type="date" className="field" value={until} onChange={(e) => setUntil(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="premium-note">Note interne</label>
        <input id="premium-note" className="field" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : partenaire, compensation incident…" />
      </div>
      <Button type="submit" size="md" disabled={pending}>
        {pending ? "…" : "Accorder le Premium"}
      </Button>
      {error && <p className="text-sm text-danger sm:col-span-3" role="alert">{error}</p>}
    </form>
  );
}
