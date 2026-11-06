import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { GLOSSARY, GLOSSARY_GROUPS, getGlossaryEntry } from "@/lib/glossary";

export const metadata = {
  title: "Glossaire",
  description: "Les mots de Discord et de Make Your Server expliqués simplement : serveur, salon, rôle, permission, onboarding, sauvegarde, restauration…",
};

export default function GlossaryPage() {
  const collator = new Intl.Collator("fr", { sensitivity: "base" });
  return (
    <div className="mx-auto max-w-3xl">
      <nav aria-label="Fil d’Ariane" className="mb-4 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/aide" className="link">
              Centre d’aide
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li aria-current="page" className="text-ink">
            Glossaire
          </li>
        </ol>
      </nav>
      <PageHeader eyebrow="Aide" title="Glossaire">
        Les mots de Discord et de Make Your Server, expliqués en une ou deux phrases. Sur le site, les mots soulignés en pointillés affichent aussi leur définition au survol ou au toucher.
      </PageHeader>

      <nav aria-label="Thèmes du glossaire" className="panel p-4">
        <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {GLOSSARY_GROUPS.map((g) => (
            <li key={g.id}>
              <a href={`#theme-${g.id}`} className="link font-semibold">
                {g.title}
              </a>
              <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted">
                {GLOSSARY.filter((e) => e.group === g.id)
                  .sort((a, b) => collator.compare(a.term, b.term))
                  .map((e) => (
                    <a key={e.id} href={`#${e.id}`} className="underline decoration-line underline-offset-2 hover:text-fg hover:decoration-peri">
                      {e.term}
                    </a>
                  ))}
              </p>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10 space-y-12">
        {GLOSSARY_GROUPS.map((g) => (
          <section key={g.id} id={`theme-${g.id}`} aria-labelledby={`titre-${g.id}`} className="scroll-mt-24">
            <h2 id={`titre-${g.id}`} className="text-2xl font-bold">
              {g.title}
            </h2>
            <p className="mt-1 text-muted">{g.intro}</p>
            <dl className="mt-5 space-y-3">
              {GLOSSARY.filter((e) => e.group === g.id)
                .sort((a, b) => collator.compare(a.term, b.term))
                .map((e) => (
                  <div key={e.id} id={e.id} className="panel scroll-mt-24 p-4 target:border-blue target:shadow-[4px_4px_0_0_rgb(131_168_243/0.35)] sm:p-5">
                    <dt className="font-display text-lg font-semibold text-fg">{e.term}</dt>
                    <dd className="mt-1 space-y-2 text-ink">
                      <p>{e.short}</p>
                      {e.more && <p className="text-muted">{e.more}</p>}
                      {e.example && (
                        <p className="text-sm">
                          <span className="font-semibold text-peri">Exemple : </span>
                          {e.example}
                        </p>
                      )}
                      {e.related?.length ? (
                        <p className="text-sm text-muted">
                          Voir aussi :{" "}
                          {e.related
                            .map((r) => getGlossaryEntry(r))
                            .filter((r) => !!r)
                            .map((r, i, arr) => (
                              <span key={r.id}>
                                <a href={`#${r.id}`} className="link">
                                  {r.term}
                                </a>
                                {i < arr.length - 1 ? ", " : ""}
                              </span>
                            ))}
                        </p>
                      ) : null}
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        ))}
      </div>

      <p className="mt-12 text-center text-sm text-muted">
        Un mot manque ?{" "}
        <Link href="/aide#contact" className="link font-semibold">
          Dites-le-nous
        </Link>
        .
      </p>
    </div>
  );
}
