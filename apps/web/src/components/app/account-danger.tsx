"use client";

import { useState } from "react";
import { Button, Notice } from "../ui";

/** Export des données et suppression définitive du compte. */
export function AccountDanger() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "La suppression a échoué.");
      setBusy(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <section className="panel p-5">
      <h2 className="text-lg font-bold">Mes données</h2>
      <p className="mt-1 text-sm text-muted">Téléchargez une copie de vos données, ou supprimez votre compte et tout ce qu’il contient.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href="/api/account/export" className="inline-flex h-8 items-center rounded-[11px] border border-edge bg-surface px-3 text-sm font-semibold hover:border-blue">
          Exporter mes données (JSON)
        </a>
        <Button variant="danger" size="sm" onClick={() => setOpen((o) => !o)}>
          Supprimer mon compte…
        </Button>
      </div>
      {open && (
        <div className="mt-4 rounded-xl border border-danger/40 bg-danger-soft/40 p-4 text-sm">
          <p>
            Seront supprimés définitivement : vos projets, sauvegardes et messages exportés, installations, générations IA et publications. Vos serveurs Discord ne sont pas modifiés ; retirez le bot
            depuis Discord si vous le souhaitez.
          </p>
          <label className="mt-3 block">
            <span className="label">Tapez SUPPRIMER pour confirmer</span>
            <input className="field max-w-xs" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </label>
          {error && (
            <Notice tone="danger" className="mt-3">
              {error}
            </Notice>
          )}
          <Button variant="danger" className="mt-3" disabled={confirm !== "SUPPRIMER" || busy} onClick={remove}>
            {busy ? "Suppression…" : "Supprimer définitivement"}
          </Button>
        </div>
      )}
    </section>
  );
}
