"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cx } from "./ui";

/** Liens principaux avec un indicateur animé qui glisse vers la page courante. */
export function NavLinks({ items }: { items: Array<{ href: string; label: string }> }) {
  const path = usePathname();
  return (
    <nav className="hidden items-center gap-1 text-sm font-medium md:flex" aria-label="Navigation principale">
      {items.map((n) => {
        const active = path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cx("relative rounded-lg px-3 py-1.5 transition-colors", active ? "text-fg" : "text-ink hover:text-fg")}>
            {active && <motion.span layoutId="main-nav" className="absolute inset-0 rounded-lg bg-mist" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
            <span className="relative">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
