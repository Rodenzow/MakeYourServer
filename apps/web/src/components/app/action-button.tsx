"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "../ui";

/** Bouton qui appelle l’API (avec confirmation facultative) puis rafraîchit ou redirige. */
export function ActionButton({
  url,
  method = "POST",
  body,
  confirm,
  children,
  variant = "secondary",
  size = "sm",
  redirectTo,
  redirectFromResponse,
}: {
  url: string;
  method?: "POST" | "DELETE" | "PATCH" | "PUT";
  body?: unknown;
  confirm?: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  redirectTo?: string;
  /** Construit l’URL de redirection à partir de la réponse JSON. */
  redirectFromResponse?: (data: Record<string, unknown>) => string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        variant={variant}
        size={size}
        disabled={busy}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setBusy(true);
          setError(null);
          try {
            const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error ?? "Action impossible.");
            const to = redirectFromResponse ? redirectFromResponse(data) : redirectTo;
            if (to) router.push(to);
            else router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "…" : children}
      </Button>
      {error && (
        <span role="alert" className="max-w-xs text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
