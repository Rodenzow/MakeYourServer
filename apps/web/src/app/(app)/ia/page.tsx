import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listAiGenerations } from "@/lib/data";
import { aiStatus } from "@/lib/ai/status";
import { AiCreateForm } from "@/components/ai/create-form";
import { Badge, ButtonLink, EmptyState, Notice, PageHeader, Stat, formatDate } from "@/components/ui";

export const metadata = { title: "Conception IA" };

const STATUS: Record<string, [string, "neutral" | "blue" | "success" | "warning" | "danger"]> = {
  pending: ["En attente", "neutral"],
  running: ["En cours", "blue"],
  succeeded: ["Prête", "success"],
  applied: ["Appliquée", "success"],
  rejected: ["Refusée", "neutral"],
  failed: ["Échec", "danger"],
};

export default async function AiPage() {
  const user = await requireUser("/ia");
  const [status, generations] = await Promise.all([aiStatus(user.id), listAiGenerations(user.id)]);
  const left = Math.max(0, status.generations.limit - status.generations.used);
  const disabledReason = !status.configured
    ? "IA non configurée sur cette instance : la clé ANTHROPIC_API_KEY est absente. Un abonnement personnel à Claude ne donne pas accès à l’API nécessaire au site."
    : !status.enabled
      ? "La conception par IA est temporairement désactivée par l’administration."
      : left === 0 && status.premium
        ? "Vous avez utilisé toutes vos conceptions IA de ce mois-ci."
        : null;

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Premium" title="Concevoir avec l’IA">
        Décrivez votre besoin : l’IA conçoit l’organisation, les rôles, les permissions, les messages et le parcours d’arrivée. Le résultat passe par les mêmes contrôles et la même prévisualisation que les templates, puis devient un projet modifiable.
      </PageHeader>

      {status.premium ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Conceptions ce mois-ci" value={`${status.generations.used} / ${status.generations.limit}`} />
            <Stat label="Modifications ciblées ce mois-ci" value={`${status.edits.used} / ${status.edits.limit}`} hint="Depuis l’éditeur d’un projet" />
            <Stat label="Offre" value={status.planName} hint="Avantages liés à votre compte" />
          </div>
          <AiCreateForm simulated={status.simulated} disabledReason={disabledReason} />
        </>
      ) : (
        <div className="brick blueprint grid gap-6 p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
          <div>
            <h2 className="text-2xl font-bold">Un serveur conçu pour votre usage réel</h2>
            <ul className="mt-4 space-y-2 text-sm text-ink">
              <li>• Organisation, salons et descriptions adaptés à votre public, votre taille et votre ton.</li>
              <li>• Rôles et permissions cohérents, vérifiés par notre moteur avant toute installation.</li>
              <li>• Règlement, messages d’accueil et onboarding rédigés pour vous.</li>
              <li>• Modifications ciblées ensuite : « Simplifie les salons », « Réécris le règlement »… à accepter une par une.</li>
            </ul>
            <p className="mt-4 text-sm text-muted">Les templates complets, l’éditeur et l’installation restent gratuits.</p>
          </div>
          <div className="flex flex-col items-start justify-center gap-3">
            <ButtonLink href="/abonnement" size="lg">
              Voir l’offre Premium
            </ButtonLink>
            <ButtonLink href="/templates" variant="secondary">
              Parcourir les templates gratuits
            </ButtonLink>
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-4 text-xl font-bold">Historique de vos générations</h2>
        {generations.length === 0 ? (
          <EmptyState title="Aucune génération pour l’instant">Vos conceptions et modifications par IA apparaîtront ici.</EmptyState>
        ) : (
          <ul className="panel divide-y divide-line">
            {generations.map((g) => {
              const [label, tone] = STATUS[g.status] ?? [g.status, "neutral"];
              return (
                <li key={g.id}>
                  <Link href={`/ia/${g.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-mist/50 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0">
                      <span className="mr-2 text-xs font-semibold text-muted">{g.kind === "create" ? "Conception" : "Modification"}</span>
                      <span className="line-clamp-1 text-sm">{g.prompt}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-xs text-muted">
                      {formatDate(g.createdAt)}
                      <Badge tone={tone}>{label}</Badge>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <Notice tone="neutral" title="Confidentialité">
        Seul le texte de votre demande (et, pour une modification, le contenu de votre projet) est transmis au service d’IA. Vos sauvegardes de serveurs ne lui sont jamais envoyées.
      </Notice>
    </div>
  );
}
