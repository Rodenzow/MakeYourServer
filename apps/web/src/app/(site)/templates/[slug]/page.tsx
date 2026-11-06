import { notFound } from "next/navigation";
import { Term } from "@/components/help/term";
import Link from "next/link";
import { SIZE_LABELS, THEME_LABELS, allChannels, specStats, type ServerSpec } from "@mys/core";
import { FEATURE_TAGS } from "@mys/core/templates";
import { getPublishedTemplate, getTemplateAuthor } from "@/lib/data";
import { ViewTracker } from "@/components/templates/view-tracker";
import { themeVisual } from "@/components/templates/theme-visuals";
import { ReportButton } from "@/components/templates/report-button";
import { getCurrentUser } from "@/lib/session";
import { SpecPreview, RolesOverview } from "@/components/spec/spec-preview";
import { UseTemplateButton } from "@/components/templates/use-template-button";
import { StickyCta } from "@/components/templates/sticky-cta";
import { AnimatedNumber, Reveal } from "@/components/motion";
import { Badge } from "@/components/ui";
import { ChannelIcon, IconCheck, IconHand, IconSparkle } from "@/components/icons";
import { Reviews } from "@/components/templates/reviews";
import { Stars } from "@/components/templates/stars";
import { getTemplateLineage } from "@/lib/community";
import { formatRating } from "@/lib/community-rules";
import { getReviewDistribution, getUserReview, listReviews, ratingSummary, reviewEligibility } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getPublishedTemplate((await params).slug);
  if (!t) return { title: "Template introuvable" };
  const title = `Template ${t.name}`;
  // L’image de partage vient de opengraph-image.tsx (même dossier), ajoutée automatiquement.
  return {
    title,
    description: t.tagline,
    alternates: { canonical: `/templates/${t.slug}` },
    openGraph: { type: "website", siteName: "Make Your Server", locale: "fr_FR", title, description: t.tagline, url: `/templates/${t.slug}` },
    twitter: { card: "summary_large_image", title, description: t.tagline },
  };
}

