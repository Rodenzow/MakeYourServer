import Link from "next/link";
import { Badge, PageHeader, formatDate } from "@/components/ui";
import { listUsers, pageOf } from "@/lib/admin";
import { FilterField, Filters, Pager, Table, Td } from "../table";

export const metadata = { title: "Utilisateurs" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const { rows, hasMore } = await listUsers(sp.q, page);
  return (
    <>
      <PageHeader eyebrow="Administration" title="Utilisateurs" />
      <Filters action="/admin/utilisateurs">
        <FilterField label="Pseudo ou identifiant Discord">
          <input name="q" defaultValue={sp.q} className="field" placeholder="Rechercher…" />
        </FilterField>
      </Filters>
      <Table head={["Utilisateur", "Identifiant Discord", "Inscription", "Dernière connexion", "Projets", "Statut"]} empty={rows.length === 0}>
        {rows.map((u) => (
          <tr key={u.id} className="hover:bg-paper">
            <Td>
              <Link href={`/admin/utilisateurs/${u.id}`} className="font-semibold text-fg hover:underline">
                {u.globalName ?? u.username}
              </Link>
              <div className="text-xs text-muted">@{u.username}</div>
            </Td>
            <Td className="font-mono text-xs">{u.discordId}</Td>
            <Td>{formatDate(u.createdAt, false)}</Td>
            <Td>{formatDate(u.lastLoginAt)}</Td>
            <Td>{u.projects}</Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                {u.premium && <Badge tone="blue">Premium</Badge>}
                {u.suspendedAt ? <Badge tone="danger">Suspendu</Badge> : <Badge tone="success">Actif</Badge>}
              </div>
            </Td>
          </tr>
        ))}
      </Table>
      <Pager page={page} hasMore={hasMore} base="/admin/utilisateurs" params={{ q: sp.q }} />
    </>
  );
}
