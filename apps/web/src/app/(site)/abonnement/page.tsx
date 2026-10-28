import { DEFAULT_QUOTAS, QUOTA_LABELS, type PlanQuotas } from "@mys/core";
import { asc, getDb, plans } from "@mys/db";
import { getEntitlement, getUsage } from "@mys/engine";
import { getCurrentUser } from "@/lib/session";
import { discordStoreUrl, stripeEnabled } from "@/lib/billing";
import { Badge, ButtonLink, Notice, PageHeader, cx, formatDate } from "@/components/ui";
import { IconCheck, IconSave, IconSparkle } from "@/components/icons";
import { AiDesignDemo, AiEditDemo, BackupDemo } from "@/components/premium/premium-demos";
import { Reveal } from "@/components/motion";
import { CheckoutButton, PortalButton } from "./billing-actions";

export const metadata = { title: "Offres", description: "Make Your Server est gratuit pour installer un serveur complet. Le Premium ajoute la conception par IA et des sauvegardes avancées." };
export const dynamic = "force-dynamic";

function quotaValue(key: keyof PlanQuotas, v: number | boolean): string {
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (key === "aiCostCapMicrosPerMonth") return v > 0 ? `${(v / 1_000_000).toFixed(2)} $` : "—";
  if (key === "backupRetentionDays") return v === 0 ? "Illimitée" : `${v} jours`;
  if (key === "scheduleMinIntervalHours") return `${v} h`;
  return v === 0 ? "Non inclus" : String(v);
}

const FREE_INCLUDES = [
  "Tous les templates complets (rôles, permissions, messages, AutoMod, onboarding)",
  "Éditeur visuel et prévisualisation « Voir comme ce rôle »",
  "Installation réelle par le bot, avec analyse de l’existant",
  "Sauvegarde de sécurité avant chaque installation",
  "Boutons de rôles, tickets, suggestions, bienvenue et logs",
];
const PREMIUM_INCLUDES = [
  "Conception complète de votre serveur par l’IA",
  "Modifications ciblées par IA, à accepter une par une",
  "Plus de projets et de sauvegardes conservées, versionnées",
  "Sauvegardes programmées et restauration sélective",
  "Export de messages sélectionnés (republication signalée comme telle)",
];

