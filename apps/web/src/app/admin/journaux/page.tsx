import Link from "next/link";
import { Badge, PageHeader, cx, formatDate } from "@/components/ui";
import { listAuditLogs, listErrorLogs, pageOf } from "@/lib/admin";
import { FilterField, Filters, Pager, Table, Td } from "../table";

export const metadata = { title: "Journaux" };

type SP = { vue?: string; q?: string; source?: string; level?: string; action?: string; from?: string; to?: string; page?: string };

export default async function LogsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const view = sp.vue === "audit" ? "audit" : "erreurs";
  const page = pageOf(sp.page);
  return (
    <>
      <PageHeader eyebrow="Administration" title="Journaux">
        Les jetons, secrets et cookies sont masqués avant l’écriture des journaux ; les contenus privés n’y sont pas enregistrés.
      </PageHeader>
      <nav className="mb-4 flex gap-2" aria-label="Type de journal">
        {[
          ["erreurs", "Erreurs"],
          ["audit", "Actions (audit)"],
        ].map(([k, l]) => (
          <Link key={k} href={`/admin/journaux?vue=${k}`} className={cx("rounded-lg border px-3 py-1.5 text-sm font-semibold", view === k ? "border-edge bg-accent text-on-accent" : "border-line bg-surface text-ink hover:border-edge")}>
            {l}
          </Link>
        ))}
      </nav>
      {view === "erreurs" ? <ErrorView sp={sp} page={page} /> : <AuditView sp={sp} page={page} />}
    </>
  );
}

function DateFilters({ sp }: { sp: SP }) {
  return (
    <>
      <FilterField label="Du">
        <input type="date" name="from" defaultValue={sp.from} className="field" />
      </FilterField>
      <FilterField label="Au">
        <input type="date" name="to" defaultValue={sp.to} className="field" />
      </FilterField>
    </>
  );
}

async function ErrorView({ sp, page }: { sp: SP; page: number }) {
  const { rows, hasMore } = await listErrorLogs(sp, page);
  return (
    <>
      <Filters action="/admin/journaux">
        <input type="hidden" name="vue" value="erreurs" />
        <FilterField label="Recherche">
          <input name="q" defaultValue={sp.q} className="field" placeholder="Texte du message" />
        </FilterField>
        <FilterField label="Source">
          <select name="source" defaultValue={sp.source ?? ""} className="field">
            <option value="">Toutes</option>
            <option value="web">Site</option>
            <option value="bot">Bot</option>
            <option value="worker">Worker</option>
          </select>
        </FilterField>
        <FilterField label="Niveau">
          <select name="level" defaultValue={sp.level ?? ""} className="field">
            <option value="">Tous</option>
            <option value="error">Erreur</option>
            <option value="warn">Avertissement</option>
          </select>
        </FilterField>
        <DateFilters sp={sp} />
      </Filters>
      <Table head={["Date", "Source", "Niveau", "Message", "Contexte"]} empty={rows.length === 0}>
        {rows.map((e) => (
          <tr key={e.id}>
            <Td className="whitespace-nowrap text-xs">{formatDate(e.createdAt)}</Td>
            <Td>{e.source}</Td>
            <Td><Badge tone={e.level === "error" ? "danger" : "warning"}>{e.level}</Badge></Td>
            <Td className="max-w-80">{e.message}</Td>
            <Td>
              {Object.keys(e.context).length > 0 && (
                <details>
                  <summary className="cursor-pointer text-xs text-blue-strong">Voir</summary>
                  <pre className="mt-1 max-w-96 overflow-x-auto rounded bg-paper p-2 text-[11px]">{JSON.stringify(e.context, null, 2)}</pre>
                </details>
              )}
            </Td>
          </tr>
        ))}
      </Table>
      <Pager page={page} hasMore={hasMore} base="/admin/journaux" params={{ vue: "erreurs", q: sp.q, source: sp.source, level: sp.level, from: sp.from, to: sp.to }} />
    </>
  );
}

async function AuditView({ sp, page }: { sp: SP; page: number }) {
  const { rows, hasMore } = await listAuditLogs(sp, page);
  return (
    <>
      <Filters action="/admin/journaux">
        <input type="hidden" name="vue" value="audit" />
        <FilterField label="Action (préfixe)">
          <input name="action" defaultValue={sp.action} className="field font-mono" placeholder="admin. / installation. / backup." />
        </FilterField>
        <FilterField label="Utilisateur, cible ou serveur">
          <input name="q" defaultValue={sp.q} className="field" />
        </FilterField>
        <DateFilters sp={sp} />
      </Filters>
      <Table head={["Date", "Acteur", "Action", "Cible", "Serveur", "Détails"]} empty={rows.length === 0}>
        {rows.map((a) => (
          <tr key={a.id}>
            <Td className="whitespace-nowrap text-xs">{formatDate(a.createdAt)}</Td>
            <Td>
              <Badge tone={a.actorType === "admin" ? "night" : a.actorType === "user" ? "blue" : "neutral"}>{a.actorType}</Badge>
              {a.username && <div className="text-xs">{a.username}</div>}
            </Td>
            <Td className="font-mono text-xs">{a.action}</Td>
            <Td className="text-xs">
              {a.targetType ?? ""} <span className="font-mono text-muted">{a.targetId?.slice(0, 12) ?? ""}</span>
            </Td>
            <Td className="font-mono text-xs">{a.guildId ?? ""}</Td>
            <Td>
              {Object.keys(a.metadata).length > 0 && (
                <details>
                  <summary className="cursor-pointer text-xs text-blue-strong">Voir</summary>
                  <pre className="mt-1 max-w-96 overflow-x-auto rounded bg-paper p-2 text-[11px]">{JSON.stringify(a.metadata, null, 2)}</pre>
                </details>
              )}
            </Td>
          </tr>
        ))}
      </Table>
      <Pager page={page} hasMore={hasMore} base="/admin/journaux" params={{ vue: "audit", q: sp.q, action: sp.action, from: sp.from, to: sp.to }} />
    </>
  );
}
