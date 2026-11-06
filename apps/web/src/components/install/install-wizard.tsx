"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MODE_LABELS, type ConflictResolution, type InstallMode, type Plan, type PlanOp, type ServerSpec } from "@mys/core";
import { BeforeAfter } from "../landing/before-after";
import { RoleList, type TreeCategory } from "../server-tree";
import { Badge, Button, HelpLink, Notice, buttonClass, cx } from "../ui";
import { Term } from "../help/term";
import { IconAlert, IconArchive, IconArrowRight, IconBot, IconCheck, IconInfo, IconShield, IconTrash } from "../icons";

interface Guild {
  id: string;
  name: string;
  iconUrl: string | null;
  owner: boolean;
  botPresent: boolean;
  sandbox?: boolean;
  inviteUrl: string | null;
  inviteUrlMinimal: string | null;
}

export type InstallSource =
  | { kind: "project"; id: string; name: string; spec: ServerSpec }
  | { kind: "backup"; id: string; name: string; guildId: string; guildName: string; messageChannels: Array<{ id: string; name: string; count: number }>; premium: boolean };

type Step = "server" | "mode" | "plan";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? "Erreur inattendue."), { code: data.code, status: res.status });
  return data as T;
}

export function InstallWizard({ source, validationErrors = [], sandbox }: { source: InstallSource; validationErrors?: string[]; sandbox?: boolean }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>(source.kind === "backup" ? "mode" : "server");
  const [guild, setGuild] = useState<Guild | null>(source.kind === "backup" ? { id: source.guildId, name: source.guildName, iconUrl: null, owner: false, botPresent: true, inviteUrl: null, inviteUrlMinimal: null } : null);
  const [mode, setMode] = useState<InstallMode>("merge");
  const [existingChannels, setExistingChannels] = useState<"keep" | "archive" | "delete">("keep");
  const [existingRoles, setExistingRoles] = useState<"keep" | "delete">("keep");
  const [selected, setSelected] = useState<string[]>([]);
  const [dryRun, setDryRun] = useState(false);
  const [includeMessages, setIncludeMessages] = useState(true);
  const [republish, setRepublish] = useState<string[]>([]);

  const steps: Array<[Step, string]> = source.kind === "backup" ? [["mode", "Choisir les options"], ["plan", "Vérifier et lancer"]] : [["server", "Choisir le serveur"], ["mode", "Choisir le mode"], ["plan", "Vérifier et lancer"]];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{source.kind === "backup" ? "Restauration" : "Installation"}</p>
          <h1 className="mt-1 text-3xl font-bold">{source.kind === "backup" ? `Restaurer « ${source.name} »` : `Installer « ${source.name} »`}</h1>
          <p className="mt-2 max-w-2xl text-ink">
            {source.kind === "backup" ? "Deux étapes." : "Trois étapes."} Rien n’est modifié sur Discord avant que vous ayez vu l’<Term id="analyse">analyse</Term> et confirmé.
          </p>
        </div>
        <HelpLink href={source.kind === "backup" ? "/aide#restaurer" : "/aide#modes"} />
      </div>
      {sandbox && <Notice tone="warning" className="mt-4" title="Mode bac à sable">Ce site tourne avec un serveur Discord simulé (DISCORD_SANDBOX). Aucune action n’est envoyée à Discord.</Notice>}
      {validationErrors.length > 0 && (
        <Notice tone="danger" className="mt-4" title="Le projet contient des erreurs">
          Corrigez-les dans l’éditeur avant d’installer : {validationErrors.slice(0, 3).join(" · ")}
        </Notice>
      )}
      <ol className="mt-6 flex flex-wrap items-center gap-2" aria-label={source.kind === "backup" ? "Étapes de la restauration" : "Étapes de l’installation"}>
        {steps.map(([k, label], i) => {
          const idx = steps.findIndex(([s]) => s === step);
          const done = i < idx;
          const current = k === step;
          return (
            <li key={k} className="flex items-center gap-2">
              {i > 0 && <span className={cx("h-px w-6 transition-colors duration-500", done || current ? "bg-blue" : "bg-line")} aria-hidden />}
              <span className={cx("relative flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold transition-colors", current ? "border-light text-on-accent" : done ? "border-blue text-light" : "border-line text-muted")} aria-current={current ? "step" : undefined}>
                {current && <motion.span layoutId="wizard-step" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
                <span className="relative flex size-5 items-center justify-center rounded-full font-mono text-xs">{done ? <IconCheck size={13} /> : i + 1}</span>
                <span className="relative">{label}</span>
                <span className="sr-only">{done ? " (terminée)" : current ? " (étape actuelle)" : " (à venir)"}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-8">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={reduce ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -24 }} transition={{ duration: 0.22, ease: [0.2, 0.9, 0.25, 1] }}>
            {step === "server" && (
              <ServerStep
                onPick={(g) => {
                  setGuild(g);
                  setStep("mode");
                }}
              />
            )}
            {step === "mode" && guild && (
              <ModeStep
                source={source}
                guild={guild}
                mode={mode}
                setMode={setMode}
                existingChannels={existingChannels}
                setExistingChannels={setExistingChannels}
                existingRoles={existingRoles}
                setExistingRoles={setExistingRoles}
                selected={selected}
                setSelected={setSelected}
                dryRun={dryRun}
                setDryRun={setDryRun}
                includeMessages={includeMessages}
                setIncludeMessages={setIncludeMessages}
                republish={republish}
                setRepublish={setRepublish}
                onBack={source.kind === "project" ? () => setStep("server") : undefined}
                onNext={() => setStep("plan")}
              />
            )}
            {step === "plan" && guild && (
              <PlanStep
                source={source}
                guild={guild}
                options={{ mode, existingChannels: mode === "targeted" ? "keep" : existingChannels, existingRoles: mode === "targeted" ? "keep" : existingRoles, selected: mode === "targeted" ? selected : undefined, includeMessages, republishChannelIds: republish }}
                dryRun={dryRun}
                onBack={() => setStep("mode")}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ------------------------------ Choix du serveur ----------------------------- */

function ServerStep({ onPick }: { onPick: (g: Guild) => void }) {
  const [guilds, setGuilds] = useState<Guild[] | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const data = await api<{ guilds: Guild[]; needsReauth: boolean }>(`/api/guilds${force ? "?rafraichir=1" : ""}`);
      setGuilds(data.guilds);
      setNeedsReauth(data.needsReauth);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Sur quel serveur installer ?</h2>
          <Button variant="secondary" size="sm" onClick={() => load(true)} disabled={loading}>
            {loading ? "Actualisation…" : "Actualiser"}
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted">
          Seuls les serveurs où vous avez la permission <Term id="gerer-serveur">« Gérer le serveur »</Term> apparaissent. Le <Term id="bot">bot</Term> doit être présent sur le serveur choisi.
        </p>
        {error && <Notice tone="danger" className="mt-4">{error}</Notice>}
        {needsReauth && (
          <Notice tone="warning" className="mt-4" title="Reconnexion nécessaire">
            Votre autorisation Discord a expiré. <a className="font-semibold underline" href="/api/auth/login?suivant=/projets">Se reconnecter</a>
          </Notice>
        )}
        <ul className="mt-4 space-y-2">
          {guilds?.map((g) => (
            <li key={g.id} className="panel flex flex-wrap items-center gap-3 p-3">
              {g.iconUrl ? <Image src={g.iconUrl} alt="" width={40} height={40} className="rounded-xl" /> : <span className="flex size-10 items-center justify-center rounded-xl bg-night font-display font-bold text-light">{g.name.slice(0, 1)}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{g.name}</p>
                <p className="text-xs text-muted">
                  {g.owner ? "Vous êtes propriétaire" : "Vous êtes gestionnaire"} · {g.botPresent ? <span className="text-success">bot présent</span> : <span className="text-warning">bot pas encore invité</span>}
                </p>
              </div>
              {g.botPresent ? (
                <Button size="sm" onClick={() => onPick(g)}>
                  Choisir <IconArrowRight size={14} />
                </Button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {g.inviteUrl && (
                    <a href={g.inviteUrl} target="_blank" rel="noreferrer" className={buttonClass("primary", "sm")}>
                      <IconBot size={15} /> Inviter le bot
                      <span className="sr-only"> sur {g.name} (ouvre Discord dans un nouvel onglet)</span>
                    </a>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => load(true)} disabled={loading}>
                    J’ai invité le bot
                  </Button>
                </div>
              )}
            </li>
          ))}
          {guilds?.length === 0 && !needsReauth && <li className="panel p-6 text-center text-sm text-muted">Aucun serveur où vous avez les droits de gestion. Créez-en un (voir à droite), puis actualisez.</li>}
          {!guilds && !error && (
            <li className="panel h-16 animate-pulse">
              <span className="sr-only">Chargement de vos serveurs…</span>
            </li>
          )}
        </ul>
      </div>
      <aside className="space-y-4">
        <div className="brick p-5">
          <h3 className="font-display font-semibold">Pas encore de serveur ?</h3>
          <p className="mt-1 text-sm text-muted">Discord ne permet plus aux bots de créer un serveur. C’est vous qui le créez, en 30 secondes :</p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
            <li>Dans Discord, cliquez sur le <strong>+</strong> en bas de la liste des serveurs.</li>
            <li>Choisissez « Créer le mien », puis « Pour moi et mes amis ».</li>
            <li>Donnez-lui un nom et validez.</li>
            <li>Revenez ici et cliquez sur « Actualiser ».</li>
          </ol>
          <p className="mt-3 text-xs text-muted">Un serveur tout neuf est idéal : à l’étape suivante, choisissez le mode « Serveur vide ».</p>
        </div>
        <div className="panel p-5 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <IconShield size={16} /> Quelles permissions pour le bot ?
          </p>
          <p className="mt-2 text-muted">
            Le lien d’invitation demande la permission <Term id="administrateur">Administrateur</Term>. Pourquoi ? Discord interdit à un bot de donner un droit qu’il n’a pas, et seul un administrateur peut activer la <Term id="communaute">Communauté</Term>.
          </p>
          <p className="mt-2 text-muted">Après l’installation, vous pourrez la lui retirer : les boutons du serveur continueront de fonctionner avec « Gérer les rôles ».</p>
          {guilds?.find((g) => !g.botPresent)?.inviteUrlMinimal && (
            <p className="mt-2 text-muted">
              Préférez des permissions limitées ?{" "}
              <a className="font-semibold text-fg underline" href={guilds.find((g) => !g.botPresent)!.inviteUrlMinimal!} target="_blank" rel="noreferrer">
                Invitation minimale
                <span className="sr-only"> (nouvel onglet)</span>
              </a>{" "}
              (l’analyse vous dira ce qui manque).
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ---------------------------------- Mode ---------------------------------- */

const RECOMMENDED: Partial<Record<InstallMode, string>> = { empty: "Idéal pour un serveur tout neuf", merge: "Idéal pour un serveur déjà utilisé" };

function ModeStep(p: {
  source: InstallSource;
  guild: Guild;
  mode: InstallMode;
  setMode: (m: InstallMode) => void;
  existingChannels: "keep" | "archive" | "delete";
  setExistingChannels: (v: "keep" | "archive" | "delete") => void;
  existingRoles: "keep" | "delete";
  setExistingRoles: (v: "keep" | "delete") => void;
  selected: string[];
  setSelected: (v: string[]) => void;
  dryRun: boolean;
  setDryRun: (v: boolean) => void;
  includeMessages: boolean;
  setIncludeMessages: (v: boolean) => void;
  republish: string[];
  setRepublish: (v: string[]) => void;
  onBack?: () => void;
  onNext: () => void;
}) {
  const modes: Array<[InstallMode, string, string]> =
    p.source.kind === "backup"
      ? [
          ["merge", "Restaurer l’ensemble", "Ce qui existe encore reprend ses réglages sauvegardés. Ce qui a disparu est recréé. Rien n’est supprimé."],
          ["targeted", "Restauration sélective (Premium)", "Vous choisissez précisément les salons, catégories et rôles à restaurer."],
        ]
      : [
          ["empty", MODE_LABELS.empty, "Si un salon créé par Discord au départ porte le même nom qu’un salon du projet, il est réutilisé et configuré."],
          ["merge", MODE_LABELS.merge, "Votre projet s’ajoute. Tout ce qui existe déjà est conservé tel quel."],
          ["targeted", MODE_LABELS.targeted, "N’installe que les éléments que vous cochez, plus ce dont ils ont besoin pour fonctionner."],
        ];
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted">
        Serveur : <strong className="text-fg">{p.guild.name}</strong>
      </p>
      <fieldset>
        <legend className="text-xl font-bold">{p.source.kind === "backup" ? "Que restaurer ?" : "Comment installer ?"}</legend>
        <p className="mt-1 text-sm text-muted">
          {p.source.kind === "backup" ? (
            <>
              Il faut être <Term id="administrateur">Administrateur</Term> ou propriétaire du serveur pour restaurer. Une <Term id="sauvegarde-securite">sauvegarde de sécurité</Term> est prise juste avant.
            </>
          ) : (
            <>
              Le mode décide de ce qui arrive à ce qui existe déjà sur votre serveur. Serveur neuf : <Term id="mode-serveur-vide">Serveur vide</Term>. Serveur déjà utilisé : <Term id="mode-fusion">Ajout</Term>. Dans tous les cas, rien n’est supprimé sans votre accord.
            </>
          )}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {modes.map(([k, label, desc]) => (
            <label key={k} className={cx("relative cursor-pointer rounded-[16px] border p-4 transition-all duration-300 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-light", p.mode === k ? "-translate-y-0.5 border-light bg-surface shadow-[4px_4px_0_0_rgb(131_168_243/0.35)]" : "border-line bg-surface hover:border-edge")}>
              <input type="radio" name="mode" value={k} checked={p.mode === k} onChange={() => p.setMode(k)} className="sr-only" />
              <span className="flex items-start justify-between gap-2">
                <span className="font-display text-lg font-semibold">{label}</span>
                <span className={cx("flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors", p.mode === k ? "border-light bg-accent text-on-accent" : "border-control")}>{p.mode === k && <IconCheck size={12} />}</span>
              </span>
              {RECOMMENDED[k] && <span className="mt-1 inline-block rounded-md bg-blue/15 px-1.5 py-0.5 text-[11px] font-semibold text-blue-strong">{RECOMMENDED[k]}</span>}
              <span className="mt-1.5 block text-sm text-muted">{desc}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {p.mode === "targeted" && <TargetPicker source={p.source} selected={p.selected} setSelected={p.setSelected} />}

      {p.mode !== "targeted" && p.source.kind === "project" && (
        <details className="group panel p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span>
              <span className="font-semibold">Options avancées</span>
              <span className="block text-sm text-muted">
                Existant : {p.existingChannels === "keep" ? "conservé" : p.existingChannels === "archive" ? "salons archivés" : "salons supprimés"}
                {p.existingRoles === "delete" ? ", rôles supprimés" : ", rôles conservés"} · messages {p.includeMessages ? "publiés" : "non publiés"}
              </span>
            </span>
            <span aria-hidden className="text-sm font-semibold text-light transition-transform group-open:rotate-180">⌄</span>
          </summary>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <fieldset className="panel p-4">
            <legend className="px-1 font-semibold">Salons déjà présents qui ne sont pas dans le projet</legend>
            {(
              [
                ["keep", "Les conserver tels quels", "Recommandé.", <IconShield key="k" size={16} />],
                ["archive", "Les archiver", "Rangés dans « 📦 Archives » et cachés aux membres. Tous les messages sont conservés.", <IconArchive key="a" size={16} />],
                ["delete", "Les supprimer définitivement", "Irréversible : leurs messages sont perdus. Vous devrez retaper le nom du serveur.", <IconTrash key="d" size={16} />],
              ] as const
            ).map(([k, label, hint, icon]) => (
              <label key={k} className="mt-2 flex cursor-pointer gap-3 rounded-lg p-2 hover:bg-mist">
                <input type="radio" name="existing" checked={p.existingChannels === k} onChange={() => p.setExistingChannels(k)} className="mt-1 accent-[var(--color-blue)]" />
                <span className="text-sm">
                  <span className={cx("flex items-center gap-1.5 font-semibold", k === "delete" && "text-danger")}>
                    {icon} {label}
                  </span>
                  <span className="text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className="panel p-4">
            <legend className="px-1 font-semibold">Rôles déjà présents qui ne sont pas dans le projet</legend>
            <label className="mt-2 flex cursor-pointer gap-3 rounded-lg p-2 hover:bg-mist">
              <input type="radio" name="roles" checked={p.existingRoles === "keep"} onChange={() => p.setExistingRoles("keep")} className="mt-1 accent-[var(--color-blue)]" />
              <span className="text-sm">
                <span className="font-semibold">Les conserver</span> <span className="text-muted">— recommandé.</span>
              </span>
            </label>
            <label className="mt-1 flex cursor-pointer gap-3 rounded-lg p-2 hover:bg-mist">
              <input type="radio" name="roles" checked={p.existingRoles === "delete"} onChange={() => p.setExistingRoles("delete")} className="mt-1 accent-[var(--color-blue)]" />
              <span className="text-sm">
                <span className="font-semibold text-danger">Les supprimer</span> <span className="text-muted">— retirés à tous leurs membres. Vous devrez retaper le nom du serveur.</span>
              </span>
            </label>
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={p.includeMessages} onChange={(e) => p.setIncludeMessages(e.target.checked)} className="accent-[var(--color-blue)]" />
              Publier les messages préparés (règlement, accueil…)
            </label>
          </fieldset>
        </div>
        </details>
      )}

      {p.source.kind === "backup" && p.source.messageChannels.length > 0 && (
        <fieldset className="panel p-4">
          <legend className="px-1 font-semibold">Republier des messages exportés {p.source.premium ? "" : "(Premium)"}</legend>
          <p className="text-sm text-muted">
            Les messages sont republiés par un webhook avec le nom et l’avatar de leur auteur et la mention de leur date d’origine. Ce n’est <strong>pas</strong> une restauration à l’identique : identifiants, dates réelles, réactions et fils ne sont pas récupérables.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {p.source.messageChannels.map((c) => (
              <label key={c.id} className={cx("flex items-center gap-2 rounded-md bg-mist px-2 py-1 text-sm", !p.source.kind || (p.source.kind === "backup" && !p.source.premium && "opacity-50"))}>
                <input type="checkbox" disabled={p.source.kind === "backup" && !p.source.premium} checked={p.republish.includes(c.id)} onChange={(e) => p.setRepublish(e.target.checked ? [...p.republish, c.id] : p.republish.filter((x) => x !== c.id))} />#{c.name} ({c.count})
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-dashed border-edge bg-surface/60 p-4 transition-colors hover:border-blue">
        <input type="checkbox" checked={p.dryRun} onChange={(e) => p.setDryRun(e.target.checked)} className="mt-1 accent-[var(--color-blue)]" />
        <span className="text-sm">
          <span className="font-semibold">Faire d’abord une simulation (conseillé la première fois)</span>
          <span className="block text-muted">L’installation est rejouée sur une copie de votre serveur, avec les mêmes contrôles. Rien n’est envoyé à Discord. Vous pourrez ensuite installer pour de vrai.</span>
        </span>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {p.onBack ? (
          <Button variant="ghost" onClick={p.onBack}>
            ← Changer de serveur
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col items-end gap-1">
          <Button onClick={p.onNext} disabled={p.mode === "targeted" && p.selected.length === 0}>
            Analyser le serveur <IconArrowRight size={16} />
          </Button>
          <p className="text-xs text-muted">{p.mode === "targeted" && p.selected.length === 0 ? "Cochez au moins un élément pour continuer." : "L’analyse lit votre serveur sans rien modifier."}</p>
        </div>
      </div>
    </div>
  );
}

function TargetPicker({ source, selected, setSelected }: { source: InstallSource; selected: string[]; setSelected: (v: string[]) => void }) {
  if (source.kind === "backup" && !source.premium) return <Notice tone="warning">La restauration sélective est réservée au Premium.</Notice>;
  if (source.kind !== "project") return <Notice tone="blue">La sélection fine se fait après l’analyse : seuls les éléments cochés seront appliqués.</Notice>;
  const spec = source.spec;
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const box = (id: string, label: string) => (
    <label key={id} className="flex items-center gap-2 py-0.5 text-sm">
      <input type="checkbox" className="accent-[var(--color-blue)]" checked={selected.includes(id)} onChange={() => toggle(id)} />
      {label}
    </label>
  );
  return (
    <div className="panel grid gap-6 p-4 md:grid-cols-3">
      <div>
        <p className="label">Salons et catégories</p>
        <div className="max-h-72 overflow-y-auto">
          {spec.categories.map((c) => (
            <div key={c.id} className="mb-2">
              {box(c.id, `▸ ${c.name}`)}
              <div className="pl-5">{c.channels.map((ch) => box(ch.id, ch.name))}</div>
            </div>
          ))}
          {spec.uncategorized.map((ch) => box(ch.id, ch.name))}
        </div>
      </div>
      <div>
        <p className="label">Rôles</p>
        {spec.roles.map((r) => box(r.id, r.name))}
      </div>
      <div>
        <p className="label">Autres éléments</p>
        {box("settings", "Réglages du serveur")}
        {box("onboarding", "Onboarding")}
        {box("welcome", "Écran d’accueil")}
        <p className="label mt-3">Messages</p>
        <div className="max-h-40 overflow-y-auto">{spec.messages.map((m) => box(m.id, m.embeds[0]?.title ?? m.id))}</div>
        <p className="label mt-3">AutoMod</p>
        {spec.automod.map((a) => box(a.id, a.name))}
        <p className="mt-3 text-xs text-muted">Les éléments dont dépend votre sélection (catégorie parente, rôles utilisés dans les permissions…) seront ajoutés automatiquement et signalés.</p>
      </div>
    </div>
  );
}

/* --------------------------------- Analyse --------------------------------- */

const IMPACT: Record<string, { label: string; tone: "success" | "blue" | "warning" | "danger" | "neutral" }> = {
  create: { label: "Création", tone: "success" },
  update: { label: "Modification", tone: "blue" },
  existing: { label: "Modifie l’existant", tone: "warning" },
  archive: { label: "Archivage", tone: "warning" },
  delete: { label: "Suppression", tone: "danger" },
  none: { label: "Sans modification", tone: "neutral" },
};

function PlanStep({ source, guild, options, dryRun, onBack }: { source: InstallSource; guild: Guild; options: Record<string, unknown>; dryRun: boolean; onBack: () => void }) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [installationId, setInstallationId] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, ConflictResolution>>({});
  const [excluded, setExcluded] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [launching, setLaunching] = useState(false);
  const [analysing, setAnalysing] = useState(false);

  const analyse = useCallback(
    async (res: Record<string, ConflictResolution>, replaces?: string | null) => {
      setAnalysing(true);
      setError(null);
      try {
        const data = await api<{ installationId: string; plan: Plan }>("/api/installations", {
          method: "POST",
          body: JSON.stringify({
            guildId: guild.id,
            ...(source.kind === "project" ? { projectId: source.id } : { backupId: source.id }),
            dryRun,
            options: { ...options, resolutions: res },
            replaces: replaces ?? undefined,
          }),
        });
        setPlan(data.plan);
        setInstallationId(data.installationId);
      } catch (e) {
        setError({ message: (e as Error).message, code: (e as { code?: string }).code });
      } finally {
        setAnalysing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guild.id, source.id, dryRun],
  );

  useEffect(() => {
    void analyse({});
  }, [analyse]);

  const activeOps = useMemo(() => plan?.ops.filter((o) => !(o.optional && excluded.includes(o.key))) ?? [], [plan, excluded]);
  const destructive = activeOps.filter((o) => o.destructive);
  const groups = useMemo(() => {
    const g = new Map<string, PlanOp[]>();
    for (const o of plan?.ops ?? []) g.set(o.impact, [...(g.get(o.impact) ?? []), o]);
    return g;
  }, [plan]);

  const launch = async () => {
    if (!installationId) return;
    setLaunching(true);
    setError(null);
    try {
      await api(`/api/installations/${installationId}/confirm`, { method: "POST", body: JSON.stringify({ confirmationText: confirmText, excluded }) });
      router.push(`/installations/${installationId}`);
    } catch (e) {
      setError({ message: (e as Error).message, code: (e as { code?: string }).code });
      setLaunching(false);
    }
  };

  if (!plan) {
    return (
      <div className="panel p-8">
        {error ? (
          <>
            <Notice tone="danger" title="Analyse impossible">
              {error.message}
            </Notice>
            {error.code === "bot_missing" && guild.inviteUrl && (
              <a href={guild.inviteUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block font-semibold underline">
                Inviter le bot sur ce serveur
              </a>
            )}
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={onBack}>
                ← Retour
              </Button>
              <Button variant="secondary" onClick={() => analyse(resolutions)}>
                Réessayer
              </Button>
            </div>
          </>
        ) : (
          <AnalysingState />
        )}
      </div>
    );
  }

  const toTree = (cats: Plan["before"]["categories"]): TreeCategory[] => cats.map((c, i) => ({ key: `${i}-${c.name}`, name: c.name, status: c.status === "kept" ? undefined : c.status, channels: c.channels.map((ch, j) => ({ key: `${i}-${j}-${ch.name}`, name: ch.name, type: ch.type, status: ch.status === "kept" ? undefined : ch.status })) }));

  return (
    <div className={cx("space-y-8", analysing && "pointer-events-none opacity-60")}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Analyse de « {plan.guildName} »</h2>
          <p className="text-sm text-muted">
            {MODE_LABELS[plan.mode]}
            {dryRun && " · simulation"} — rien n’a encore été modifié.
          </p>
        </div>
        <Button variant="ghost" onClick={onBack}>
          ← Modifier les options
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border-2 border-edge bg-night sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Créations", plan.summary.create, "text-success"],
          ["Modifications", plan.summary.update, "text-blue-strong"],
          ["Messages", plan.summary.messages, ""],
          ["Archivages", plan.summary.archive, "text-warning"],
          ["Suppressions", plan.summary.delete, plan.summary.delete ? "text-danger" : ""],
          ["Existant conservé", plan.summary.existingKept, ""],
        ].map(([k, v, cls]) => (
          <div key={k as string} className="bg-surface px-4 py-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className={cx("font-display text-2xl font-bold", cls as string)}>{v}</dd>
          </div>
        ))}
      </dl>

      {plan.blockers.length > 0 && (
        <Notice tone="danger" title="À corriger avant d’installer">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {plan.blockers.map((b, i) => (
              <li key={i}>{b.message}</li>
            ))}
          </ul>
        </Notice>
      )}
      {plan.warnings.length > 0 && (
        <details className="rounded-xl border-l-4 border-warning bg-surface px-4 py-3 text-sm" open={plan.warnings.length <= 4}>
          <summary className="cursor-pointer font-semibold">À savoir ({plan.warnings.length})</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink">
            {plan.warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </details>
      )}

      {plan.conflicts.length > 0 && (
        <section>
          <h3 className="text-lg font-bold">Éléments déjà présents sur le serveur ({plan.conflicts.length})</h3>
          <p className="text-sm text-muted">Ces éléments portent le même nom qu’un élément du projet. Pour chacun, choisissez quoi faire. En mode « Ajout », ils sont réutilisés sans être modifiés, sauf si vous changez ce choix.</p>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {plan.conflicts.map((c) => (
              <li key={c.localId} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <Badge>{c.kind === "role" ? "Rôle" : c.kind === "category" ? "Catégorie" : "Salon"}</Badge>
                <span className="min-w-0 flex-1 truncate">
                  « <strong>{c.existingName}</strong> » existe déjà
                </span>
                <select
                  className="field !w-auto !py-1 text-sm"
                  value={resolutions[c.localId] ?? c.resolution}
                  onChange={(e) => {
                    const next = { ...resolutions, [c.localId]: e.target.value as ConflictResolution };
                    setResolutions(next);
                    void analyse(next, installationId);
                  }}
                  aria-label={`Que faire de ${c.existingName}`}
                >
                  <option value="reuse">Le réutiliser sans le modifier</option>
                  <option value="update">Le réutiliser et le configurer selon le projet</option>
                  <option value="create">Créer un nouvel élément à côté</option>
                </select>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="text-lg font-bold">Avant / après</h3>
        <div className="mt-3">
          <BeforeAfter before={toTree(plan.before.categories)} after={toTree(plan.after.categories)} beforeLabel="Aujourd’hui" afterLabel="Après installation" />
        </div>
        <div className="mt-4">
          <p className="label">Rôles après installation</p>
          <RoleList roles={plan.after.roles.slice(0, 40).map((r, i) => ({ key: `${i}-${r.name}`, name: r.name, color: r.color, status: r.status === "kept" ? undefined : r.status }))} />
        </div>
      </section>

      <section>
        <h3 className="text-lg font-bold">Opérations prévues ({activeOps.length})</h3>
        <p className="text-sm text-muted">Chaque ligne deviendra une étape que vous suivrez en direct. Les lignes avec une case à cocher sont facultatives : décochez-les pour les ignorer.</p>
        <div className="mt-3 space-y-3">
          {["delete", "archive", "existing", "create", "update", "none"].map((impact) => {
            const ops = groups.get(impact);
            if (!ops?.length) return null;
            return (
              <details key={impact} className="panel p-4" open={impact === "delete" || impact === "archive" || impact === "existing" || ops.length <= 12}>
                <summary className="flex cursor-pointer items-center gap-2 font-semibold">
                  <Badge tone={IMPACT[impact]!.tone}>{IMPACT[impact]!.label}</Badge> {ops.length} opération(s)
                </summary>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {ops.map((o) => (
                    <li key={o.key} className="flex items-start gap-2">
                      {o.optional ? (
                        <input type="checkbox" className="mt-1 accent-[var(--color-blue)]" checked={!excluded.includes(o.key)} onChange={(e) => setExcluded(e.target.checked ? excluded.filter((x) => x !== o.key) : [...excluded, o.key])} aria-label={o.label} />
                      ) : (
                        <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-blue" />
                      )}
                      <span>
                        {o.label}
                        {o.details?.length ? <span className="block text-xs text-muted">{o.details.join(" · ")}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      </section>

      {plan.manualSteps.length > 0 && (
        <section className="rounded-xl border-2 border-dashed border-line bg-surface p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <IconInfo size={16} /> Après l’installation, {plan.manualSteps.length} étape(s) à terminer vous-même
          </p>
          <ul className="mt-2 list-disc pl-5 text-muted">
            {plan.manualSteps.map((m) => (
              <li key={m.id}>
                <strong className="text-fg">{m.title}</strong> — {m.why}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-muted">Un assistant avec le contenu prêt à copier s’affichera sur la page de suivi.</p>
        </section>
      )}

      <section className="brick p-5">
        <h3 className="text-lg font-bold">Ce qui va se passer quand vous lancerez</h3>
        <ol className="mt-3 space-y-2 text-sm">
          <li className="flex gap-3">
            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full border border-edge bg-night font-mono text-xs font-bold text-light">1</span>
            <span>
              <IconShield size={15} className="mr-1 inline align-[-2px] text-blue-strong" />
              {dryRun ? (
                "Rien n’est envoyé à Discord : tout se passe sur une copie de votre serveur."
              ) : (
                <>
                  Le bot enregistre une <Term id="sauvegarde-securite">sauvegarde de sécurité</Term> (rôles, salons, permissions, réglages). Elle permet de remettre la structure en place, mais pas les messages d’un salon supprimé.
                </>
              )}
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full border border-edge bg-night font-mono text-xs font-bold text-light">2</span>
            <span>
              Le bot réalise les {activeOps.length} opérations, une par une. Cela prend en général quelques minutes : Discord limite le rythme des actions d’un bot.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full border border-edge bg-night font-mono text-xs font-bold text-light">3</span>
            <span>Vous suivez chaque étape en direct. Vous pouvez fermer la page : {source.kind === "backup" ? "la restauration" : "l’installation"} continue.</span>
          </li>
        </ol>
        {destructive.length > 0 && (
          <div className="mt-4 rounded-xl bg-danger-soft p-4">
            <p className="flex items-center gap-2 font-semibold text-danger">
              <IconAlert size={18} /> {destructive.length} opération(s) destructive(s)
            </p>
            <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-sm text-danger">
              {destructive.map((o) => (
                <li key={o.key}>{o.label}</li>
              ))}
            </ul>
            <label className="mt-3 block text-sm text-fg">
              Pour confirmer, tapez le nom exact du serveur : <strong>{plan.guildName}</strong>
              <input className="field mt-1" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
            </label>
          </div>
        )}
        {error && (
          <Notice tone="danger" className="mt-4">
            {error.message}
          </Notice>
        )}
        {plan.blockers.length > 0 && (
          <p className="mt-4 text-right text-sm font-medium text-danger">Corrigez les points signalés en haut de la page, puis relancez l’analyse.</p>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <Button variant="ghost" onClick={() => analyse(resolutions, installationId)}>
            Relancer l’analyse
          </Button>
          <Button size="lg" onClick={launch} disabled={launching || plan.blockers.length > 0 || (destructive.length > 0 && confirmText.trim() !== plan.guildName.trim())}>
            {launching ? "Lancement…" : dryRun ? "Lancer la simulation" : "Lancer l’installation"} <IconArrowRight size={18} />
          </Button>
        </div>
      </section>
    </div>
  );
}

function AnalysingState() {
  const reduce = useReducedMotion();
  const lines = ["Vérification de vos droits…", "Lecture des salons et rôles existants…", "Contrôle des permissions du bot…", "Calcul des créations et des conflits…"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, lines.length - 1)), 700);
    return () => clearInterval(t);
  }, [lines.length]);
  return (
    <div className="flex flex-col items-center py-6 text-center" aria-live="polite">
      <motion.div aria-hidden className="size-12 rounded-xl border-2 border-edge bg-light" animate={reduce ? undefined : { rotate: [0, 90, 180, 270, 360] }} transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }} />
      <p className="mt-4 font-semibold">{lines[i]}</p>
      <p className="mt-1 text-sm text-muted">L’analyse lit l’état réel du serveur. Rien n’est modifié. Cela prend quelques secondes.</p>
    </div>
  );
}

