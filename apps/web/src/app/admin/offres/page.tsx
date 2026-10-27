import { DEFAULT_QUOTAS, QUOTA_LABELS, type PlanKey } from "@mys/core";
import { asc, getDb, plans } from "@mys/db";
import { PlanForm } from "@/components/admin/plan-form";
import { EmptyState, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Offres & quotas" };

export default async function PlansPage() {
  const rows = await getDb().select().from(plans).orderBy(asc(plans.key));
  return (
    <>
      <PageHeader eyebrow="Administration" title="Offres & quotas">
        Aucun prix n’est codé dans l’application : le libellé affiché et les identifiants de paiement se règlent ici.
      </PageHeader>
      <Notice tone="blue" title="Avantages liés au compte" className="mb-6">
        Les quotas s’appliquent au compte Make Your Server (identifiant Discord), quel que soit le serveur sur lequel l’utilisateur installe. Un abonnement Discord (Premium Apps) et un abonnement Stripe donnent les mêmes avantages ; les règles de Discord imposent de proposer l’achat dans Discord à un prix qui ne dépasse pas celui du site.
      </Notice>
      {rows.length === 0 ? (
        <EmptyState title="Aucune offre en base">Lancez <code>pnpm db:seed</code> pour créer les offres Gratuit et Premium.</EmptyState>
      ) : (
        <div className="space-y-8">
          {rows.map((p) => (
            <PlanForm
              key={p.key}
              quotaLabels={QUOTA_LABELS}
              plan={{
                key: p.key,
                name: p.name,
                priceLabel: p.priceLabel,
                description: p.description,
                purchasable: p.purchasable,
                stripePriceId: p.stripePriceId,
                discordSkuId: p.discordSkuId,
                quotas: { ...(DEFAULT_QUOTAS[p.key as PlanKey] ?? DEFAULT_QUOTAS.free), ...p.quotas } as unknown as Record<string, number | boolean>,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
