"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SIZE_LABELS, THEME_LABELS } from "@mys/core";
import { FEATURE_TAGS } from "@mys/core/templates";
import type { TemplateCard } from "@/lib/data";
import { IconChevronDown, IconSearch } from "../icons";
import { cx } from "../ui";
import { TemplateTile } from "./template-tile";
import { themeVisual } from "./theme-visuals";

const SORTS = { popular: "Populaires", views: "Les plus vus", recent: "Récents", name: "A → Z" } as const;
const SOURCES = { "": "Tous", official: "Officiels", community: "Communauté" } as const;

export function TemplateBrowser({ initial }: { initial: TemplateCard[] }) {
  const [q, setQ] = useState("");
  const [theme, setTheme] = useState("");
  const [source, setSource] = useState<keyof typeof SOURCES>("");
  const [size, setSize] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [sort, setSort] = useState<keyof typeof SORTS>("popular");
  const [more, setMore] = useState(false);
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
      if (source) p.set("source", source);
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
  }, [q, theme, source, size, features, sort]);

  const toggleFeature = (f: string) => setFeatures((xs) => (xs.includes(f) ? xs.filter((x) => x !== f) : [...xs, f]));
  const activeCount = useMemo(() => (theme ? 1 : 0) + (size ? 1 : 0) + (source ? 1 : 0) + features.length + (q ? 1 : 0), [theme, size, source, features, q]);
  const reset = () => {
    setQ("");
    setTheme("");
    setSource("");
    setSize("");
    setFeatures([]);
  };

  return (
    <div>
      {/* Barre principale */}
      <div className="glass sticky top-[64px] z-20 -mx-4 mb-6 space-y-3 border-b border-line px-4 py-3 sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <IconSearch size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input aria-label="Rechercher un template" className="field !pl-9" placeholder="Rechercher : rap, association, jeu de rôle…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Segmented value={source} onChange={setSource} options={SOURCES} label="Origine" />
          <select className="field !w-auto !py-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)} aria-label="Trier">
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Thèmes">
          {[["", "Tous les thèmes"] as [string, string], ...Object.entries(THEME_LABELS).filter(([k]) => k !== "autre")].map(([k, label]) => (
            <button
              key={k || "all"}
              type="button"
              aria-pressed={theme === k}
              onClick={() => setTheme(k)}
              className={cx(
                "relative inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                theme === k ? "border-light text-on-accent" : "border-line bg-surface text-ink hover:border-edge",
              )}
            >
              {theme === k && <motion.span layoutId="theme-pill" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
              <span className="relative">{k ? themeVisual(k).emoji : "✨"}</span>
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {pending ? "Recherche…" : `${results.length} template${results.length > 1 ? "s" : ""}`}
          {activeCount > 0 && (
            <button type="button" className="ml-3 font-semibold text-blue-strong hover:underline" onClick={reset}>
              Tout effacer
            </button>
          )}
        </p>
        <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="inline-flex items-center gap-1 text-sm font-semibold text-ink hover:text-fg">
          Plus de filtres {size || features.length ? `(${(size ? 1 : 0) + features.length})` : ""}
          <IconChevronDown size={15} className={cx("transition-transform", more && "rotate-180")} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {more && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="panel mb-6 grid gap-5 p-4 md:grid-cols-[220px_1fr]">
              <fieldset>
                <legend className="label">Taille du serveur</legend>
                <div className="flex flex-col gap-0.5">
                  {[["", "Toutes"] as [string, string], ...Object.entries(SIZE_LABELS)].map(([k, v]) => (
                    <label key={k || "all"} className={cx("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm", size === k ? "bg-mist font-semibold" : "hover:bg-mist/60")}>
                      <input type="radio" name="taille" checked={size === k} onChange={() => setSize(k)} />
                      {v}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="label">Fonctionnalités</legend>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(FEATURE_TAGS).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={features.includes(k)}
                      onClick={() => toggleFeature(k)}
                      className={cx("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", features.includes(k) ? "border-edge bg-accent text-on-accent" : "border-line bg-surface text-ink hover:border-edge")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <motion.ul layout className={cx("grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", pending && "opacity-70 transition-opacity")}>
        <AnimatePresence mode="popLayout">
          {results.map((t, i) => (
            <motion.li
              key={t.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.28, delay: Math.min(i, 8) * 0.035, ease: [0.2, 0.9, 0.25, 1] }}
            >
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
  );
}

function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: Record<T, string>; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[11px] border border-line bg-night p-0.5">
      {(Object.entries(options) as Array<[T, string]>).map(([k, v]) => (
        <button
          key={k || "all"}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={cx("relative rounded-[9px] px-3 py-1.5 text-sm font-semibold transition-colors", value === k ? "text-on-accent" : "text-ink hover:text-fg")}
        >
          {value === k && <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-[9px] bg-accent" transition={{ type: "spring", bounce: 0.15, duration: 0.35 }} />}
          <span className="relative">{v}</span>
        </button>
      ))}
    </div>
  );
}

export { TemplateTile };
