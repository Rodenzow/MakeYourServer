import Link from "next/link";
import type { ReactNode } from "react";
import type { HelpBlock } from "@/lib/help-content";
import { Term } from "./term";

/** Transforme « [libellé](/lien) » en lien et « {{id|libellé}} » en mot du glossaire. */
export function RichText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|\{\{([^|}]+)\|([^}]+)\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] && m[2]) {
      const href = m[2];
      out.push(
        href.startsWith("http") ? (
          <a key={i++} href={href} className="link font-medium" target="_blank" rel="noreferrer">
            {m[1]}
            <span className="sr-only"> (nouvel onglet)</span>
          </a>
        ) : (
          <Link key={i++} href={href} className="link font-medium">
            {m[1]}
          </Link>
        ),
      );
    } else if (m[3] && m[4]) {
      out.push(
        <Term key={i++} id={m[3]}>
          {m[4]}
        </Term>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/** Affiche les blocs d’une réponse du centre d’aide. */
export function HelpBlocks({ blocks }: { blocks: HelpBlock[] }) {
  return (
    <div className="space-y-3 text-ink">
      {blocks.map((b, i) =>
        typeof b === "string" ? (
          <p key={i}>
            <RichText text={b} />
          </p>
        ) : "list" in b ? (
          <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-peri">
            {b.list.map((t, j) => (
              <li key={j}>
                <RichText text={t} />
              </li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="space-y-2">
            {b.steps.map((t, j) => (
              <li key={j} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-edge bg-night font-mono text-xs font-semibold text-light" aria-hidden>
                  {j + 1}
                </span>
                <span>
                  <span className="sr-only">Étape {j + 1} : </span>
                  <RichText text={t} />
                </span>
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
