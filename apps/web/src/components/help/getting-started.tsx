import Link from "next/link";
import { ButtonLink, HelpLink, cx } from "../ui";
import { IconArrowRight, IconCheck } from "../icons";
import { Term } from "./term";

export type GettingStartedStep = "template" | "customize" | "bot" | "install";

export interface GettingStartedProps {
  /** Étapes déjà faites (calculées par la page : projet existant, projet modifié, bot présent, installation réussie…). */
  done: Partial<Record<GettingStartedStep, boolean>>;
  /** Projet le plus récent : les liens « Personnaliser » et « Installer » y mènent directement. */
  projectId?: string;
  /** Remplace un lien par défaut. */
  hrefs?: Partial<Record<GettingStartedStep, string>>;
  className?: string;
  /** Identifiant du titre (à changer seulement si la checklist apparaît deux fois sur la page). */
  headingId?: string;
}

/**
 * Checklist « Premiers pas » en 4 étapes, pour le tableau de bord.
 * Composant serveur : l’état coché est fourni par la page.
 */
export function GettingStarted({ done, projectId, hrefs, className, headingId = "premiers-pas-titre" }: GettingStartedProps) {
  const steps: Array<{ key: GettingStartedStep; title: string; text: React.ReactNode; action: string; href: string }> = [
    {
      key: "template",
      title: "Choisir un template",
      text: (
        <>
          Un <Term id="template">template</Term> est un modèle de serveur prêt à l’emploi. Choisissez celui qui ressemble à votre communauté.
        </>
      ),
      action: "Voir les templates",
      href: hrefs?.template ?? "/templates",
    },
    {
      key: "customize",
      title: "Le personnaliser",
      text: (
        <>
          Renommez les salons, ajoutez des <Term id="role">rôles</Term>, modifiez les messages. Facultatif : tout est déjà prêt.
        </>
      ),
      action: "Ouvrir l’éditeur",
      href: hrefs?.customize ?? (projectId ? `/projets/${projectId}` : "/projets"),
    },
    {
      key: "bot",
      title: "Inviter le bot",
      text: (
        <>
          Créez un <Term id="serveur">serveur</Term> dans Discord si besoin, puis ajoutez-y notre <Term id="bot">bot</Term> : c’est lui qui installera tout.
        </>
      ),
      action: "Inviter le bot",
      href: hrefs?.bot ?? "/serveurs",
    },
    {
      key: "install",
      title: "Installer",
      text: <>Le site analyse votre serveur et vous montre ce qui va changer. Rien n’est modifié avant votre confirmation.</>,
      action: "Lancer l’installation",
      href: hrefs?.install ?? (projectId ? `/projets/${projectId}/installer` : "/projets"),
    },
  ];
  const count = steps.filter((s) => done[s.key]).length;
  const next = steps.find((s) => !done[s.key]);
  const pct = Math.round((count / steps.length) * 100);

  return (
    <section aria-labelledby={headingId} className={cx("brick p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-xl font-bold">
            Premiers pas
          </h2>
          <p className="mt-0.5 text-sm text-muted">{count === steps.length ? "Les 4 étapes sont terminées." : `${count} étape${count > 1 ? "s" : ""} sur 4 terminée${count > 1 ? "s" : ""}.`}</p>
        </div>
        <HelpLink href="/aide#premiers-pas" label="Aide" />
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-night" aria-hidden>
        <div className="h-full rounded-full bg-blue transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>

      <ol className="mt-5 space-y-2.5">
        {steps.map((s, i) => {
          const isDone = !!done[s.key];
          const isNext = next?.key === s.key;
          return (
            <li key={s.key} aria-current={isNext ? "step" : undefined} className={cx("flex gap-3 rounded-xl border p-3 sm:p-4", isNext ? "border-light bg-surface" : "border-line bg-night/40")}>
              <span
                className={cx(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold",
                  isDone ? "border-success bg-success-soft text-success" : isNext ? "border-light bg-accent text-on-accent" : "border-edge text-ink",
                )}
                aria-hidden
              >
                {isDone ? <IconCheck size={14} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cx("font-semibold", isDone ? "text-ink" : "text-fg")}>
                  <span className="sr-only">
                    Étape {i + 1}, {isDone ? "terminée" : isNext ? "à faire maintenant" : "à faire"} :{" "}
                  </span>
                  {s.title}
                </p>
                {!isDone && <p className="mt-0.5 text-sm text-muted">{s.text}</p>}
                {isNext && (
                  <ButtonLink href={s.href} size="sm" className="mt-3">
                    {s.action} <IconArrowRight size={14} />
                  </ButtonLink>
                )}
                {!isDone && !isNext && (
                  <Link href={s.href} className="mt-1 inline-flex min-h-8 items-center text-sm font-semibold text-blue-strong hover:underline">
                    {s.action}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {count === steps.length && (
        <p className="mt-4 rounded-xl bg-success-soft px-4 py-3 text-sm text-success">
          Bravo, votre serveur est en place ! Pensez à le{" "}
          <Link href="/sauvegardes" className="font-semibold underline">
            sauvegarder
          </Link>{" "}
          de temps en temps.
        </p>
      )}
    </section>
  );
}
