"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../ui";

export function NewBlankProject() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-start gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: "blank", name }) });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error);
          setBusy(false);
          return;
        }
        router.push(`/projets/${data.project.id}`);
      }}
    >
      <input className="field !w-64" placeholder="Nom du serveur" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={100} required aria-label="Nom du nouveau projet" />
      <Button type="submit" variant="secondary" disabled={busy}>
        {busy ? "Création…" : "Projet vierge"}
      </Button>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </form>
  );
}
