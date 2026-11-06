"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import {
  AUDIT_CATEGORY_LABELS,
  AUDIT_FIXES,
  AUDIT_GRADE_LABELS,
  type AuditFixId,
  type AuditGrade,
  type AuditIssue,
  type AuditReport,
  type AuditSeverity,
} from "@mys/core";
import { Badge, Button, ButtonLink, Notice, cx, formatDate } from "../ui";
import { IconAlert, IconArrowRight, IconCheck, IconInfo, IconShield, IconSparkle, IconUndo } from "../icons";

export interface SerializedAudit {
  id: string;
  guildId: string;
  guildName: string;
  score: number;
  report: AuditReport;
  createdAt: string;
}

type ApiError = { message: string; code?: string };

const EASE = [0.2, 0.9, 0.25, 1] as const;

const GRADE_STYLE: Record<AuditGrade, { text: string; badge: "success" | "blue" | "warning" | "danger"; sentence: string }> = {
  excellent: { text: "text-success", badge: "success", sentence: "Votre serveur est très bien protégé. Bravo !" },
  bon: { text: "text-blue", badge: "blue", sentence: "Votre serveur est en bonne santé. Quelques ajustements le rendront encore plus sûr." },
  moyen: { text: "text-warning", badge: "warning", sentence: "Des points importants méritent votre attention. La plupart se corrigent en quelques clics." },
  fragile: { text: "text-danger", badge: "danger", sentence: "Votre serveur est exposé. Corrigez en priorité les problèmes critiques ci-dessous." },
};

const SEVERITY_SECTIONS: Array<{ key: AuditSeverity; title: string; hint: string; tone: "danger" | "warning" | "blue" }> = [
  { key: "critical", title: "Problèmes critiques", hint: "À corriger en priorité : ils exposent directement votre serveur.", tone: "danger" },
  { key: "warning", title: "À corriger", hint: "Ils fragilisent la modération ou le confort de vos membres.", tone: "warning" },
  { key: "tip", title: "Conseils", hint: "Des améliorations utiles, sans urgence.", tone: "blue" },
];

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? "Une erreur inattendue est survenue."), { code: data.code as string | undefined });
  return data as T;
}