const FAQ: Array<[string, string]> = [
  ["Le gratuit est-il vraiment complet ?", "Oui : tous les templates, l’éditeur, l’installation par le bot et la sauvegarde de sécurité sont gratuits, sans limite de temps. Le Premium ajoute l’IA et des sauvegardes avancées."],
  ["Puis-je résilier quand je veux ?", "Oui, en un clic depuis cette page. Le Premium reste actif jusqu’à la fin de la période payée, et vos projets sont conservés."],
  ["Les avantages valent-ils pour tous mes serveurs ?", "Oui : ils sont liés à votre compte, pas à un serveur. Tous vos projets et serveurs en profitent."],
  ["Pourquoi l’IA est-elle payante ?", "Chaque conception appelle l’API d’un fournisseur d’IA, facturée à l’usage. Les quotas mensuels du Premium couvrent ce coût."],
  ["Puis-je payer dans Discord ?", "Quand l’achat dans Discord est ouvert, l’abonnement y est proposé avec les mêmes avantages et au même prix au maximum."],
];

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const { statut } = await searchParams;
  const user = await getCurrentUser();
  const rows = await getDb().select().from(plans).orderBy(asc(plans.key));
  const free = rows.find((p) => p.key === "free");
  const premium = rows.find((p) => p.key === "premium");
  const freeQ: PlanQuotas = { ...DEFAULT_QUOTAS.free, ...(free?.quotas ?? {}) };
  const premQ: PlanQuotas = { ...DEFAULT_QUOTAS.premium, ...(premium?.quotas ?? {}) };
  const ent = user ? await getEntitlement(user.id) : null;
  const usage = user ? await getUsage(user.id) : null;
  const canStripe = stripeEnabled() && !!premium?.purchasable && !!premium.stripePriceId;
  const discordUrl = premium?.purchasable ? discordStoreUrl(premium.discordSkuId) : null;
  const purchasable = canStripe || !!discordUrl;

  return (
    <div className="space-y-12">
      <PageHeader eyebrow="Offres" title="Gratuit pour installer. Premium pour créer sans limites.">
        Tout ce qu’il faut pour un serveur complet est gratuit. Le Premium vous fait gagner des heures : décrivez votre serveur, l’IA le conçoit, et vos sauvegardes se font toutes seules.
      </PageHeader>

      {statut === "succes" && (
        <Notice tone="success" title="Paiement transmis">
          Votre abonnement sera actif dès que Stripe nous l’aura confirmé (en général quelques secondes). Actualisez la page si besoin.
        </Notice>
      )}
      {statut === "annule" && <Notice tone="neutral">Paiement annulé : aucun montant n’a été prélevé.</Notice>}

      {user && ent && usage && (
        <section className="panel grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="eyebrow">Votre compte</p>
            <p className="mt-1 font-display text-xl font-bold">
              Offre {ent.planName} {ent.planKey === "premium" && <Badge tone="success">active</Badge>}
            </p>
            <p className="mt-1 text-sm text-muted">
              {ent.source === "free" && "Aucun abonnement en cours."}
              {ent.source === "stripe" && `Abonnement par carte${ent.currentPeriodEnd ? ` — ${ent.cancelAtPeriodEnd ? "se termine" : "renouvellement"} le ${formatDate(ent.currentPeriodEnd, false)}` : ""}.`}
              {ent.source === "discord" && "Abonnement acheté dans Discord : gérez-le depuis Paramètres utilisateur → Abonnements dans Discord."}
              {ent.source === "manual" && "Avantages attribués par l’équipe Make Your Server."}
            </p>
            <p className="mt-2 text-sm">
              Ce mois-ci : {usage.ai_generations}/{ent.quotas.aiGenerationsPerMonth} conceptions IA · {usage.ai_edits}/{ent.quotas.aiEditsPerMonth} modifications IA
            </p>
          </div>
          {ent.source === "stripe" && <PortalButton />}
        </section>
      )}

      <section className="grid items-stretch gap-6 md:grid-cols-[1fr_1.15fr]">
        <article className="panel flex flex-col p-6">
          <p className="eyebrow">{free?.name ?? "Gratuit"}</p>
          <p className="mt-2 font-display text-4xl font-bold">0 €</p>
          <p className="mt-1 text-sm text-muted">{free?.description}</p>
          <ul className="mt-5 flex-1 space-y-2.5 text-sm">
            {FREE_INCLUDES.map((f) => (
              <li key={f} className="flex gap-2">
                <IconCheck size={16} className="mt-0.5 shrink-0 text-success" /> {f}
              </li>
            ))}
          </ul>
          <ButtonLink href="/templates" variant="secondary" className="mt-6 self-start">
            Choisir un template
          </ButtonLink>
        </article>

        <article className="halo relative flex flex-col overflow-hidden rounded-[var(--radius-block)] border border-edge bg-surface p-6 shadow-[0_30px_80px_-40px_rgb(131_168_243/0.7)]">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-[radial-gradient(circle,rgb(167_189_255/0.25),transparent_65%)]" />
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">{premium?.name ?? "Premium"}</p>
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-on-accent">Le plus complet</span>
          </div>
          <p className="mt-2 font-display text-4xl font-bold">
            <span className="text-gradient">{premium?.priceLabel || "Bientôt disponible"}</span>
          </p>
          <p className="mt-1 text-sm text-muted">{premium?.description}</p>

          <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              [premQ.aiGenerationsPerMonth, "conceptions IA / mois"],
              [premQ.aiEditsPerMonth, "modifications IA / mois"],
              [premQ.backupsPerGuild, "sauvegardes par serveur"],
            ].map(([v, label]) => (
              <div key={label as string} className="rounded-xl border border-line bg-night px-2 py-3">
                <dt className="font-display text-2xl font-bold text-light">{v as number}</dt>
                <dd className="text-[11px] leading-tight text-muted">{label as string}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-5 text-sm font-semibold text-fg">Tout le gratuit, et en plus :</p>
          <ul className="mt-2 flex-1 space-y-2.5 text-sm">
            {PREMIUM_INCLUDES.map((f) => (
              <li key={f} className="flex gap-2">
                <IconSparkle size={16} className="mt-0.5 shrink-0 text-peri" /> {f}
              </li>
            ))}
          </ul>
          <div className="mt-6 space-y-3">
            {ent?.planKey === "premium" ? (
              <Badge tone="success">Vous êtes Premium — merci !</Badge>
            ) : !purchasable ? (
              <Notice tone="neutral">Le Premium ouvre très bientôt. En attendant, tout le gratuit est à vous.</Notice>
            ) : !user ? (
              <ButtonLink href="/connexion?suivant=/abonnement" size="lg">
                Se connecter pour passer Premium
              </ButtonLink>
            ) : (
              <div className="flex flex-wrap items-start gap-3">
                {canStripe && <CheckoutButton label="Passer Premium" />}
                {discordUrl && (
                  <ButtonLink href={discordUrl} variant="secondary" target="_blank" rel="noopener noreferrer">
                    Acheter dans Discord
                  </ButtonLink>
                )}
              </div>
            )}
            <p className="text-xs text-muted">Sans engagement, résiliable à tout moment. Mêmes avantages et même prix au maximum sur le site et dans Discord.</p>
          </div>
        </article>
      </section>

      <section>
        <Reveal>
          <p className="eyebrow">Ce que le Premium change</p>
          <h2 className="mt-2 text-3xl font-bold md:text-4xl">Moins de clics, plus de serveur.</h2>
        </Reveal>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {[
            { title: "Une phrase, un serveur", text: "Décrivez votre communauté : l’IA conçoit salons, rôles, permissions, messages et onboarding. Vous relisez, puis vous installez.", icon: <IconSparkle size={18} />, demo: <AiDesignDemo /> },
            { title: "Des retouches en une demande", text: "Demandez une modification précise : chaque changement vous est proposé, vous gardez ce qui vous plaît.", icon: <IconSparkle size={18} />, demo: <AiEditDemo /> },
            { title: "Des sauvegardes qui se font seules", text: "Programmez vos sauvegardes, gardez plusieurs versions et restaurez seulement ce dont vous avez besoin.", icon: <IconSave size={18} />, demo: <BackupDemo /> },
          ].map((c, i) => (
            <Reveal key={c.title} delay={i * 0.08} className="panel flex flex-col p-5">
              <p className="flex items-center gap-2 font-display text-lg font-bold">
                <span className="grid size-8 place-items-center rounded-lg bg-blue/15 text-blue-strong">{c.icon}</span>
                {c.title}
              </p>
              <p className="mt-2 text-sm text-muted">{c.text}</p>
              <div className="mt-4 h-[260px]">{c.demo}</div>
            </Reveal>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Comparatif détaillé</h2>
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-3 font-semibold">Fonction</th>
                <th className="px-4 py-3 font-semibold">Gratuit</th>
                <th className="bg-blue/10 px-4 py-3 font-semibold text-light">Premium</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(QUOTA_LABELS) as Array<keyof PlanQuotas>).map((k, i) => (
                <tr key={k} className={cx(i % 2 === 1 && "bg-mist/40")}>
                  <td className="px-4 py-2.5">{QUOTA_LABELS[k]}</td>
                  <td className="px-4 py-2.5 font-mono text-[13px]">{quotaValue(k, freeQ[k])}</td>
                  <td className="bg-blue/10 px-4 py-2.5 font-mono text-[13px] text-light">{quotaValue(k, premQ[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">Quotas configurés par l’équipe ; ils peuvent évoluer. Les sauvegardes de sécurité avant installation sont toujours créées, même en gratuit.</p>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Questions fréquentes</h2>
        <div className="space-y-2">
          {FAQ.map(([q, a]) => (
            <details key={q} className="panel group p-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {q}
                <span className="text-xl text-peri transition-transform duration-300 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm text-ink">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Notice tone="neutral" title="L’IA utilise une API payante">
          La conception par IA appelle l’API d’un fournisseur d’IA, facturée à l’usage à Make Your Server. Un abonnement personnel à un assistant (comme Claude Pro) ne donne pas accès à cette API : c’est pourquoi l’IA fait partie du Premium, avec des quotas mensuels.
        </Notice>
        <Notice tone="neutral" title="Résiliation">
          Vous pouvez résilier à tout moment : le Premium reste actif jusqu’à la fin de la période payée. Vos projets et sauvegardes sont conservés ; au-delà des limites gratuites, les plus anciennes sauvegardes ne sont plus renouvelées.
        </Notice>
      </section>
    </div>
  );
}
