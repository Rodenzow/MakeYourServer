import Link from "next/link";
import { Badge, PageHeader, formatDate } from "@/components/ui";
import { INSTALL_STATUSES, INSTALL_STATUS_LABELS, INSTALL_STATUS_TONE, listAdminInstallations, pageOf, truncate } from "@/lib/admin";
import { FilterField, Filters, Pager, Table, Td } from "../table";

export const metadata = { title: "Installations" };

export default async function AdminInstallations({ searchParams }: { searchParams: Promise<{ status?: string; guild?: string; user?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const { rows, hasMore } = await listAdminInstallations(sp, page);
  return (
    <>
      <PageHeader eyebrow="Administration" title="Installations" />
      <Filters action="/admin/installations">
        <FilterField label="Statut">
          <select name="status" defaultValue={sp.status ?? ""} className="field">
            <option value="">Tous</option>
            {INSTALL_STATUSES.map((s) => (
              <option key={s} value={s}>{INSTALL_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Identifiant du serveur">
          <input name="guild" defaultValue={sp.guild} className="field font-mono" />
        </FilterField>
        <FilterField label="Utilisateur (pseudo ou ID Discord)">
          <input name="user" defaultValue={sp.user} className="field" />
        </FilterField>
      </Filters>
      <Table head={["Serveur", "Utilisateur", "Type", "Statut", "Créée", "Terminée", "Erreur"]} empty={rows.length === 0}>
        {rows.map((i) => (
          <tr key={i.id}>
            <Td>
              <Link href={`/admin/installations/${i.id}`} className="font-semibold hover:underline">{i.guildName}</Link>
              <div className="font-mono text-xs text-muted">{i.guildId}</div>
            </Td>
            <Td>
              <Link href={`/admin/utilisateurs/${i.userId}`} className="hover:underline">{i.username}</Link>
            </Td>
            <Td className="text-xs">
              {i.kind === "restore" ? "Restauration" : "Installation"}
              {i.dryRun && <Badge className="ml-1">simulation</Badge>}
              <div className="text-muted">via {i.origin === "discord" ? "Discord" : "le site"}</div>
            </Td>
            <Td><Badge tone={INSTALL_STATUS_TONE[i.status]}>{INSTALL_STATUS_LABELS[i.status] ?? i.status}</Badge></Td>
            <Td className="text-xs">{formatDate(i.createdAt)}</Td>
            <Td className="text-xs">{formatDate(i.finishedAt)}</Td>
            <Td className="max-w-64 text-xs text-danger">{truncate(i.error, 120)}</Td>
          </tr>
        ))}
      </Table>
      <Pager page={page} hasMore={hasMore} base="/admin/installations" params={{ status: sp.status, guild: sp.guild, user: sp.user }} />
    </>
  );
}
