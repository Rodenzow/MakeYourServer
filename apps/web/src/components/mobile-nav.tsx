"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconX } from "./icons";

export function MobileNav({ items }: { items: Array<{ href: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg px-3 py-2 text-sm font-semibold text-fg"
        aria-expanded={open}
        aria-controls="menu-mobile"
      >
        Menu
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id="menu-mobile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="glass fixed inset-0 z-50 px-6 py-5 text-fg"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <div className="flex justify-end">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2" aria-label="Fermer le menu">
                <IconX size={22} />
              </button>
            </div>
            <nav className="mt-6 flex flex-col gap-1">
              {items.map((it, i) => (
                <motion.div key={it.href} initial={{ x: -12, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.03 * i, duration: 0.2 }}>
                  <Link href={it.href} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-3 font-display text-2xl font-semibold hover:bg-mist">
                    {it.label}
                  </Link>
                </motion.div>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
