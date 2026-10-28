import Link from "next/link";
import { THEME_LABELS } from "@mys/core";
import { FEATURE_TAGS } from "@mys/core/templates";
import type { TemplateCard } from "@/lib/data";
import { ChannelIcon, IconEye, IconUsers } from "../icons";
import { cx } from "../ui";
import { themeVisual } from "./theme-visuals";

const SHOWN_FEATURES = ["onboarding", "tickets", "self-roles", "forum", "automod", "events"] as const;

/**
 * Carte d’un template : bannière aux couleurs du thème, aperçu façon Discord des
 * premiers salons, question d’accueil, puis auteur et statistiques.
 */
export function TemplateTile({ t, compact = false, className }: { t: TemplateCard; compact?: boolean; className?: string }) {
  const v = themeVisual(t.theme);
  const features = SHOWN_FEATURES.filter((f) => t.features.includes(f)).slice(0, 3);
  return (
    <Link
      href={`/templates/${t.slug}`}
      className={cx(
        "group relative flex h-full flex-col overflow-hidden rounded-[18px] border border-line bg-surface transition-[transform,border-color,box-shadow] duration-300 ease-[var(--ease-snap)] hover:-translate-y-1.5 hover:border-edge",
        className,
      )}
      style={{ boxShadow: `0 18px 40px -26px ${v.from}` }}
    >
      {/* Bannière du serveur */}
      <div className="relative h-24 overflow-hidden" style={{ background: `linear-gradient(120deg, ${v.from} 0%, ${v.to} 70%, ${v.to}cc 100%)` }}>
        <span aria-hidden className="absolute -right-2 -bottom-4 rotate-[-8deg] text-6xl opacity-30 blur-[0.5px] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-0">
          {v.emoji}
        </span>
        <span aria-hidden className="absolute top-2 right-14 text-sm tracking-[0.5em] opacity-40">
          {v.motif}
        </span>
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgb(7_20_45/0.55),transparent_70%)]" />
        <div aria-hidden className="absolute inset-0 -translate-x-full bg-[linear-gradient(100deg,transparent_30%,rgb(255_255_255/0.22)_50%,transparent_70%)] transition-transform duration-1000 ease-out group-hover:translate-x-full" />
        <div className="absolute right-12 bottom-3 left-4 flex items-center gap-2.5">
          <span className="grid size-11 place-items-center rounded-[14px] bg-night/80 text-2xl shadow-lg ring-2 ring-white/15 backdrop-blur transition-[border-radius] duration-300 group-hover:rounded-[22px]">{v.emoji}</span>
          <span className="line-clamp-2 min-w-0 font-display text-[15px] leading-tight font-bold text-white drop-shadow">{t.name}</span>
        </div>
      </div>

      {/* Aperçu de la colonne des salons */}
      {!compact && (
        <div className="relative h-[118px] overflow-hidden border-b border-line bg-night-2 px-3 pt-2.5">
          <ul className="space-y-1.5 text-[12.5px] text-light/85 transition-transform duration-700 ease-[var(--ease-snap)] group-hover:-translate-y-[52px]">
            {t.preview.categories.slice(0, 3).map((c) => (
              <li key={c.name}>
                <p className="truncate text-[10px] font-bold tracking-wide text-light/50 uppercase">⌄ {c.name}</p>
                <ul>
                  {c.channels.slice(0, 3).map((ch) => (
                    <li key={ch.name} className="flex items-center gap-1.5 rounded px-1 py-[1px] group-hover:bg-white/[0.03]">
                      <ChannelIcon type={ch.type} size={13} className="shrink-0 text-light/45" />
                      <span className="truncate">{ch.name}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-night-2 to-transparent" />
          {t.preview.onboarding?.first && (
            <p className="absolute right-2 bottom-2 left-2 truncate rounded-lg border border-white/10 bg-night/90 px-2 py-1 text-[11px] text-light/90 backdrop-blur">
              <span className="font-semibold" style={{ color: v.to }}>
                Accueil :
              </span>{" "}
              « {t.preview.onboarding.first} »
              {t.preview.onboarding.count > 1 && <span className="text-light/50"> +{t.preview.onboarding.count - 1}</span>}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2">
          <p className="eyebrow truncate">{THEME_LABELS[t.theme as keyof typeof THEME_LABELS] ?? t.theme}</p>
          {t.official ? (
            <span className="shrink-0 rounded bg-light px-1.5 text-[10px] font-bold text-on-accent">OFFICIEL</span>
          ) : (
            <span className="shrink-0 rounded bg-success-soft px-1.5 text-[10px] font-bold text-success">COMMUNAUTÉ</span>
          )}
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm text-ink">{t.tagline}</p>
        {features.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {features.map((f) => (
              <span key={f} className="rounded-full border border-line bg-night px-2 py-0.5 text-[11px] text-ink">
                {FEATURE_TAGS[f]}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-muted">
          <span className="flex min-w-0 items-center gap-1.5">
            {t.official ? (
              <>
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent font-display text-[10px] font-bold text-on-accent">M</span>
                <span className="truncate">Équipe officielle</span>
              </>
            ) : t.author ? (
              <>
                {t.author.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.author.avatarUrl} alt="" width={20} height={20} loading="lazy" className="size-5 shrink-0 rounded-full" />
                ) : (
                  <span className="size-5 shrink-0 rounded-full bg-mist" />
                )}
                <span className="truncate">{t.author.name}</span>
              </>
            ) : (
              <span className="truncate">Membre de la communauté</span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-3 font-mono">
            {t.viewCount + t.installCount === 0 ? (
              <span title="Contenu">{t.stats.channels} salons</span>
            ) : (
              <>
                <span className="flex items-center gap-1" title="Vues">
                  <IconEye size={13} /> {formatCount(t.viewCount)}
                </span>
                <span className="flex items-center gap-1" title="Installations">
                  <IconUsers size={13} /> {formatCount(t.installCount)}
                </span>
              </>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}

const formatCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(".", ",")} k` : String(n));
