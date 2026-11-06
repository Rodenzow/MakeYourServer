"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AUDIENCES,
  MODERATIONS,
  MOODS,
  NEEDS,
  QUIZ_QUESTIONS,
  QUIZ_STEPS,
  SIZE_OPTIONS,
  isAnswered,
  recommendTemplates,
  type QuizAnswers,
  type QuizOption,
  type QuizStep,
  type QuizTemplate,
} from "@/lib/template-quiz";
import { AnimatedNumber } from "../motion";
import { ButtonLink, Button, cx } from "../ui";
import { IconArrowRight, IconCheck, IconChevron, IconUndo } from "../icons";
import { themeVisual } from "./theme-visuals";
import { UseTemplateButton } from "./use-template-button";

const EASE = [0.2, 0.9, 0.25, 1] as const;

const OPTIONS: Record<QuizStep, QuizOption[]> = {
  audience: AUDIENCES,
  size: SIZE_OPTIONS,
  mood: MOODS,
  needs: NEEDS,
  moderation: MODERATIONS,
};

/** Questionnaire « Trouver mon template » : une question par écran, calcul local. */
export function TemplateQuiz({ templates, loggedIn }: { templates: QuizTemplate[]; loggedIn: boolean }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<QuizAnswers>({ needs: [] });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const pending = useRef<number | null>(null);
  const done = index >= QUIZ_STEPS.length;
  const step = QUIZ_STEPS[Math.min(index, QUIZ_STEPS.length - 1)]!;
  const results = useMemo(() => (done ? recommendTemplates(answers, templates) : []), [done, answers, templates]);

  // Déplace le focus sur le titre de chaque nouvel écran (lecteurs d’écran, clavier).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: false });
  }, [index]);

  const go = (to: number) => {
    if (pending.current !== null) {
      window.clearTimeout(pending.current);
      pending.current = null;
    }
    setDirection(to > index ? 1 : -1);
    setIndex(to);
  };
  const choose = (value: string) => {
    if (step === "needs") {
      setAnswers((a) => ({ ...a, needs: a.needs.includes(value) ? a.needs.filter((n) => n !== value) : [...a.needs, value] }));
      return;
    }
    setAnswers((a) => ({ ...a, [step]: value }));
    // Laisse voir la sélection un instant avant de passer à la question suivante (un seul passage, même en double-cliquant).
    if (pending.current !== null) return;
    const next = index + 1;
    pending.current = window.setTimeout(() => {
      pending.current = null;
      setDirection(1);
      setIndex(next);
    }, reduce ? 0 : 180);
  };
  const selected = (value: string) => (step === "needs" ? answers.needs.includes(value) : answers[step] === value);
  const progress = done ? 100 : (index / QUIZ_STEPS.length) * 100;

  const variants = {
    enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 40, filter: "blur(4px)" }),
    center: { opacity: 1, x: 0, filter: "blur(0px)" },
    exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * -40, filter: "blur(4px)" }),
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-ink" aria-live="polite">
            {done ? "Résultats" : `Question ${index + 1} sur ${QUIZ_STEPS.length}`}
          </span>
          {index > 0 && (
            <button type="button" onClick={() => go(index - 1)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-muted transition-colors hover:bg-mist hover:text-fg focus-visible:outline-2 focus-visible:outline-light">
              <IconChevron size={14} className="rotate-180" /> Retour
            </button>
          )}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-mist" role="progressbar" aria-label="Progression du questionnaire" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <motion.div className="h-full rounded-full bg-gradient-to-r from-blue to-light" initial={false} animate={{ width: `${Math.max(progress, 4)}%` }} transition={{ duration: 0.45, ease: EASE }} />
        </div>
      </div>

      <AnimatePresence mode="wait" custom={direction} initial={false}>
        {!done ? (
          <motion.section key={step} custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.32, ease: EASE }} aria-labelledby="quiz-question">
            <h2 id="quiz-question" ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold outline-none md:text-3xl">
              {QUIZ_QUESTIONS[step].title}
            </h2>
            <p className="mt-1 text-muted">{QUIZ_QUESTIONS[step].help}</p>
            <div className={cx("mt-6 grid gap-3", OPTIONS[step].length > 6 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")} role="group" aria-label={QUIZ_QUESTIONS[step].title}>
              {OPTIONS[step].map((o, i) => (
                <motion.button
                  key={o.value}
                  type="button"
                  aria-pressed={selected(o.value)}
                  onClick={() => choose(o.value)}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: reduce ? 0 : i * 0.03, ease: EASE }}
                  className={cx(
                    "group flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light",
                    selected(o.value) ? "border-light bg-blue/15" : "border-line bg-surface hover:border-edge",
                  )}
                >
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-mist text-xl transition-transform group-hover:scale-110">
                    {o.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-fg">{o.label}</span>
                    {o.hint && <span className="block text-sm text-muted">{o.hint}</span>}
                  </span>
                  <span aria-hidden className={cx("grid size-6 shrink-0 place-items-center rounded-full border transition-colors", selected(o.value) ? "border-light bg-light text-on-accent" : "border-line text-transparent")}>
                    <IconCheck size={14} />
                  </span>
                </motion.button>
              ))}
            </div>
            {step === "needs" && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button onClick={() => go(index + 1)}>
                  {answers.needs.length ? `Continuer (${answers.needs.length} choix)` : "Passer cette question"} <IconArrowRight size={16} />
                </Button>
              </div>
            )}
            {step !== "needs" && isAnswered(step, answers) && (
              <div className="mt-6">
                <Button variant="secondary" onClick={() => go(index + 1)}>
                  Question suivante <IconArrowRight size={16} />
                </Button>
              </div>
            )}
          </motion.section>
        ) : (
          <motion.section key="resultats" custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.35, ease: EASE }} aria-labelledby="quiz-resultats">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="quiz-resultats" ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold outline-none md:text-3xl">
                  {results.length ? "Les templates faits pour vous" : "Aucun template disponible"}
                </h2>
                <p className="mt-1 text-muted">{results.length ? "Classés selon vos réponses. Tout reste personnalisable avant l’installation." : "La bibliothèque est vide pour le moment."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={() => go(0)}>
                  Modifier mes réponses
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setAnswers({ needs: [] });
                    go(0);
                  }}
                >
                  <IconUndo size={14} /> Recommencer
                </Button>
              </div>
            </div>

            <ol className="mt-6 grid gap-4 lg:grid-cols-3">
              {results.map((r, i) => {
                const v = themeVisual(r.template.theme);
                return (
                  <motion.li
                    key={r.template.slug}
                    initial={reduce ? false : { opacity: 0, y: 24, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.5, delay: reduce ? 0 : 0.1 + i * 0.12, ease: EASE }}
                    className={cx("flex flex-col overflow-hidden rounded-[18px] border bg-surface", i === 0 ? "border-light" : "border-line")}
                    style={{ boxShadow: `0 18px 40px -28px ${v.from}` }}
                  >
                    <div className="relative h-20 overflow-hidden" style={{ background: `linear-gradient(120deg, ${v.from}, ${v.to})` }}>
                      <span aria-hidden className="absolute -right-1 -bottom-3 text-5xl opacity-35">
                        {v.emoji}
                      </span>
                      <span className="absolute top-3 left-4 rounded-md bg-night/80 px-2 py-0.5 text-xs font-bold text-white">{i === 0 ? "Meilleur choix" : `N°${i + 1}`}</span>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-display text-lg leading-tight font-bold">{r.template.name}</h3>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted">{r.template.tagline}</p>
                      <div className="mt-3">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-semibold text-muted">Correspondance</span>
                          <span className="font-display text-2xl font-bold text-light">
                            <AnimatedNumber value={r.score} />
                            <span className="text-base"> %</span>
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-mist" aria-hidden>
                          <motion.div className="h-full rounded-full bg-light" initial={reduce ? false : { width: 0 }} animate={{ width: `${r.score}%` }} transition={{ duration: 0.9, delay: reduce ? 0 : 0.2 + i * 0.12, ease: EASE }} />
                        </div>
                      </div>
                      <ul className="mt-4 space-y-2 text-sm text-ink">
                        {r.reasons.map((reason) => (
                          <li key={reason} className="flex gap-2">
                            <IconCheck size={15} className="mt-0.5 shrink-0 text-success" />
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                      {r.missing.length > 0 && <p className="mt-3 text-xs text-muted">À ajouter dans l’éditeur : {r.missing.join(", ")}.</p>}
                      <div className="mt-auto flex flex-wrap items-start gap-2 pt-5">
                        <ButtonLink href={`/templates/${r.template.slug}`} variant="secondary" size="lg">
                          Voir
                        </ButtonLink>
                        <UseTemplateButton slug={r.template.slug} loggedIn={loggedIn} label="Personnaliser" />
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ol>
            <p className="mt-6 text-center text-sm text-muted">
              Rien ne vous convient ?{" "}
              <Link href="/templates" className="font-semibold text-fg underline">
                Parcourez toute la bibliothèque
              </Link>
              .
            </p>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
