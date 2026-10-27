"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ManualStep } from "@mys/core";
import { StepIcon } from "../step-icon";
import { SuccessBurst } from "./success-burst";
import { Badge, Button, ButtonLink, Notice, cx, formatDate } from "../ui";
import { IconCheck, IconHand } from "../icons";

interface StepView {
  id: string;
  key: string;
  kind: string;
  label: string;
  status: string;
  detail: string | null;
  error: string | null;
  destructive: boolean;
  attempts: number;
}
interface InstView {
  id: string;
  guildId: string;
  guildName: string;
  kind: string;
  status: string;
  dryRun: boolean;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  safetyBackupId: string | null;
  projectId: string | null;
  backupId: string | null;
  manualSteps: ManualStep[];
  cancelRequested: boolean;
}

const TERMINAL = ["succeeded", "partial", "failed", "cancelled"];
const BANNER: Record<string, { title: string; tone: "success" | "warning" | "danger" | "neutral" | "blue"; text: string }> = {
  planned: { title: "En attente de confirmation", tone: "neutral", text: "Cette installation n’a pas été lancée." },
  queued: { title: "En file d’attente", tone: "blue", text: "Le bot va démarrer dans quelques secondes. Vous pouvez quitter cette page : l’installation continue." },
  running: { title: "Installation en cours", tone: "blue", text: "Chaque ligne correspond à une opération réellement effectuée par le bot. Vous pouvez quitter cette page." },
  succeeded: { title: "Installation terminée", tone: "success", text: "Toutes les étapes ont réussi." },
  partial: { title: "Installation partielle", tone: "warning", text: "Certaines étapes ont échoué. Ce qui a réussi est en place ; corrigez la cause indiquée puis relancez : seules les étapes en échec seront rejouées, sans doublon." },
  failed: { title: "Installation échouée", tone: "danger", text: "Aucune étape n’a pu aboutir." },
  cancelled: { title: "Installation annulée", tone: "neutral", text: "Les étapes déjà effectuées restent en place ; les suivantes n’ont pas été exécutées." },
};

