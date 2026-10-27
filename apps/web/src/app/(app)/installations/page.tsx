import Link from "next/link";
import { listInstallations } from "@mys/engine";
import { requireUser } from "@/lib/session";
import { EmptyState, PageHeader, formatDate } from "@/components/ui";
import { InstallStatusBadge } from "@/components/app/status";
import { MODE_LABELS, type InstallMode } from "@mys/core";

export const metadata = { title: "Historique des installations" };

export default async function InstallationsPage() {
  const user = await requireUser("/installations");
  const list = await listInstallations(user.id, 100);
  return (
    <>
      <PageHeader eyebrow="Historique" title="Installations et restaurations">
        Chaque installation conserve le détail de ses étapes, leurs résultats et la sauvegarde de sécurité prise avant les modifications.
      </PageHeader>
      {list.length === 0 ? (
        <EmptyState title="Aucune installation">Vos installations apparaîtront ici avec leur suivi détaillé.</EmptyState>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-mist/60 text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">Serveur</th>
                <th className="px-4 py-2 font-semibold">Type</th>
                <th className="px-4 py-2 font-semibold">Mode</th>
                <th className="px-4 py-2 font-semibold">Date</th>
                <th className="px-4 py-2 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((i) => (
                <tr key={i.id} className="hover:bg-mist/40">
                  <td className="px-4 py-2.5">
                    <Link href={`/installations/${i.id}`} className="font-medium hover:underline">
                      {i.guildName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    {i.kind === "restore" ? "Restauration" : "Installation"}
                    {i.dryRun && " (simulation)"}
                  </td>
                  <td className="px-4 py-2.5">{MODE_LABELS[i.mode as InstallMode] ?? "—"}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(i.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    <InstallStatusBadge status={i.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
