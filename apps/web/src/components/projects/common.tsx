"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button, cx } from "../ui";
import { IconX } from "../icons";

const EASE = [0.2, 0.9, 0.25, 1] as const;

/** « il y a 5 minutes », « hier », « il y a 3 jours »… */
export function relativeTime(date: Date | string, now = Date.now()) {
  const d = new Date(date).getTime();
  const diff = Math.round((d - now) / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  if (abs < 45) return "à l’instant";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), "month");
  return rtf.format(Math.round(diff / (86400 * 365)), "year");
}

export const fullDate = (d: Date | string) => new Date(d).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });

/** Avatar Discord, ou initiale sur fond coloré si la personne n’en a pas. */
export function Avatar({ name, url, size = 32, className }: { name: string; url?: string | null; size?: number; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} loading="lazy" className={cx("shrink-0 rounded-full border border-line object-cover", className)} style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className={cx("grid shrink-0 place-items-center rounded-full font-semibold text-white", className)} style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue} 45% 45%)` }}>
      {initial}
    </span>
  );
}

/**
 * Fenêtre modale accessible (élément <dialog> natif : focus piégé, Échap pour
 * fermer, arrière-plan inerte), centrée ou en panneau latéral.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  variant = "center",
  role,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  variant?: "center" | "side";
  role?: "dialog" | "alertdialog";
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const reduce = useReducedMotion();
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const side = variant === "side";
  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx(
        "bg-transparent p-0 text-fg backdrop:bg-paper/75 backdrop:backdrop-blur-sm",
        side ? "fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-xl" : "m-auto w-[min(600px,calc(100vw-2rem))] max-h-[88dvh]",
        className,
      )}
    >
      {open && (
        <motion.div
          initial={reduce ? false : side ? { x: 36, opacity: 0 } : { y: 10, opacity: 0, scale: 0.98 }}
          animate={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          transition={{ duration: 0.22, ease: EASE }}
          className={cx("flex flex-col overflow-hidden border-edge bg-surface shadow-2xl", side ? "h-full border-l-2" : "max-h-[88dvh] rounded-[18px] border")}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-xl font-bold">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-sm text-muted">
                  {description}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer">
              <IconX size={16} />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </motion.div>
      )}
    </dialog>
  );
}

/** Demande de confirmation (fenêtre d’alerte accessible). */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = "primary",
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={() => !busy && onCancel()} title={title} role="alertdialog" className="w-[min(480px,calc(100vw-2rem))]">
      {children && <div className="text-sm text-ink">{children}</div>}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Annuler
        </Button>
        <Button variant={tone} onClick={onConfirm} disabled={busy} autoFocus>
          {busy ? "Un instant…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/** Appel JSON vers l’API du site, avec un message d’erreur lisible. */
export async function apiCall<T = Record<string, unknown>>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new Error("Connexion impossible. Vérifiez votre connexion Internet puis réessayez.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((data as { error?: string }).error ?? "Une erreur est survenue. Réessayez dans un instant."), { status: res.status, code: (data as { code?: string }).code });
  return data as T;
}
