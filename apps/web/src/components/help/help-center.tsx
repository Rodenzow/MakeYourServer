"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { HELP_CATEGORIES, HELP_QUESTIONS, answerText, type HelpQuestion } from "@/lib/help-content";
import { HelpBlocks } from "./rich-text";
import { IconCheck, IconChevronDown, IconSearch, IconX } from "../icons";
import { cx } from "../ui";

/** Minuscules, sans accents ni apostrophes : « Rôle » et « role » se valent. */
export function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .toLowerCase()
    .replace(/[’'`«»"().,;:!?/\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface Indexed {
  q: HelpQuestion;
  question: string;
  keywords: string;
  body: string;
}

const CATEGORY_TITLE = new Map(HELP_CATEGORIES.map((c) => [c.id, c.title]));

export function HelpCenter() {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const input = useRef<HTMLInputElement>(null);

  const index = useMemo<Indexed[]>(
    () =>
      HELP_QUESTIONS.map((q) => ({
        q,
        question: normalize(q.question),
        keywords: normalize([...(q.keywords ?? []), CATEGORY_TITLE.get(q.category) ?? ""].join(" ")),
        body: normalize(answerText(q)),
      })),
    [],
  );

  const words = normalize(deferred).split(" ").filter(Boolean);
  const results = useMemo(() => {
    if (!words.length) return null;
    return index
      .map((it) => {
        let score = 0;
        for (const w of words) {
          const inQ = it.question.includes(w);
          const inK = it.keywords.includes(w);
          const inB = it.body.includes(w);
          if (!inQ && !inK && !inB) return null;
          score += (inQ ? 3 : 0) + (inK ? 2 : 0) + (inB ? 1 : 0);
        }
        return { q: it.q, score };
      })
      .filter((x): x is { q: HelpQuestion; score: number } => !!x)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, words.join(" ")]);

  // Ancre partageable (/aide#id) : ouvre la question visée et la fait défiler à l’écran.
  useEffect(() => {
    const openFromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement) {
        el.open = true;
        el.scrollIntoView({ block: "start" });
        el.querySelector("summary")?.focus({ preventScroll: true });
      }
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  const total = HELP_QUESTIONS.length;
  const status =
    results === null
      ? `${total} questions dans ${HELP_CATEGORIES.length} rubriques.`
      : results.length === 0
        ? "Aucune réponse ne correspond à votre recherche."
        : `${results.length} réponse${results.length > 1 ? "s" : ""} trouvée${results.length > 1 ? "s" : ""}.`;

  return (
    <div>
      <div role="search" className="brick blueprint p-5 sm:p-6">
        <label htmlFor={inputId} className="font-display text-lg font-semibold text-fg">
          Que cherchez-vous ?
        </label>
        <div className="relative mt-3">
          <IconSearch size={20} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
          <input
            ref={input}
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                setQuery("");
              }
            }}
            placeholder="Ex. : inviter le bot, restaurer, rôle…"
            className="field h-12 !pr-12 !pl-11 text-base [&::-webkit-search-cancel-button]:hidden"
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${inputId}-status`}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                input.current?.focus();
              }}
              className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-mist hover:text-fg"
            >
              <IconX size={18} />
              <span className="sr-only">Effacer la recherche</span>
            </button>
          )}
        </div>
        <p id={`${inputId}-status`} className="mt-2 text-sm text-muted" role="status" aria-live="polite">
          {status}
        </p>
        {results === null && (
          <nav aria-label="Rubriques de l’aide" className="mt-4">
            <ul className="flex flex-wrap gap-2">
              {HELP_CATEGORIES.map((c) => (
                <li key={c.id}>
                  <a
                    href={`#rubrique-${c.id}`}
                    className="inline-flex min-h-9 items-center rounded-full border border-edge bg-night px-3.5 text-sm font-semibold text-ink transition-colors hover:border-blue hover:text-fg"
                  >
                    {c.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      <div className="mt-10">
        {results === null ? (
          <div className="space-y-12">
            {HELP_CATEGORIES.map((c) => {
              const qs = HELP_QUESTIONS.filter((q) => q.category === c.id);
              return (
                <section key={c.id} id={`rubrique-${c.id}`} aria-labelledby={`titre-${c.id}`} className="scroll-mt-24">
                  <h2 id={`titre-${c.id}`} className="text-2xl font-bold">
                    {c.title}
                  </h2>
                  <p className="mt-1 text-muted">{c.description}</p>
                  <QuestionList questions={qs} />
                </section>
              );
            })}
          </div>
        ) : results.length > 0 ? (
          <section aria-label="Résultats de la recherche">
            <QuestionList questions={results} showCategory openFirst={results.length === 1} />
          </section>
        ) : (
          <div className="panel px-6 py-10 text-center">
            <p className="font-display text-lg font-semibold">Aucune réponse pour « {query.trim()} »</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">Essayez un mot plus simple (par exemple « bot », « sauvegarde », « rôle »), ou consultez le glossaire.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button type="button" className="link font-semibold" onClick={() => setQuery("")}>
                Voir toutes les questions
              </button>
              <Link href="/aide/glossaire" className="link font-semibold">
                Ouvrir le glossaire
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionList({ questions, showCategory, openFirst }: { questions: HelpQuestion[]; showCategory?: boolean; openFirst?: boolean }) {
  return (
    <ul className="mt-4 space-y-2.5">
      {questions.map((q, i) => (
        <li key={q.id}>
          <QuestionItem q={q} showCategory={showCategory} defaultOpen={openFirst && i === 0} />
        </li>
      ))}
    </ul>
  );
}

function QuestionItem({ q, showCategory, defaultOpen }: { q: HelpQuestion; showCategory?: boolean; defaultOpen?: boolean }) {
  return (
    <details id={q.id} open={defaultOpen} className="group panel scroll-mt-24 transition-colors open:border-edge">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-[var(--radius-block)] px-4 py-3 hover:bg-mist/50 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span>
          {showCategory && <span className="mb-0.5 block text-xs font-semibold text-peri">{CATEGORY_TITLE.get(q.category)}</span>}
          <span className="font-display text-[1.05rem] font-semibold text-fg">{q.question}</span>
        </span>
        <IconChevronDown size={18} className="shrink-0 text-peri transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-t border-line px-4 pt-4 pb-4 sm:px-5">
        <HelpBlocks blocks={q.answer} />
        <AnswerFooter id={q.id} question={q.question} />
      </div>
    </details>
  );
}

/** « Cette réponse vous a aidé ? » : simple retour visuel, rien n’est enregistré. */
function AnswerFooter({ id, question }: { id: string; question: string }) {
  const [vote, setVote] = useState<"oui" | "non" | null>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = `${window.location.origin}/aide#${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.location.hash = id;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line pt-3 text-sm">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Avis sur la réponse « ${question} »`}>
        {vote === null ? (
          <>
            <span className="text-muted">Cette réponse vous a aidé ?</span>
            {(["oui", "non"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVote(v)}
                className="inline-flex h-9 min-w-12 items-center justify-center rounded-lg border border-edge bg-night px-3 font-semibold text-ink hover:border-blue hover:text-fg"
              >
                {v === "oui" ? "Oui" : "Non"}
              </button>
            ))}
          </>
        ) : null}
        <p role="status" className={cx(vote === null && "sr-only")}>
          {vote === "oui" && (
            <span className="inline-flex items-center gap-1.5 text-success">
              <IconCheck size={16} /> Merci pour votre retour !
            </span>
          )}
          {vote === "non" && (
            <span className="text-ink">
              Désolé. Consultez le{" "}
              <Link href="/aide/glossaire" className="link font-semibold">
                glossaire
              </Link>{" "}
              ou{" "}
              <a href="#contact" className="link font-semibold">
                contactez-nous
              </a>
              .
            </span>
          )}
        </p>
      </div>
      <button type="button" onClick={copy} className="inline-flex h-9 items-center rounded-lg px-2 font-semibold text-muted hover:bg-mist hover:text-fg">
        <span aria-live="polite">{copied ? "Lien copié" : "Copier le lien"}</span>
        <span className="sr-only"> vers cette question</span>
      </button>
    </div>
  );
}
