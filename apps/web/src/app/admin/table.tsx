import Link from "next/link";
import type { ReactNode } from "react";

/** Tableau sobre de l’administration (défilement horizontal sur mobile). */
export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line bg-mist/50 text-xs text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/70">
          {empty ? (
            <tr>
              <td colSpan={head.length} className="px-3 py-8 text-center text-muted">
                Aucun résultat.
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className = "" }: { children?: ReactNode; className?: string }) => <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;

/** Pagination par liens (préserve les filtres de la requête). */
export function Pager({ page, hasMore, base, params }: { page: number; hasMore: boolean; base: string; params: Record<string, string | undefined> }) {
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter(([, v]) => v) as Array<[string, string]>);
    return `${base}?${q}`;
  };
  if (page === 1 && !hasMore) return null;
  return (
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
      {page > 1 ? <Link className="font-semibold text-blue-strong" href={href(page - 1)}>← Précédent</Link> : <span />}
      <span className="text-muted">Page {page}</span>
      {hasMore ? <Link className="font-semibold text-blue-strong" href={href(page + 1)}>Suivant →</Link> : <span />}
    </nav>
  );
}

/** Formulaire de filtres en GET : fonctionne sans JavaScript. */
export function Filters({ children, action }: { children: ReactNode; action: string }) {
  return (
    <form action={action} method="get" className="panel mb-4 flex flex-wrap items-end gap-3 p-3">
      {children}
      <button className="h-10 rounded-[10px] border-2 border-edge bg-night px-4 text-sm font-semibold text-white">Filtrer</button>
      <Link href={action} className="h-10 px-2 text-sm leading-10 text-muted hover:text-fg">
        Réinitialiser
      </Link>
    </form>
  );
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-36 flex-col text-xs font-semibold text-ink">
      <span className="mb-1">{label}</span>
      {children}
    </label>
  );
}
