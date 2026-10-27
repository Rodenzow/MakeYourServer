import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntitlement } from "@mys/engine";
import { ActionButton } from "@/components/admin/action-button";
import { GrantPremiumForm } from "@/components/admin/premium-form";
import { Badge, Notice, PageHeader, Stat, formatDate } from "@/components/ui";
import { INSTALL_STATUS_LABELS, INSTALL_STATUS_TONE, formatUsd, userDetail } from "@/lib/admin";
import { isAdminDiscordId } from "@/lib/session";
import { Table, Td } from "../../table";

export const metadata = { title: "Utilisateur" };

const PROVIDER: Record<string, string> = { stripe: "Stripe (site)", discord: "Discord (Premium Apps)", manual: "Manuel (administration)" };

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await userDetail(id);
  if (!d) notFound();
  const ent = await getEntitlement(d.user.id);
  const u = d.user;
  const manual = d.subscriptions.find((s) => s.provider === "manual" && s.status === "active");
  return (
    <>
      <PageHeader eyebrow="Utilisateur" title={u.globalName ?? u.username} actions={<Link href="/admin/utilisateurs" className="text-sm text-muted hover:text-night">← Tous les utilisateurs</Link>}>
        <span className="font-mono text-xs">@{u.username} · {u.discordId}</span>
        {isAdminDiscordId(u.discordId) && <Badge tone="night" className="ml-2">Administrateur (configuration serveur)</Badge>}
      </PageHeader>

      {u.suspendedAt && (
        <Notice tone="danger" title={`Compte suspendu depuis le ${formatDate(u.suspendedAt)}`} className="mb-4">
          Motif : {u.suspensionReason ?? "—"}
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Offre" value={ent.planName} hint={ent.source === "free" ? "Gratuit" : PROVIDER[ent.source]} />
        <Stat label="Projets" value={d.counts.projects} />
        <Stat label="Installations" value={d.counts.installations} />
        <Stat label="Sauvegardes" value={d.counts.backups} />
        <Stat label="Générations IA" value={d.counts.ai} hint={`ce mois : ${d.usage.ai_generations ?? 0} conceptions, ${d.usage.ai_edits ?? 0} modifications`} />
        <Stat label="Coût IA du mois" value={formatUsd(d.usage.ai_cost_micros)} />
        <Stat label="Inscription" value={formatDate(u.createdAt, false)} />
        <Stat label="Dernière connexion" value={formatDate(u.lastLoginAt, false)} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-bold">Modération du compte</h2>
        <div className="panel flex flex-wrap gap-3 p-4">
          {u.suspendedAt ? (
            <ActionButton url={`/api/admin/users/${u.id}`} body={{ action: "unsuspend" }} label="Lever la suspension" confirm="Rétablir l’accès de ce compte ?" />
          ) : (
            <ActionButton
              url={`/api/admin/users/${u.id}`}
              body={{ action: "suspend" }}
              label="Suspendre le compte"
              variant="danger"
              prompt="Motif de la suspension (visible dans les journaux) :"
              promptRequired
            />
          )}
          <p className="w-full text-xs text-muted">La suspension déconnecte immédiatement l’utilisateur et bloque ses installations, y compris celles déjà en file (droits revérifiés à l’exécution).</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-bold">Abonnements</h2>
        <Table head={["Source", "Offre", "Statut", "Fin de période", "Note"]} empty={d.subscriptions.length === 0}>
          {d.subscriptions.map((s) => (
            <tr key={s.id}>
              <Td>{PROVIDER[s.provider] ?? s.provider}</Td>
              <Td>{s.planKey}</Td>
              <Td>
                <Badge tone={s.status === "active" ? "success" : s.status === "past_due" ? "warning" : "neutral"}>{s.status}</Badge>
                {s.cancelAtPeriodEnd && <span className="ml-1 text-xs text-muted">(résiliation programmée)</span>}
              </Td>
              <Td>{formatDate(s.currentPeriodEnd, false)}</Td>
              <Td className="text-xs text-muted">{s.note ?? ""}</Td>
            </tr>
          ))}
        </Table>
        <div className="panel mt-4 space-y-3 p-4">
          <p className="text-sm font-semibold">Premium manuel</p>
          <p className="text-xs text-muted">Les abonnements Stripe et Discord se gèrent chez leur fournisseur ; seul le Premium manuel est modifiable ici.</p>
          <GrantPremiumForm userId={u.id} />
          {manual && <ActionButton url={`/api/admin/users/${u.id}`} body={{ action: "revoke-premium" }} label="Retirer le Premium manuel" variant="danger" confirm="Retirer le Premium accordé manuellement ?" />}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-bold">Dernières installations</h2>
        <Table head={["Serveur", "Type", "Statut", "Date"]} empty={d.recentInstalls.length === 0}>
          {d.recentInstalls.map((i) => (
            <tr key={i.id}>
              <Td>
                <Link href={`/admin/installations/${i.id}`} className="font-semibold hover:underline">{i.guildName}</Link>
              </Td>
              <Td>{i.kind === "restore" ? "Restauration" : "Installation"}{i.dryRun ? " (simulation)" : ""}</Td>
              <Td><Badge tone={INSTALL_STATUS_TONE[i.status]}>{INSTALL_STATUS_LABELS[i.status] ?? i.status}</Badge></Td>
              <Td>{formatDate(i.createdAt)}</Td>
            </tr>
          ))}
        </Table>
      </section>
    </>
  );
}
