"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getGlossaryEntry } from "@/lib/glossary";
import { cx } from "../ui";

/**
 * Mot du glossaire avec sa définition en infobulle.
 *
 *   <Term id="role">rôle</Term>
 *
 * Accessibilité :
 * - le mot est un bouton : il reçoit le focus au clavier (Tab) ;
 * - la définition est reliée par aria-describedby : un lecteur d’écran la lit avec le mot ;
 * - l’infobulle s’ouvre au survol, au focus et au toucher (mobile) ; elle reste ouverte
 *   quand le pointeur passe dessus ; Échap, un clic ailleurs ou la perte du focus la ferment.
 */
export function Term({ id, children, className }: { id: string; children?: ReactNode; className?: string }) {
  const entry = getGlossaryEntry(id);
  const tipId = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; below: boolean } | null>(null);
  const btn = useRef<HTMLSpanElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedAt = useRef(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const show = useCallback(() => {
    cancelClose();
    setOpen((was) => {
      if (!was) openedAt.current = Date.now();
      return true;
    });
  }, []);
  const hideSoon = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  const place = useCallback(() => {
    const b = btn.current?.getBoundingClientRect();
    const t = tip.current;
    if (!b || !t) return;
    const margin = 12;
    const w = t.offsetWidth;
    const h = t.offsetHeight;
    const below = b.top - h - 10 < margin;
    const left = Math.min(Math.max(b.left + b.width / 2 - w / 2, margin), window.innerWidth - w - margin);
    const top = below ? b.bottom + 8 : b.top - h - 8;
    setPos({ top, left, below });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!btn.current?.contains(target) && !tip.current?.contains(target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useEffect(() => cancelClose, []);

  if (!entry) return <>{children}</>;
  const label = children ?? entry.term;

  return (
    <>
      {/* Un <span role="button"> plutôt qu’un <button> : il se coupe en fin de ligne comme du texte normal. */}
      <span
        ref={btn}
        role="button"
        tabIndex={0}
        className={cx("cursor-help rounded-[3px] underline decoration-peri/80 decoration-dotted decoration-[1.5px] underline-offset-[3px] hover:decoration-solid", className)}
        aria-describedby={tipId}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (open) setOpen(false);
            else show();
          }
        }}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={hideSoon}
        onClick={(e) => {
          // Au toucher (mobile), un premier appui ouvre, un second ferme.
          e.preventDefault();
          e.stopPropagation();
          const touch = e.detail > 0 && (e.nativeEvent as PointerEvent).pointerType !== "mouse";
          if (open && touch && Date.now() - openedAt.current > 400) setOpen(false);
          else show();
        }}
      >
        {label}
      </span>
      {mounted &&
        createPortal(
          <span
            ref={tip}
            id={tipId}
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={hideSoon}
            style={pos ? { top: pos.top, left: pos.left } : undefined}
            className={cx(
              "fixed z-[60] w-max max-w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-edge bg-night px-3.5 py-2.5 text-left text-sm font-normal normal-case leading-snug tracking-normal text-ink shadow-[4px_4px_0_0_rgb(131_168_243/0.28)]",
              open ? (pos ? "visible opacity-100" : "invisible opacity-0") : "hidden",
            )}
          >
            <span className="mb-0.5 block font-display font-semibold text-fg">{entry.term}</span>
            <span className="sr-only"> : </span>
            {entry.short}
          </span>,
          document.body,
        )}
    </>
  );
}