export function InstallationProgress({ id }: { id: string }) {
  const reduce = useReducedMotion();
  const [data, setData] = useState<{ installation: InstView; steps: StepView[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/installations/${id}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Suivi indisponible.");
      setData(json);
      setError(null);
      if (!TERMINAL.includes(json.installation.status)) timer.current = setTimeout(load, 1500);
    } catch (e) {
      setError((e as Error).message);
      timer.current = setTimeout(load, 5000);
    }
  }, [id]);

  useEffect(() => {
    void load();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  const act = async (action: "cancel" | "retry") => {
    setBusy(true);
    try {
      const res = await fetch(`/api/installations/${id}/${action}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Action impossible.");
      if (timer.current) clearTimeout(timer.current);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!data) return error ? <Notice tone="danger">{error}</Notice> : <div className="panel h-40 animate-pulse" />;
  const { installation: inst, steps } = data;
  const done = steps.filter((s) => s.status === "succeeded" || s.status === "skipped").length;
  const failed = steps.filter((s) => s.status === "failed");
  const banner = BANNER[inst.status] ?? BANNER.running!;
  // Pendant l’exécution : on garde visibles les 4 dernières étapes terminées et tout ce qui reste.
  const cursor = steps.findIndex((x) => x.status === "running" || x.status === "pending");
  const visible = steps.filter((s, i) => (s.status !== "succeeded" && s.status !== "skipped") || cursor === -1 || i >= cursor - 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{inst.kind === "restore" ? "Restauration" : "Installation"} {inst.dryRun && "· simulation"}</p>
          <h1 className="mt-1 text-3xl font-bold">{inst.guildName}</h1>
          <p className="text-sm text-muted">Créée le {formatDate(inst.createdAt)}{inst.finishedAt && ` · terminée le ${formatDate(inst.finishedAt)}`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!TERMINAL.includes(inst.status) && (
            <Button variant="secondary" onClick={() => act("cancel")} disabled={busy || inst.cancelRequested}>
              {inst.cancelRequested ? "Annulation demandée…" : "Annuler"}
            </Button>
          )}
          {(inst.status === "partial" || inst.status === "failed") && (
            <Button onClick={() => act("retry")} disabled={busy}>
              Relancer les étapes en échec
            </Button>
          )}
          {inst.projectId && (
            <ButtonLink href={`/projets/${inst.projectId}`} variant="ghost">
              Ouvrir le projet
            </ButtonLink>
          )}
        </div>
      </div>

      {inst.status === "succeeded" && <SuccessBurst guildId={inst.guildId} dryRun={inst.dryRun} projectId={inst.projectId} kind={inst.kind} />}

      {inst.dryRun && <Notice tone="warning" title="Simulation">Cette exécution a eu lieu sur une copie en mémoire de votre serveur : rien n’a été modifié sur Discord. Relancez sans le mode simulation pour installer réellement.</Notice>}

      <div className="brick p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-display text-lg font-semibold">
            {banner.title}
            <Badge tone={banner.tone === "neutral" ? "neutral" : banner.tone}>{done}/{steps.length} étapes</Badge>
          </p>
          {failed.length > 0 && <Badge tone="danger">{failed.length} en échec</Badge>}
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full border border-line bg-mist" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Progression">
          <motion.div className={cx("h-full", inst.status === "partial" || failed.length ? "bg-warning" : inst.status === "failed" ? "bg-danger" : "bg-blue")} initial={false} animate={{ width: `${steps.length ? (done / steps.length) * 100 : 0}%` }} transition={{ duration: reduce ? 0 : 0.4 }} />
        </div>
        <p className="mt-3 text-sm text-ink">{banner.text}</p>
        {inst.error && <p className="mt-2 text-sm font-medium text-danger">{inst.error}</p>}
        {inst.safetyBackupId && (
          <p className="mt-2 text-sm text-muted">
            Sauvegarde de sécurité prise avant les modifications :{" "}
            <Link href={`/sauvegardes/${inst.safetyBackupId}`} className="font-semibold text-fg underline">
              la consulter
            </Link>
          </p>
        )}
      </div>

      {error && <Notice tone="warning">{error} Nouvelle tentative automatique…</Notice>}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">Étapes</h2>
          <button type="button" className="text-sm font-semibold text-muted underline" onClick={() => setShowDone((v) => !v)}>
            {showDone ? "Masquer les étapes réussies anciennes" : "Afficher toutes les étapes"}
          </button>
        </div>
        <ul className="panel divide-y divide-line">
          <AnimatePresence initial={false}>
            {(showDone || TERMINAL.includes(inst.status) ? steps : visible).map((s) => (
              <motion.li key={s.id} layout={!reduce} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} className={cx("flex gap-3 px-4 py-2.5", s.status === "running" && "bg-light/30")}>
                <StepIcon status={s.status} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className={cx(s.status === "pending" && "text-muted", s.destructive && "text-danger")}>{s.label}</p>
                  {s.detail && s.status !== "failed" && <p className="text-xs text-muted">{s.detail}</p>}
                  {s.error && s.status === "failed" && <p className="text-xs font-medium text-danger">{s.error}</p>}
                  {s.error && s.status === "running" && <p className="text-xs text-warning">Nouvelle tentative : {s.error}</p>}
                </div>
                {s.attempts > 1 && <span className="shrink-0 font-mono text-[10px] text-muted">{s.attempts} essais</span>}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </section>

      {inst.status !== "planned" && inst.manualSteps.length > 0 && TERMINAL.includes(inst.status) && !inst.dryRun && <ManualAssistant steps={inst.manualSteps} />}
    </div>
  );
}

/** Assistant des étapes non automatisables : rien n’est présenté comme déjà configuré. */
function ManualAssistant({ steps }: { steps: ManualStep[] }) {
  const [done, setDone] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <IconHand /> À terminer vous-même ({done.length}/{steps.length})
      </h2>
      <p className="text-sm text-muted">Ces réglages ne sont pas disponibles dans l’API publique de Discord (ou demandent des droits que le bot n’a pas). Ils ne sont donc PAS configurés : voici comment le faire en quelques minutes.</p>
      {steps.map((s) => (
        <details key={s.id} className={cx("panel p-4", done.includes(s.id) && "opacity-70")} open={!done.includes(s.id)}>
          <summary className="flex cursor-pointer items-center gap-2 font-semibold">
            {done.includes(s.id) ? <IconCheck className="text-success" /> : <span className="size-4 rounded border-2 border-line" />} {s.title}
          </summary>
          <p className="mt-2 text-sm text-muted">{s.why}</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
            {s.instructions.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ol>
          {s.content && (
            <ul className="mt-3 space-y-2">
              {s.content.map((c) => (
                <li key={c.label} className="rounded-lg bg-mist p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{c.label}</p>
                    <button
                      type="button"
                      className="rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-semibold"
                      onClick={() => {
                        void navigator.clipboard?.writeText(c.value);
                        setCopied(c.label);
                        setTimeout(() => setCopied(null), 1500);
                      }}
                    >
                      {copied === c.label ? "Copié !" : "Copier"}
                    </button>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-ink">{c.value}</p>
                </li>
              ))}
            </ul>
          )}
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => setDone((d) => (d.includes(s.id) ? d.filter((x) => x !== s.id) : [...d, s.id]))}>
            {done.includes(s.id) ? "Marquer comme à faire" : "C’est fait"}
          </Button>
        </details>
      ))}
    </section>
  );
}
