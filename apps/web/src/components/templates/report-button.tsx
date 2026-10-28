"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, Notice } from "../ui";

const REASONS = {
  inappropriate: "Contenu inapproprié ou contraire aux règles de Discord",
  copyright: "Copie d’un serveur sans l’accord de ses responsables",
  misleading: "Description trompeuse ou template qui ne fonctionne pas",
  other: "Autre raison",
} as const;

/** Signaler un template public à l’équipe de modération. */
export function ReportButton({ slug, loggedIn }: { slug: string; loggedIn: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<keyof typeof REASONS>("inappropriate");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    const res = await fetch(`/api/templates/${slug}/report`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason, details: details || undefined }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Le signalement n’a pas pu être envoyé.");
      setState("idle");
      return;
    }
    setState("done");
  }

  return (
    <>
      <button
        type="button"
        className="text-xs font-semibold text-muted underline-offset-2 hover:text-danger hover:underline"
        onClick={() => (loggedIn ? ref.current?.showModal() : router.push(`/connexion?suivant=${encodeURIComponent(`/templates/${slug}`)}`))}
      >
        Signaler ce template
      </button>
      <dialog ref={ref} className="m-auto w-[min(520px,calc(100vw-2rem))] rounded-[18px] border border-edge bg-surface p-6 text-fg backdrop:bg-paper/80 backdrop:backdrop-blur-sm">
        {state === "done" ? (
          <div className="text-center">
            <p className="text-lg font-bold">Merci pour votre signalement</p>
            <p className="mt-1 text-sm text-muted">L’équipe va l’examiner rapidement.</p>
            <Button className="mt-4" variant="secondary" onClick={() => ref.current?.close()}>
              Fermer
            </Button>
          </div>
        ) : (
          <form onSubmit={send}>
            <p className="text-lg font-bold">Signaler ce template</p>
            <fieldset className="mt-3 space-y-1.5">
              {Object.entries(REASONS).map(([k, v]) => (
                <label key={k} className="flex cursor-pointer items-start gap-2 text-sm">
                  <input type="radio" name="reason" className="mt-1" checked={reason === k} onChange={() => setReason(k as keyof typeof REASONS)} />
                  {v}
                </label>
              ))}
            </fieldset>
            <textarea className="field mt-3 min-h-20" maxLength={1000} placeholder="Précisions (facultatif)" value={details} onChange={(e) => setDetails(e.target.value)} />
            {error && (
              <Notice tone="danger" className="mt-3">
                {error}
              </Notice>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => ref.current?.close()}>
                Annuler
              </Button>
              <Button type="submit" variant="danger" disabled={state === "busy"}>
                {state === "busy" ? "Envoi…" : "Envoyer le signalement"}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
