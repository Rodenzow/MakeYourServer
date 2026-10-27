import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getOwnedGeneration } from "@/lib/ai/service";
import { SpecPreview } from "@/components/ai/spec-preview";
import { CreateProjectButton } from "@/components/ai/create-project-button";
import { Badge, Notice, PageHeader, formatDate } from "@/components/ui";

export const metadata = { title: "Génération IA" };

export default async function GenerationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/ia/${id}`);
  const gen = await getOwnedGeneration(user.id, id);
  if (!gen) notFound();
  const accepted = new Set(gen.acceptedChanges ?? []);
  return (
    <div className="space-y-6">
      <p className="text-sm">
        <Link href="/ia" className="text-muted hover:text-night">
          ← Conception IA
        </Link>
      </p>
      <PageHeader eyebrow={gen.kind === "create" ? "Conception complète" : "Modification ciblée"} title={gen.kind === "create" ? (gen.resultSpec?.meta.name ?? "Conception") : "Proposition de modifications"}>
        <span className="text-sm">
          {formatDate(gen.createdAt)} · modèle {gen.model ?? "—"} · {gen.inputTokens + gen.outputTokens} jetons · coût estimé {(gen.costMicros / 1_000_000).toFixed(3)} $
        </span>
      </PageHeader>
      <div className="panel p-4">
        <p className="eyebrow mb-1">Votre demande</p>
        <p className="whitespace-pre-wrap text-sm">{gen.prompt}</p>
      </div>
      {gen.status === "failed" && <Notice tone="danger" title="Échec">{gen.error ?? "La génération n’a pas abouti."}</Notice>}
      {gen.model === "simulation" && <Notice tone="warning">Réponse simulée (mode de test, sans modèle réel).</Notice>}

      {gen.kind === "create" && gen.resultSpec && (
        <div className="space-y-4">
          <SpecPreview spec={gen.resultSpec} />
          {gen.projectId ? (
            <Link href={`/projets/${gen.projectId}`} className="font-semibold text-blue-strong underline">
              Ouvrir le projet créé →
            </Link>
          ) : (
            <CreateProjectButton generationId={gen.id} />
          )}
        </div>
      )}

      {gen.kind === "edit" && gen.changeSet && (
        <div className="space-y-3">
          <p className="text-sm text-ink">{gen.changeSet.summary}</p>
          <ul className="space-y-2">
            {gen.changeSet.changes.map((c, i) => (
              <li key={i} className="panel flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-sm text-muted">{c.reason}</p>
                  <p className="mt-1 text-xs text-muted">{c.ops.length} opération(s)</p>
                </div>
                {gen.status === "applied" && <Badge tone={accepted.has(i) ? "success" : "neutral"}>{accepted.has(i) ? "Appliquée" : "Non retenue"}</Badge>}
              </li>
            ))}
          </ul>
          {gen.projectId && (
            <Link href={`/projets/${gen.projectId}`} className="text-sm font-semibold text-blue-strong underline">
              Ouvrir le projet →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
