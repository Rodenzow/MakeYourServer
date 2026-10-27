"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { UseTemplateButton } from "./use-template-button";

/** Barre d’action qui apparaît en bas de l’écran dès que le bouton principal n’est plus visible. */
export function StickyCta({ slug, name, loggedIn, watchId }: { slug: string; name: string; loggedIn: boolean; watchId: string }) {
  const [show, setShow] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = document.getElementById(watchId);
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShow(!e!.isIntersecting && e!.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [watchId]);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="glass fixed inset-x-0 bottom-0 z-30 border-t border-line"
          initial={reduce ? false : { y: 80 }}
          animate={{ y: 0 }}
          exit={reduce ? undefined : { y: 80 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <p className="min-w-0 truncate">
              <span className="text-muted">Template · </span>
              <strong>{name}</strong>
            </p>
            <UseTemplateButton slug={slug} loggedIn={loggedIn} label="Utiliser ce template" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
