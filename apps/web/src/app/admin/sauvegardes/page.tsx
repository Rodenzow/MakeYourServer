import Link from "next/link";
import { ActionButton } from "@/components/admin/action-button";
import { Badge, Notice, PageHeader, formatDate } from "@/components/ui";
import { formatBytes, listAdminBackups, pageOf } from "@/lib/admin";
import { FilterField, Filters, Pager, Table, Td } from "../table";

export const metadata = { title: "Sauvegardes" };

const KIND: Record<string, string> = { safety: "Sécurité", manual: "Manuelle", scheduled: "Programmée" };

export default async function AdminBackups({ searchParams }: { searchParams: Promise<{ guild?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const { rows, hasMore } = await listAdminBackups(page, sp.guild);
  return (
    <>
      <PageHeader eyebrow="Administration" title="Sauvegardes" actions={<ActionButton url="/api/admin/backups/purge" label="Purger les sauvegardes expirées" confirm="Supprimer toutes les sauvegardes dont la durée de conservation est dépassée ?" successMessage="Purge effectuée." />} />
      <Notice tone="blue" className="mb-4">
        Les sauvegardes sont privées : seules leurs métadonnées sont visibles ici. Leur contenu (configuration, messages exportés) n’est jamais affiché dans l’administration.
      </Notice>
      <Filters action="/admin/sauvegardes">
        <FilterField label="Identifiant du serveur">
          <input name="guild" defaultValue={sp.guild} className="field font-mono" />
        </FilterField>
      </Filters>
      <Table head={["Serveur", "Propriétaire", "Type", "Version", "Contenu", "Taille", "Créée", "Expire", ""]} empty={rows.length === 0}>
        {rows.map((b) => (
          <tr key={b.id}>
            <Td>
              {b.guildName}
              <div className="font-mono text-xs text-muted">{b.guildId}</div>
            </Td>
            <Td><Link href={`/admin/utilisateurs/${b.userId}`} className="hover:underline">{b.username}</Link></Td>
            <Td><Badge tone={b.kind === "safety" ? "blue" : "neutral"}>{KIND[b.kind] ?? b.kind}</Badge></Td>
            <Td>n°{b.version}</Td>
            <Td className="text-xs">{b.summary.channels ?? 0} salons · {b.summary.roles ?? 0} rôles{b.messageCount ? ` · ${b.messageCount} messages` : ""}</Td>
            <Td className="text-xs">{formatBytes(b.sizeBytes)}</Td>
            <Td className="text-xs">{formatDate(b.createdAt)}</Td>
            <Td className="text-xs">{b.expiresAt ? formatDate(b.expiresAt, false) : "—"}</Td>
            <Td>
              <ActionButton url={`/api/admin/backups/${b.id}`} method="DELETE" label="Supprimer" variant="ghost" confirm="Supprimer définitivement cette sauvegarde ? Son propriétaire ne pourra plus la restaurer." />
            </Td>
          </tr>
        ))}
      </Table>
      <Pager page={page} hasMore={hasMore} base="/admin/sauvegardes" params={{ guild: sp.guild }} />
    </>
  );
}
