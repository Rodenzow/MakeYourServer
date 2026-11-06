import Link from "next/link";
import { notFound } from "next/navigation";
import { getCreatorProfile } from "@/lib/community";
import { formatRating, type CreatorBadge } from "@/lib/community-rules";
import { AnimatedNumber, Reveal, Stagger, StaggerItem } from "@/components/motion";
import { TemplateTile } from "@/components/templates/template-tile";
import { Stars } from "@/components/templates/stars";
import { IconCheck, IconShield, IconSparkle, IconUsers } from "@/components/icons";
import { cx } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const c = await getCreatorProfile((await params).id);
  return c
    ? { title: `${c.name}, créateur de templates`, description: `Les templates Discord publiés par ${c.name} sur Make Your Server.` }
    : { title: "Créateur introuvable", robots: { index: false } };
}

const BADGE_STYLE: Record<CreatorBadge["key"], { icon: typeof IconCheck; className: string }> = {
  verified: { icon: IconCheck, className: "border-blue/40 bg-blue/10 text-blue-strong" },
  confirmed: { icon: IconShield, className: "border-peri/40 bg-peri/10 text-peri" },
  installs100: { icon: IconUsers, className: "border-success/40 bg-success-soft/60 text-success" },
  topRated: { icon: IconSparkle, className: "border-warning/40 bg-warning-soft/60 text-warning" },
};

/**
 * Page publique d’un créateur : n’existe que s’il a au moins un template communautaire
 * publié avec son pseudo affiché. Les templates publiés anonymement n’y figurent jamais.
 */
export default async function CreatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCreatorProfile(id);
  if (!c) notFound();
  const since = c.memberSince.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" });

  return (
    <article>
      <Link href="/templates" className="text-sm font-semibold text-muted hover:text-fg">
        ← Tous les templates
      </Link>

      <Reveal className="brick relative mt-4 overflow-hidden p-6 md:p-8" y={10}>
        <div aria-hidden className="blueprint blueprint-fade absolute inset-0 opacity-70" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          {c.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.avatarUrl} alt="" width={96} height={96} className="size-20 rounded-[26px] shadow-xl ring-4 ring-white/10 md:size-24" />
          ) : (
            <span aria-hidden className="grid size-20 place-items-center rounded-[26px] bg-mist font-display text-4xl font-bold text-ink ring-4 ring-white/10 md:size-24">
              {c.name.trim().charAt(0).toUpperCase() || "?"}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Créateur de la communauté</p>
            <h1 className="mt-1 text-3xl font-extrabold break-words md:text-4xl">{c.name}</h1>
            <p className="mt-1 text-sm text-muted">Membre depuis {since}</p>
            {c.badges.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Badges">
                {c.badges.map((b) => {
                  const { icon: Icon, className } = BADGE_STYLE[b.key];
                  return (
                    <li key={b.key} title={b.description} className={cx("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", className)}>
                      <Icon size={13} />
                      {b.label}
                      <span className="sr-only"> : {b.description}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Reveal>

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border-2 border-edge bg-night md:grid-cols-4">
        <Total label={c.stats.published > 1 ? "Templates publiés" : "Template publié"} value={c.stats.published} />
        <Total label="Vues" value={c.stats.views} />
        <Total label="Installations" value={c.stats.installs} />
        <div className="bg-surface px-4 py-3">
          <dt className="text-xs text-muted">Note moyenne</dt>
          <dd className="flex items-center gap-2 font-display text-2xl font-bold text-light">
            {c.stats.average === null ? (
              <span className="text-base font-semibold text-muted">Pas encore d’avis</span>
            ) : (
              <>
                {formatRating(c.stats.average)}
                <Stars value={c.stats.average} size={14} />
                <span className="font-sans text-xs font-normal text-muted">({c.stats.ratingCount} avis)</span>
              </>
            )}
          </dd>
        </div>
      </dl>

      <section className="mt-12" aria-labelledby="createur-templates">
        <h2 id="createur-templates" className="text-2xl font-bold">
          {c.stats.published > 1 ? `Ses ${c.stats.published} templates` : "Son template"}
        </h2>
        <p className="mt-1 text-muted">Chaque template a été relu par l’équipe avant sa publication.</p>
        <Stagger as="ul" className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {c.templates.map((t) => (
            <StaggerItem key={t.id} as="li">
              <TemplateTile t={t} />
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </article>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-display text-2xl font-bold text-light">
        <AnimatedNumber value={value} />
      </dd>
    </div>
  );
}
