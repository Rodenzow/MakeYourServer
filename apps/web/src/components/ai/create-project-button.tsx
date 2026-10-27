"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice } from "../ui";
import { postJson } from "./api";

export function CreateProjectButton({ generationId }: { generationId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await postJson<{ projectId: string }>(`/api/ai/generations/${generationId}/project`, {});
            router.push(`/projets/${res.projectId}`);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? "Création…" : "Créer le projet à partir de cette conception"}
      </Button>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}
