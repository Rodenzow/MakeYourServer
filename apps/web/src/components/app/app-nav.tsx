"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cx } from "../ui";

export interface NavItem {
  href: string;
  label: string;
  badge?: string;
}

/** Navigation de l’espace personnel : colonne sur ordinateur, bandeau défilant sur mobile. */
export function AppNav({ items, layoutId = "app-nav" }: { items: NavItem[]; layoutId?: string }) {
  const path = usePathname();
  const active = (href: string) => (href === "/tableau-de-bord" || href === "/admin" ? path === href : path.startsWith(href));
  return (
    <nav aria-label="Navigation de l’espace" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.map((it) => (
          <li key={it.href} className="shrink-0">
            <Link
              href={it.href}
              aria-current={active(it.href) ? "page" : undefined}
              className={cx("relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors", active(it.href) ? "text-on-accent" : "text-ink hover:bg-mist hover:text-fg")}
            >
              {active(it.href) && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-lg bg-accent" transition={{ type: "spring", bounce: 0.12, duration: 0.35 }} />}
              <span className="relative">{it.label}</span>
              {it.badge && <span className="relative rounded bg-light px-1.5 text-[10px] font-bold text-on-accent">{it.badge}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