export default async function TemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getPublishedTemplate(slug);
  if (!t) notFound();
  const user = await getCurrentUser();
  const [author, lineage, distribution, firstPage, mine, eligibility] = await Promise.all([
    getTemplateAuthor(t),
    getTemplateLineage(t),
    getReviewDistribution(t.id),
    listReviews(t.id, 1),
    user ? getUserReview(user.id, t.id) : Promise.resolve(null),
    reviewEligibility(user?.id ?? null, t),
  ]);
  const rating = ratingSummary(t);
  const spec = t.spec as ServerSpec;
  const s = specStats(spec);
  const v = themeVisual(t.theme);
  return (
    <article>
      <Link href="/templates" className="text-sm font-semibold text-muted hover:text-fg">
        ← Tous les templates
      </Link>
      <Reveal className="relative mt-4 h-40 overflow-hidden rounded-[22px] md:h-52" y={10}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${v.from} 0%, ${v.to} 75%)` }} />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_top,rgb(4_11_27/0.7),transparent_65%)]" />
        <span aria-hidden className="absolute top-6 right-8 hidden text-2xl tracking-[0.6em] opacity-50 md:block">
          {v.motif}
        </span>
        <span aria-hidden className="absolute -right-4 -bottom-8 rotate-[-10deg] text-[9rem] leading-none opacity-25">
          {v.emoji}
        </span>
        <div className="absolute bottom-5 left-5 flex items-center gap-4 md:left-8">
          <span className="grid size-16 place-items-center rounded-[22px] bg-night/80 text-4xl shadow-xl ring-4 ring-white/15 backdrop-blur md:size-20 md:text-5xl">{v.emoji}</span>
          <div>
            <p className="text-xs font-bold tracking-widest text-white/80 uppercase">Aperçu du serveur</p>
            <p className="font-display text-xl font-bold text-white drop-shadow md:text-2xl">{spec.meta.name}</p>
            <p className="text-sm text-white/80">
              {s.channels} salons · {s.roles} rôles · {spec.onboarding?.prompts.length ?? 0} questions d’accueil
            </p>
          </div>
        </div>
      </Reveal>
      <header className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="night">{THEME_LABELS[t.theme as keyof typeof THEME_LABELS] ?? t.theme}</Badge>
            <Badge>{SIZE_LABELS[t.size as keyof typeof SIZE_LABELS]}</Badge>
            {t.official ? <Badge tone="blue">Template officiel</Badge> : <Badge tone="blue">Proposé par la communauté, vérifié</Badge>}
            {t.featured && (
              <Badge tone="warning">
                <IconSparkle size={12} /> Sélection de l’équipe
              </Badge>
            )}
          </div>
          <h1 className="mt-3 text-4xl font-extrabold md:text-5xl">{t.name}</h1>
          <p className="mt-3 text-lg text-ink">{t.tagline}</p>
          <p className="mt-3 max-w-2xl text-muted">{t.description}</p>
          {lineage.basedOn && (
            <p className="mt-3 inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink">
              <IconSparkle size={14} className="text-peri" />
              Inspiré de{" "}
              <Link href={`/templates/${lineage.basedOn.slug}`} className="link font-semibold">
                « {lineage.basedOn.name} »
              </Link>
              {lineage.basedOn.official ? <span className="text-muted">(template officiel)</span> : lineage.basedOn.author ? <span className="text-muted">de {lineage.basedOn.author.name}</span> : null}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
            {t.official ? (
              <span className="inline-flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-accent font-display text-xs font-bold text-on-accent">M</span>
                Par l’équipe Make Your Server
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                {author?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={author.avatarUrl} alt="" width={24} height={24} className="size-6 rounded-full" />
                ) : (
                  <span className="grid size-6 place-items-center rounded-full bg-mist text-xs">?</span>
                )}
                Par{" "}
                {author ? (
                  <Link href={`/createurs/${author.id}`} className="link font-semibold">
                    {author.name}
                  </Link>
                ) : (
                  <strong className="text-fg">un membre de la communauté</strong>
                )}
              </span>
            )}
            {rating.average !== null && (
              <a href="#avis" className="inline-flex items-center gap-1.5 rounded-md hover:text-fg">
                <Stars value={rating.average} size={14} />
                <strong className="text-fg">{formatRating(rating.average)}</strong>
                <span>
                  ({rating.count} avis)
                </span>
              </a>
            )}
            <span>
              <strong className="text-fg">{t.viewCount.toLocaleString("fr-FR")}</strong> vue{t.viewCount > 1 ? "s" : ""}
            </span>
            <span>
              <strong className="text-fg">{t.installCount.toLocaleString("fr-FR")}</strong> installation{t.installCount > 1 ? "s" : ""}
            </span>
            {t.publishedAt && <span>Publié le {t.publishedAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>}
          </div>
        </div>
        <div className="brick p-5">
          <p className="eyebrow">Pour qui ?</p>
          <p className="mt-1 text-sm">{t.audience}</p>
          <div className="mt-4" id="cta-principal">
            <UseTemplateButton slug={t.slug} loggedIn={!!user} />
          </div>
          <p className="mt-3 text-xs text-muted">Gratuit. Rien n’est installé tant que vous n’avez pas vérifié l’analyse et confirmé.</p>
        </div>
      </header>

      <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border-2 border-edge bg-night sm:grid-cols-4 lg:grid-cols-7">
        {[
          ["Catégories", s.categories],
          ["Salons textuels", s.textChannels],
          ["Vocaux", s.voiceChannels],
          ["Forums", s.forums],
          ["Rôles", s.roles],
          ["Messages rédigés", s.messages],
          ["Règles AutoMod", s.automodRules],
        ].map(([k, v]) => (
          <div key={k as string} className="bg-surface px-4 py-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="font-display text-2xl font-bold text-light">
              <AnimatedNumber value={v as number} />
            </dd>
          </div>
        ))}
      </dl>

      <Reveal className="mt-12">
        <h2 className="text-2xl font-bold">Aperçu interactif</h2>
        <p className="mt-1 mb-5 text-muted">Cliquez sur un salon pour lire ses messages, et choisissez un rôle pour voir ce qu’il voit.</p>
        <SpecPreview spec={spec} />
      </Reveal>

      {spec.onboarding?.enabled && spec.onboarding.prompts.length > 0 && (
        <Reveal className="mt-12">
          <h2 className="text-2xl font-bold">Ce que verront vos nouveaux membres</h2>
          <p className="mt-1 text-sm text-muted">Il s’agit de l’<Term id="onboarding">onboarding</Term> de Discord.</p>
          <p className="mt-1 mb-5 text-muted">À leur arrivée, Discord leur pose ces questions : leurs réponses leur donnent les bons rôles et ouvrent les salons qui les intéressent.</p>
          <ol className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {spec.onboarding.prompts.map((p, i) => (
              <li key={p.id} className="panel relative overflow-hidden p-4">
                <span className="absolute top-0 left-0 h-1 w-full" style={{ background: `linear-gradient(90deg, ${v.from}, ${v.to})` }} />
                <p className="font-mono text-xs text-muted">
                  Question {i + 1}
                  {p.singleSelect ? " · un seul choix" : " · plusieurs choix possibles"}
                </p>
                <p className="mt-1 font-semibold">{p.title}</p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {p.options.map((o) => (
                    <li key={o.id} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-night px-2.5 py-1 text-sm">
                      {o.emoji && <span>{o.emoji}</span>}
                      {o.title}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Reveal>
      )}

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="text-2xl font-bold">Fonctionnalités incluses</h2>
          <ul className="mt-4 space-y-2">
            {t.highlights.map((h) => (
              <li key={h} className="flex gap-2 text-ink">
                <IconCheck className="mt-0.5 shrink-0 text-success" /> {h}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {t.features.map((f) => (
              <Badge key={f}>{FEATURE_TAGS[f as keyof typeof FEATURE_TAGS] ?? f}</Badge>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-2xl font-bold">Rôles et <Term id="hierarchie">hiérarchie</Term></h2>
          <div className="mt-4">
            <RolesOverview spec={spec} />
          </div>
        </section>
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-bold">Tout ce qui sera installé</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {spec.categories.map((c) => (
            <details key={c.id} className="panel group p-4" open>
              <summary className="cursor-pointer list-none font-semibold">
                {c.name} <span className="text-sm font-normal text-muted">({c.channels.length})</span>
              </summary>
              <ul className="mt-2 space-y-1 text-sm">
                {c.channels.map((ch) => (
                  <li key={ch.id} className="flex items-start gap-2">
                    <ChannelIcon type={ch.type} size={15} className="mt-0.5 shrink-0 text-muted" />
                    <span>
                      {ch.name}
                      {ch.topic && <span className="block text-xs text-muted">{ch.topic}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="panel p-4 text-sm">
            <p className="font-semibold"><Term id="automod">AutoMod</Term> (natif Discord)</p>
            <ul className="mt-2 space-y-1 text-muted">
              {spec.automod.map((a) => (
                <li key={a.id}>• {a.name}</li>
              ))}
            </ul>
          </div>
          <div className="panel p-4 text-sm">
            <p className="font-semibold">Accueil des nouveaux membres</p>
            <ul className="mt-2 space-y-1 text-muted">
              {spec.onboarding?.enabled ? <li>• Onboarding Discord : {spec.onboarding.prompts.map((p) => `« ${p.title} »`).join(", ")}</li> : null}
              {spec.welcomeScreen?.enabled ? <li>• Écran d’accueil ({spec.welcomeScreen.channels.length} salons mis en avant)</li> : null}
              {spec.features.rulesGate?.enabled ? <li>• Accès après acceptation du règlement (bouton)</li> : null}
              {spec.features.welcome?.enabled ? <li>• Message de bienvenue automatique (bot)</li> : null}
              {!spec.onboarding?.enabled && !spec.features.rulesGate && <li>• Accès direct aux salons publics</li>}
            </ul>
          </div>
          <div className="panel p-4 text-sm">
            <p className="font-semibold">Assuré par notre bot</p>
            <ul className="mt-2 space-y-1 text-muted">
              {spec.features.tickets?.enabled && <li>• <Term id="ticket">Tickets</Term> privés vers l’équipe</li>}
              {spec.features.suggestions?.enabled && <li>• Suggestions avec votes</li>}
              {spec.messages.some((m) => m.buttons.some((b) => b.action === "role-toggle")) && <li>• Rôles à choisir par boutons</li>}
              {spec.features.joinLogs?.enabled && <li>• Logs d’arrivées et de départs</li>}
            </ul>
          </div>
        </div>
        {spec.serverGuide && (
          <div className="mt-4 flex gap-3 rounded-xl border-2 border-dashed border-line bg-surface p-4 text-sm">
            <IconHand className="mt-0.5 shrink-0 text-blue-strong" />
            <p>
              <strong><Term id="guide-serveur">Guide du serveur</Term> :</strong> Discord ne permet pas de le configurer via son API publique. Son contenu est prêt et un assistant vous guidera pour le recopier après l’installation ({allChannels(spec).length} salons référencés).
            </p>
          </div>
        )}
      </section>

      {lineage.remixes.length > 0 && (
        <section className="mt-12" aria-labelledby="remix-titre">
          <h2 id="remix-titre" className="flex items-center gap-2 text-xl font-bold">
            <IconSparkle className="text-peri" /> Remixé {lineage.remixes.length} fois
          </h2>
          <p className="mt-1 text-sm text-muted">Des membres sont partis de ce template pour créer et publier leur propre version.</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {lineage.remixes.map((r) => (
              <li key={r.slug}>
                <Link href={`/templates/${r.slug}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm transition-colors hover:border-edge">
                  <span className="font-semibold text-fg">{r.name}</span>
                  {r.author && <span className="text-muted">par {r.author.name}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Reviews
        slug={t.slug}
        summary={rating}
        distribution={distribution}
        initial={{ reviews: firstPage.reviews, hasMore: firstPage.hasMore }}
        mine={mine}
        eligibility={eligibility}
        currentUserId={user?.id ?? null}
      />

      <div className="mt-12 flex flex-col items-center gap-4">
        <UseTemplateButton slug={t.slug} loggedIn={!!user} label="Utiliser ce template" />
        {!t.official && <ReportButton slug={t.slug} loggedIn={!!user} />}
      </div>
      <ViewTracker slug={t.slug} />
      <StickyCta slug={t.slug} name={t.name} loggedIn={!!user} watchId="cta-principal" />
    </article>
  );
}
