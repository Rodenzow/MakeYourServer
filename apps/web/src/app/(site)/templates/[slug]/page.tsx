import { notFound } from "next/navigation";
import Link from "next/link";
import { SIZE_LABELS, THEME_LABELS, allChannels, specStats, type ServerSpec } from "@mys/core";
import { FEATURE_TAGS } from "@mys/core/templates";
import { getPublishedTemplate } from "@/lib/data";
import { getCurrentUser } from "@/lib/session";
import { SpecPreview, RolesOverview } from "@/components/spec/spec-preview";
import { UseTemplateButton } from "@/components/templates/use-template-button";
import { StickyCta } from "@/components/templates/sticky-cta";
import { AnimatedNumber, Reveal } from "@/components/motion";
import { Badge } from "@/components/ui";
import { ChannelIcon, IconCheck, IconHand } from "@/components/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getPublishedTemplate((await params).slug);
  return { title: t ? `Template ${t.name}` : "Template introuvable", description: t?.tagline };
}

export default async function TemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getPublishedTemplate(slug);
  if (!t) notFound();
  const user = await getCurrentUser();
  const spec = t.spec as ServerSpec;
  const s = specStats(spec);
  return (
    <article>
      <Link href="/templates" className="text-sm font-semibold text-muted hover:text-fg">
        ← Tous les templates
      </Link>
      <header className="mt-4 grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="night">{THEME_LABELS[t.theme as keyof typeof THEME_LABELS] ?? t.theme}</Badge>
            <Badge>{SIZE_LABELS[t.size as keyof typeof SIZE_LABELS]}</Badge>
            {t.official ? <Badge tone="blue">Template officiel</Badge> : <Badge tone="blue">Proposé par la communauté, vérifié</Badge>}
          </div>
          <h1 className="mt-3 text-4xl font-extrabold md:text-5xl">{t.name}</h1>
          <p className="mt-3 text-lg text-ink">{t.tagline}</p>
          <p className="mt-3 max-w-2xl text-muted">{t.description}</p>
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
          <h2 className="text-2xl font-bold">Rôles et hiérarchie</h2>
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
            <p className="font-semibold">AutoMod (natif Discord)</p>
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
              {spec.features.tickets?.enabled && <li>• Tickets privés vers l’équipe</li>}
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
              <strong>Guide du serveur :</strong> Discord ne permet pas de le configurer via son API publique. Son contenu est prêt et un assistant vous guidera pour le recopier après l’installation ({allChannels(spec).length} salons référencés).
            </p>
          </div>
        )}
      </section>

      <div className="mt-12 flex justify-center">
        <UseTemplateButton slug={t.slug} loggedIn={!!user} label="Utiliser ce template" />
      </div>
      <StickyCta slug={t.slug} name={t.name} loggedIn={!!user} watchId="cta-principal" />
    </article>
  );
}
