import Link from "next/link";
import { getSetting } from "@mys/db";
import { AiSettingsForm } from "@/components/admin/settings-forms";
import { Badge, Notice, PageHeader, Stat, formatDate } from "@/components/ui";
import { aiUsageThisMonth, formatUsd } from "@/lib/admin";
import { env } from "@/lib/env";
import { Table, Td } from "../table";

export const metadata = { title: "IA & coûts" };

export default async function AiAdmin() {
  const [usage, settings] = await Promise.all([aiUsageThisMonth(), getSetting("ai")]);
  const cost = usage.totals.ai_cost_micros ?? 0;
  const pct = settings.monthlyBudgetMicros > 0 ? Math.round((cost / settings.monthlyBudgetMicros) * 100) : 100;
  return (
    <>
      <PageHeader eyebrow="Administration" title="IA & coûts">
        Consommation de la période {usage.period}. Les montants sont estimés en dollars US à partir des prix configurés ci-dessous.
      </PageHeader>
      {env.aiProvider === "mock" ? (
        <Notice tone="warning" className="mb-4" title="Fournisseur IA simulé (AI_PROVIDER=mock)">Les générations sont produites localement pour les tests : aucun appel facturé n’est effectué.</Notice>
      ) : !env.anthropicApiKey ? (
        <Notice tone="danger" className="mb-4" title="Clé API manquante">ANTHROPIC_API_KEY n’est pas configurée : la conception IA est indisponible. Un abonnement personnel à un assistant ne fournit pas d’accès à l’API.</Notice>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Coût du mois" value={formatUsd(cost)} hint={`${pct} % du budget (${formatUsd(settings.monthlyBudgetMicros)})`} />
        <Stat label="Conceptions" value={usage.totals.ai_generations ?? 0} />
        <Stat label="Modifications" value={usage.totals.ai_edits ?? 0} />
        <Stat label="Jetons" value={((usage.totals.ai_input_tokens ?? 0) + (usage.totals.ai_output_tokens ?? 0)).toLocaleString("fr-FR")} hint={`${(usage.totals.ai_input_tokens ?? 0).toLocaleString("fr-FR")} en entrée · ${(usage.totals.ai_output_tokens ?? 0).toLocaleString("fr-FR")} en sortie`} />
      </div>

      <h2 className="mt-10 mb-3 text-xl font-bold">Réglages</h2>
      <AiSettingsForm initial={settings} />

      <h2 className="mt-10 mb-3 text-xl font-bold">Plus gros consommateurs ce mois-ci</h2>
      <Table head={["Utilisateur", "Identifiant Discord", "Coût"]} empty={usage.top.length === 0}>
        {usage.top.map((t) => (
          <tr key={t.userId}>
            <Td><Link href={`/admin/utilisateurs/${t.userId}`} className="hover:underline">{t.username}</Link></Td>
            <Td className="font-mono text-xs">{t.discordId}</Td>
            <Td>{formatUsd(t.cost)}</Td>
          </tr>
        ))}
      </Table>

      <h2 className="mt-10 mb-1 text-xl font-bold">Générations récentes</h2>
      <p className="mb-3 text-xs text-muted">Pour la modération des abus, seule la demande (tronquée à 200 caractères) est affichée ; le projet produit reste privé.</p>
      <Table head={["Date", "Utilisateur", "Type", "Statut", "Modèle", "Jetons", "Coût", "Demande"]} empty={usage.recent.length === 0}>
        {usage.recent.map((g) => (
          <tr key={g.id}>
            <Td className="text-xs">{formatDate(g.createdAt)}</Td>
            <Td>{g.username}</Td>
            <Td>{g.kind === "create" ? "Conception" : "Modification"}</Td>
            <Td>
              <Badge tone={g.status === "failed" ? "danger" : g.status === "applied" || g.status === "succeeded" ? "success" : "neutral"}>{g.status}</Badge>
              {g.error && <div className="mt-1 text-xs text-danger">{g.error}</div>}
            </Td>
            <Td className="font-mono text-xs">{g.model ?? "—"}</Td>
            <Td className="text-xs">{g.inputTokens + g.outputTokens}</Td>
            <Td className="text-xs">{formatUsd(g.costMicros)}</Td>
            <Td className="max-w-72 text-xs text-muted">{g.prompt}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