export function ServerHealth({ guildId, guildName, initial, inviteUrl, sandbox }: { guildId: string; guildName: string; initial: SerializedAudit | null; inviteUrl: string | null; sandbox: boolean }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [audit, setAudit] = useState<SerializedAudit | null>(initial);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [fixError, setFixError] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);
  const fixable = useMemo(() => [...new Set((audit?.report.issues ?? []).map((i) => i.fix).filter((f): f is AuditFixId => !!f))], [audit]);
  const [selected, setSelected] = useState<Set<AuditFixId>>(() => new Set(fixable));
  const started = useRef(false);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setFixError(null);
    try {
      const data = await call<{ audit: SerializedAudit }>(`/api/guilds/${guildId}/audit`, { method: "POST" });
      setAudit(data.audit);
      setSelected(new Set(data.audit.report.issues.map((i) => i.fix).filter((f): f is AuditFixId => !!f)));
    } catch (e) {
      setError({ message: (e as Error).message, code: (e as { code?: string }).code });
    } finally {
      setRunning(false);
    }
  }, [guildId]);

  // Première visite : l’analyse démarre automatiquement.
  useEffect(() => {
    if (!initial && !started.current) {
      started.current = true;
      void run();
    }
  }, [initial, run]);

  const toggle = (fix: AuditFixId) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(fix)) next.delete(fix);
      else next.add(fix);
      return next;
    });

  const applyFixes = async () => {
    setFixing(true);
    setFixError(null);
    try {
      const data = await call<{ projectId: string }>(`/api/guilds/${guildId}/audit/fix`, { method: "POST", body: JSON.stringify({ fixIds: [...selected] }) });
      router.push(`/projets/${data.projectId}/installer`);
    } catch (e) {
      setFixError((e as Error).message);
      setFixing(false);
    }
  };

  const chosen = fixable.filter((f) => selected.has(f));

  return (
    <div className="space-y-8">
      {sandbox && (
        <Notice tone="warning" title="Mode bac à sable">
          L’analyse porte sur le serveur simulé (DISCORD_SANDBOX). Aucune action n’est envoyée à Discord.
        </Notice>
      )}

      {error && <AuditErrorNotice error={error} inviteUrl={inviteUrl} guildId={guildId} onRetry={run} running={running} />}

      {!audit && !error && <AnalysisPlaceholder />}

      {audit && (
        <>
          <section className="brick grid gap-6 p-5 sm:p-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-center" aria-live="polite">
            <ScoreGauge score={audit.report.score} grade={audit.report.grade} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={GRADE_STYLE[audit.report.grade].badge}>{AUDIT_GRADE_LABELS[audit.report.grade]}</Badge>
                <span className="text-xs text-muted">Analyse du {formatDate(audit.createdAt)}</span>
              </div>
              <p className="mt-2 font-display text-xl font-semibold">{GRADE_STYLE[audit.report.grade].sentence}</p>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Count label="Critiques" value={audit.report.counts.critical} tone="text-danger" />
                <Count label="À corriger" value={audit.report.counts.warning} tone="text-warning" />
                <Count label="Conseils" value={audit.report.counts.tip} tone="text-blue" />
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={run} disabled={running}>
                  <IconUndo size={15} />
                  {running ? "Analyse en cours…" : "Relancer l’analyse"}
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted">
                La note part de 100 : chaque problème retire quelques points selon sa gravité. Un problème critique limite la note à 69 tant qu’il n’est pas corrigé.
              </p>
            </div>
          </section>

          {audit.report.strengths.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">Points forts</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {audit.report.strengths.map((s, i) => (
                  <motion.li
                    key={s}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.35, ease: EASE }}
                    className="flex items-start gap-2 rounded-xl border border-line bg-success-soft/30 px-3 py-2 text-sm"
                  >
                    <IconCheck size={16} className="mt-0.5 shrink-0 text-success" />
                    <span>{s}</span>
                  </motion.li>
                ))}
              </ul>
            </section>
          )}

          {audit.report.issues.length === 0 ? (
            <Notice tone="success" title="Aucun problème détecté">
              Votre configuration suit toutes les bonnes pratiques que nous vérifions. Pensez à relancer l’analyse après des changements importants.
            </Notice>
          ) : (
            SEVERITY_SECTIONS.map((section) => {
              const issues = audit.report.issues.filter((i) => i.severity === section.key);
              if (!issues.length) return null;
              return (
                <section key={section.key} aria-labelledby={`sev-${section.key}`}>
                  <div className="mb-3">
                    <h2 id={`sev-${section.key}`} className="flex items-center gap-2 text-lg font-bold">
                      {section.key === "critical" ? <IconAlert size={18} className="text-danger" /> : section.key === "warning" ? <IconShield size={18} className="text-warning" /> : <IconInfo size={18} className="text-blue" />}
                      {section.title} <span className="font-mono text-sm text-muted">({issues.length})</span>
                    </h2>
                    <p className="text-sm text-muted">{section.hint}</p>
                  </div>
                  <ul className="space-y-3">
                    {issues.map((issue, i) => (
                      <IssueCard key={issue.id} issue={issue} index={i} tone={section.tone} checked={!!issue.fix && selected.has(issue.fix)} onToggle={issue.fix ? () => toggle(issue.fix!) : undefined} />
                    ))}
                  </ul>
                </section>
              );
            })
          )}

          {fixable.length > 0 && (
            <section className="panel p-5" aria-labelledby="fix-title">
              <h2 id="fix-title" className="flex items-center gap-2 font-display text-lg font-semibold">
                <IconSparkle size={18} className="text-blue" />
                Corrections automatiques
              </h2>
              <p className="mt-1 text-sm text-muted">
                Cochez les problèmes à corriger. Nous préparons un projet « Correctifs — {guildName} » à partir de la configuration actuelle de votre serveur.
              </p>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink">
                <li>Nous créons le projet avec uniquement les corrections choisies (rien n’est encore modifié sur Discord).</li>
                <li>Vous arrivez sur l’assistant d’installation : choisissez ce serveur et gardez le mode « Ajout à un serveur existant ».</li>
                <li>L’assistant affiche le détail des changements, prend une sauvegarde de sécurité, puis vous demande de confirmer.</li>
              </ol>
              {chosen.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {chosen.map((f) => (
                    <li key={f}>
                      <Badge tone="blue">{AUDIT_FIXES[f].label}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              {fixError && (
                <Notice tone="danger" className="mt-4" title="Impossible de préparer les correctifs">
                  {fixError}
                </Notice>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button onClick={applyFixes} disabled={fixing || chosen.length === 0}>
                  {fixing ? "Préparation…" : `Corriger la sélection (${chosen.length})`}
                  {!fixing && <IconArrowRight size={16} />}
                </Button>
                {chosen.length === 0 && <span className="text-sm text-muted">Cochez au moins un problème corrigeable.</span>}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* --------------------------------- Jauge --------------------------------- */

function ScoreGauge({ score, grade }: { score: number; grade: AuditGrade }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? score : 0);
  useEffect(() => {
    if (reduce) {
      setDisplay(score);
      return;
    }
    const controls = animate(0, score, { duration: 1.2, ease: EASE, onUpdate: (v) => setDisplay(Math.round(v)) });
    return () => controls.stop();
  }, [score, reduce]);
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className={cx("relative mx-auto size-40 shrink-0", GRADE_STYLE[grade].text)} role="img" aria-label={`Note : ${score} sur 100, ${AUDIT_GRADE_LABELS[grade]}`}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-line)" strokeWidth="10" />
        <motion.circle
          key={score}
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - score / 100) : c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: reduce ? 0 : 1.2, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        <span className="font-display text-4xl font-bold text-fg tabular-nums">{display}</span>
        <span className="text-xs text-muted">sur 100</span>
      </div>
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-night px-2 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cx("font-display text-2xl font-bold tabular-nums", value > 0 ? tone : "text-muted")}>{value}</dd>
    </div>
  );
}

/* --------------------------------- Problème -------------------------------- */

function IssueCard({ issue, index, tone, checked, onToggle }: { issue: AuditIssue; index: number; tone: "danger" | "warning" | "blue"; checked: boolean; onToggle?: () => void }) {
  const reduce = useReducedMotion();
  const border = { danger: "border-l-danger", warning: "border-l-warning", blue: "border-l-blue" }[tone];
  const inputId = `fix-${issue.id}`;
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index, duration: 0.35, ease: EASE }}
      className={cx("panel border-l-4 p-4", border, checked && "ring-1 ring-blue/60")}
    >
      <div className="flex items-start gap-3">
        {onToggle ? (
          <input id={inputId} type="checkbox" checked={checked} onChange={onToggle} className="mt-1 size-4 shrink-0 accent-[var(--color-blue)]" aria-describedby={`${inputId}-detail`} />
        ) : (
          <span className="mt-1 size-4 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {onToggle ? (
              <label htmlFor={inputId} className="cursor-pointer font-semibold">
                {issue.title}
              </label>
            ) : (
              <p className="font-semibold">{issue.title}</p>
            )}
            <Badge>{AUDIT_CATEGORY_LABELS[issue.category]}</Badge>
            <span className="font-mono text-xs text-muted">−{issue.points} pts</span>
          </div>
          <p id={`${inputId}-detail`} className="mt-1 text-sm text-ink">
            {issue.detail}
          </p>
          {issue.items && issue.items.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Éléments concernés">
              {issue.items.slice(0, 12).map((item) => (
                <li key={item} className="rounded-md bg-night px-2 py-0.5 font-mono text-xs text-ink">
                  {item}
                </li>
              ))}
              {issue.items.length > 12 && <li className="px-1 text-xs text-muted">et {issue.items.length - 12} autre(s)</li>}
            </ul>
          )}
          {issue.fix ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-blue">
              <IconSparkle size={13} /> Correction automatique : {AUDIT_FIXES[issue.fix].label}
            </p>
          ) : (
            issue.howTo && (
              <p className="mt-2 text-xs text-muted">
                <strong className="text-ink">Comment faire :</strong> {issue.howTo}
              </p>
            )
          )}
        </div>
      </div>
    </motion.li>
  );
}

