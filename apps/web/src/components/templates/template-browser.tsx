"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SIZE_LABELS, THEME_LABELS } from "@mys/core";
import { FEATURE_TAGS } from "@mys/core/templates";
import type { TemplateCard } from "@/lib/data";
import { ChannelIcon, IconSearch } from "../icons";
import { colorHex, cx } from "../ui";

const SORTS = { popular: "Les plus populaires", recent: "Les plus récents", name: "Ordre alphabétique" } as const;

export function TemplateBrowser({ initial }: { initial: TemplateCard[] }) {
  const [q, setQ] = useState("");
  const [theme, setTheme] = useState("");
  const [size, setSize] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [sort, setSort] = useState<keyof typeof SORTS>("popular");
  const [results, setResults] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      if (theme) p.set("theme", theme);
      if (size) p.set("taille", size);
      if (features.length) p.set("fonctionnalites", features.join(","));
      p.set("tri", sort);
      start(async () => {
        try {
          const res = await fetch(`/api/templates?${p}`, { signal: ctrl.signal });
          if (!res.ok) throw new Error();
          setResults((await res.json()).templates);
          setError(null);
        } catch (e) {
          if ((e as Error).name !== "AbortError") setError("La recherche n’a pas abouti. Vérifiez votre connexion et réessayez.");
        }
      });
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, theme, size, features, sort]);

  const toggleFeature = (f: string) => setFeatures((xs) => (xs.includes(f) ? xs.filter((x) => x !== f) : [...xs, f]));
  const activeCount = useMemo(() => (theme ? 1 : 0) + (size ? 1 : 0) + features.length, [theme, size, features]);

  return (
    <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start" aria-label="Filtres">
        <div>
          <label className="label" htmlFor="recherche">
            Rechercher
          </label>
          <div className="relative">
            <IconSearch size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input id="recherche" className="field !pl-9" placeholder="rap, association, jeu de rôle…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <Filter label="Thème" value={theme} onChange={setTheme} options={Object.entries(THEME_LABELS).filter(([k]) => k !== "autre")} />
        <Filter label="Taille du serveur" value={size} onChange={setSize} options={Object.entries(SIZE_LABELS)} />
        <fieldset>
          <legend className="label">Fonctionnalités</legend>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(FEATURE_TAGS).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={features.includes(k)}
                onClick={() => toggleFeature(k)}
                className={cx("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", features.includes(k) ? "border-night bg-night text-white" : "border-line bg-white text-ink hover:border-night")}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        {activeCount > 0 && (
          <button
            type="button"
            className="text-sm font-semibold text-blue-strong underline-offset-2 hover:underline"
            onClick={() => {
              setTheme("");
              setSize("");
              setFeatures([]);
            }}
          >
            Effacer les filtres ({activeCount})
          </button>
        )}
      </aside>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted" aria-live="polite">
            {pending ? "Recherche…" : `${results.length} template${results.length > 1 ? "s" : ""}`}
          </p>
          <select className="field !w-auto !py-1.5 text-sm" value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)} aria-label="Trier">
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <motion.ul layout className={cx("grid gap-5 sm:grid-cols-2 xl:grid-cols-3", pending && "opacity-70")}>
          <AnimatePresence mode="popLayout">
            {results.map((t) => (
              <motion.li key={t.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18 }}>
                <TemplateTile t={t} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
        {results.length === 0 && !pending && (
          <div className="panel blueprint mt-2 p-10 text-center">
            <p className="font-display text-lg font-semibold">Aucun template ne correspond.</p>
            <p className="mt-1 text-sm text-muted">Élargissez les filtres, ou partez d’un projet vierge depuis votre espace.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-col gap-0.5">
        {[["", "Tous"] as [string, string], ...options].map(([k, v]) => (
          <label key={k || "all"} className={cx("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm", value === k ? "bg-mist font-semibold" : "hover:bg-mist/60")}>
            <input type="radio" name={label} className="accent-[var(--color-night)]" checked={value === k} onChange={() => onChange(k)} />
            {v}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function TemplateTile({ t }: { t: TemplateCard }) {
  return (
    <Link href={`/templates/${t.slug}`} className="brick group flex h-full flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-1">
      <div className="relative h-36 overflow-hidden bg-night-2 px-4 pt-3">
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: colorHex(t.accentColor) }} />
        <ul className="space-y-1 text-[12px] text-light/80 transition-transform duration-500 group-hover:-translate-y-6">
          {t.preview.categories.slice(0, 3).map((c) => (
            <li key={c.name}>
              <p className="text-[10px] font-bold tracking-wide text-light/50 uppercase">{c.name}</p>
              <ul>
                {c.channels.slice(0, 3).map((ch) => (
                  <li key={ch.name} className="flex items-center gap-1.5 py-px">
                    <ChannelIcon type={ch.type} size={12} className="text-light/45" />
                    <span className="truncate">{ch.name}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-night-2 to-transparent" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2">
          <p className="eyebrow">{THEME_LABELS[t.theme as keyof typeof THEME_LABELS] ?? t.theme}</p>
          {t.official && <span className="rounded bg-light px-1.5 text-[10px] font-bold text-night">OFFICIEL</span>}
        </div>
        <h3 className="mt-1 text-lg leading-tight font-bold">{t.name}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-muted">{t.tagline}</p>
        <div className="mt-auto flex flex-wrap gap-1 pt-3">
          {t.preview.roles.slice(0, 4).map((r) => (
            <span key={r.name} className="inline-flex items-center gap-1 rounded-full bg-mist px-2 py-0.5 text-[11px]">
              <span className="size-2 rounded-full" style={{ background: colorHex(r.color) }} />
              {r.name}
            </span>
          ))}
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          {t.stats.channels} salons · {t.stats.roles} rôles · {t.stats.messages} messages · {t.installCount} installation{t.installCount > 1 ? "s" : ""}
        </p>
      </div>
    </Link>
  );
}
