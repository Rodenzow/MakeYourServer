import { DEFAULT_QUOTAS, QUOTA_LABELS, type PlanQuotas } from "@mys/core";
import { asc, getDb, plans } from "@mys/db";
import { getEntitlement, getUsage } from "@mys/engine";
import { getCurrentUser } from "@/lib/session";
import { discordStoreUrl, stripeEnabled } from "@/lib/billing";
import { Badge, ButtonLink, Notice, PageHeader, cx, formatDate } from "@/components/ui";
import { IconCheck } from "@/components/icons";
import { CheckoutButton, PortalButton } from "./billing-actions";

export const metadata = { title: "Offres" };
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
      <PageHeader eyebrow="Offres" title="Gratuit pour installer, Premium pour aller plus loin">
        L’offre gratuite permet de créer et d’installer un serveur complet. Le Premium ajoute la conception par IA et des sauvegardes avancées.
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

      <section className="grid gap-6 md:grid-cols-2">
        <article className="panel flex flex-col p-6">
          <p className="eyebrow">{free?.name ?? "Gratuit"}</p>
          <p className="mt-2 font-display text-3xl font-bold">0 €</p>
          <p className="mt-1 text-sm text-muted">{free?.description}</p>
          <ul className="mt-5 flex-1 space-y-2 text-sm">
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
        <article className="brick flex flex-col p-6">
          <p className="eyebrow">{premium?.name ?? "Premium"}</p>
          <p className="mt-2 font-display text-3xl font-bold">{premium?.priceLabel || "Prix communiqué prochainement"}</p>
          <p className="mt-1 text-sm text-muted">{premium?.description}</p>
          <ul className="mt-5 flex-1 space-y-2 text-sm">
            {PREMIUM_INCLUDES.map((f) => (
              <li key={f} className="flex gap-2">
                <IconCheck size={16} className="mt-0.5 shrink-0 text-blue-strong" /> {f}
              </li>
            ))}
          </ul>
          <div className="mt-6 space-y-3">
            {ent?.planKey === "premium" ? (
              <Badge tone="success">Vous êtes Premium</Badge>
            ) : !purchasable ? (
              <Notice tone="neutral">Le Premium n’est pas encore ouvert à l’achat. Revenez bientôt !</Notice>
            ) : !user ? (
              <ButtonLink href="/connexion?suivant=/abonnement">Se connecter pour s’abonner</ButtonLink>
            ) : (
              <div className="flex flex-wrap items-start gap-3">
                {canStripe && <CheckoutButton />}
                {discordUrl && (
                  <ButtonLink href={discordUrl} variant="secondary" target="_blank" rel="noopener noreferrer">
                    Acheter dans Discord
                  </ButtonLink>
                )}
              </div>
            )}
            <p className="text-xs text-muted">
              Les avantages sont liés à votre compte Make Your Server (votre identifiant Discord), pas à un serveur : ils s’appliquent à tous vos projets et serveurs. Le même abonnement est proposé sur le site et dans Discord, au même prix au maximum, conformément aux règles de monétisation de Discord.
            </p>
          </div>
        </article>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Comparatif détaillé</h2>
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-3 font-semibold">Fonction</th>
                <th className="px-4 py-3 font-semibold">Gratuit</th>
                <th className="px-4 py-3 font-semibold">Premium</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(QUOTA_LABELS) as Array<keyof PlanQuotas>).map((k, i) => (
                <tr key={k} className={cx(i % 2 === 1 && "bg-mist/40")}>
                  <td className="px-4 py-2.5">{QUOTA_LABELS[k]}</td>
                  <td className="px-4 py-2.5 font-mono text-[13px]">{quotaValue(k, freeQ[k])}</td>
                  <td className="px-4 py-2.5 font-mono text-[13px]">{quotaValue(k, premQ[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">Quotas configurés par l’équipe ; ils peuvent évoluer. Les sauvegardes de sécurité avant installation sont toujours créées, même en gratuit.</p>
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
