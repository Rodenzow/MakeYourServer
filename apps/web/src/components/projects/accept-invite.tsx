"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../ui";
import { IconArrowRight } from "../icons";
import { apiCall } from "./common";

/** Bouton « Rejoindre » de la page d’invitation. */
export function AcceptInvite({ token, projectName }: { token: string; projectName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const { projectId } = await apiCall<{ projectId: string }>(`/api/invitations/${encodeURIComponent(token)}/accept`, { method: "POST", body: {} });
      router.push(`/projets/${projectId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button size="lg" onClick={accept} disabled={busy} aria-label={`Rejoindre le projet ${projectName}`}>
        {busy ? "Un instant…" : "Rejoindre"} {!busy && <IconArrowRight size={18} />}
      </Button>
      {error && (
        <p role="alert" className="max-w-sm text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
