"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "../ui";
import { adminRequest } from "./client";

/**
 * Bouton d’action d’administration : confirmation, saisie facultative
 * (motif, note), puis rafraîchissement de la page.
 */
export function ActionButton({
  url,
  method = "POST",
  body,
  label,
  confirm,
  prompt,
  promptKey = "reason",
  promptRequired = false,
  variant = "secondary",
  size = "sm",
  successMessage,
  redirectTo,
}: {
  url: string;
  method?: "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  label: string;
  confirm?: string;
  prompt?: string;
  promptKey?: string;
  promptRequired?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  successMessage?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const run = () => {
    setError(null);
    setDone(null);
    let extra: Record<string, unknown> = {};
    if (prompt) {
      const value = window.prompt(prompt);
      if (value === null) return;
      if (promptRequired && !value.trim()) {
        setError("Ce champ est obligatoire.");
        return;
      }
      extra = { [promptKey]: value.trim() };
    } else if (confirm && !window.confirm(confirm)) return;
    start(async () => {
      const r = await adminRequest(url, method, body || prompt ? { ...body, ...extra } : undefined);
      if (!r.ok) return setError(r.error);
      if (successMessage) setDone(successMessage);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button type="button" variant={variant} size={size} onClick={run} disabled={pending}>
        {pending ? "…" : label}
      </Button>
      {error && <span className="text-xs text-danger" role="alert">{error}</span>}
      {done && <span className="text-xs text-success">{done}</span>}
    </span>
  );
}