/* ------------------------------ États d’attente ----------------------------- */

function AnalysisPlaceholder() {
  const reduce = useReducedMotion();
  return (
    <div className="brick flex flex-col items-center px-6 py-12 text-center" role="status">
      <motion.span
        className="flex size-14 items-center justify-center rounded-full bg-night text-blue"
        animate={reduce ? undefined : { scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <IconShield size={26} />
      </motion.span>
      <p className="mt-4 font-display text-lg font-semibold">Analyse en cours…</p>
      <p className="mt-1 max-w-md text-sm text-muted">Le bot lit la configuration de votre serveur (rôles, salons, permissions, réglages). Cela prend quelques secondes.</p>
    </div>
  );
}

function AuditErrorNotice({ error, inviteUrl, guildId, onRetry, running }: { error: ApiError; inviteUrl: string | null; guildId: string; onRetry: () => void; running: boolean }) {
  if (error.code === "bot_missing") {
    return (
      <Notice tone="warning" title="Le bot n’est pas sur ce serveur">
        <p>Pour analyser la configuration, le bot Make Your Server doit être présent sur le serveur. Invitez-le, puis relancez l’analyse.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {inviteUrl && (
            <ButtonLink href={inviteUrl} size="sm" target="_blank" rel="noreferrer">
              Inviter le bot
            </ButtonLink>
          )}
          <Button variant="secondary" size="sm" onClick={onRetry} disabled={running}>
            {running ? "Analyse en cours…" : "Relancer l’analyse"}
          </Button>
        </div>
      </Notice>
    );
  }
  if (error.code === "unauthenticated") {
    return (
      <Notice tone="warning" title="Session expirée">
        <a href={`/api/auth/login?suivant=/serveurs/${guildId}/sante`} className="font-semibold underline">
          Reconnectez-vous avec Discord
        </a>{" "}
        pour lancer l’analyse.
      </Notice>
    );
  }
  return (
    <Notice tone={error.code === "forbidden" ? "warning" : "danger"} title={error.code === "forbidden" ? "Accès refusé" : "L’analyse n’a pas pu aboutir"}>
      <p>{error.message}</p>
      {error.code !== "forbidden" && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry} disabled={running}>
          {running ? "Analyse en cours…" : "Réessayer"}
        </Button>
      )}
    </Notice>
  );
}
