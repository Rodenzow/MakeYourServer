import Link from "next/link";
import { THEME_LABELS } from "@mys/core";
import { ActionButton } from "@/components/admin/action-button";
import { Badge, ButtonLink, PageHeader, cx, formatDate } from "@/components/ui";
import { TEMPLATE_STATUSES, TEMPLATE_STATUS_LABELS, listAdminTemplates } from "@/lib/admin";
import { Table, Td } from "../table";

export const metadata = { title: "Templates" };

const TONE: Record<string, "neutral" | "blue" | "success" | "warning" | "danger"> = { draft: "neutral", pending_review: "warning", published: "success", rejected: "danger", archived: "neutral" };

export default async function AdminTemplates({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const { statut } = await searchParams;
  const rows = await listAdminTemplates(statut);
  return (
    <>
      <PageHeader eyebrow="Administration" title="Templates" actions={<ButtonLink href="/admin/templates/nouveau" size="sm">Nouveau template</ButtonLink>}>
        Seuls les templates « Publié » apparaissent dans la bibliothèque. Les sauvegardes et projets privés n’y figurent jamais.
      </PageHeader>
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filtrer par statut">
        {[undefined, ...TEMPLATE_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/admin/templates?statut=${s}` : "/admin/templates"}
            className={cx("rounded-lg border px-3 py-1.5 text-sm font-semibold", statut === s || (!statut && !s) ? "border-edge bg-accent text-on-accent" : "border-line bg-surface text-ink hover:border-edge")}
          >
            {s ? TEMPLATE_STATUS_LABELS[s] : "Tous"}
          </Link>
        ))}
      </nav>
      <Table head={["Template", "Thème", "Statut", "Installations", "Auteur", "Modifié", ""]} empty={rows.length === 0}>
        {rows.map((t) => (
          <tr key={t.id}>
            <Td>
              <Link href={`/admin/templates/${t.id}`} className="font-semibold hover:underline">{t.name}</Link>
              <div className="font-mono text-xs text-muted">{t.slug}</div>
            </Td>
            <Td>{THEME_LABELS[t.theme as keyof typeof THEME_LABELS] ?? t.theme}</Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                <Badge tone={TONE[t.status]}>{TEMPLATE_STATUS_LABELS[t.status] ?? t.status}</Badge>
                {t.official && <Badge tone="night">Officiel</Badge>}
              </div>
            </Td>
            <Td>{t.installCount}</Td>
            <Td className="text-xs">{t.official ? "Make Your Server" : t.authorName ?? "—"}</Td>
            <Td className="text-xs">{formatDate(t.updatedAt)}</Td>
            <Td>
              <ActionButton url="/api/admin/templates" body={{ duplicateOf: t.id }} label="Dupliquer" variant="ghost" />
            </Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
