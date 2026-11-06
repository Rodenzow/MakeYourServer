"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import {
  SCHEDULED_LIMITS,
  SCHEDULED_REPEAT_LABELS,
  SCHEDULED_STATUS_LABELS,
  dateToParisInput,
  formatParisDateTime,
  parisInputToDate,
  type ScheduledRepeat,
} from "@mys/core";
import type { ClientScheduledMessage } from "@/lib/scheduled-messages";
import { Badge, Button, Notice, cx } from "../ui";
import { IconAlert, IconClock, IconHash, IconMegaphone, IconPlus, IconTrash, IconX } from "../icons";
import { ScheduledPreview } from "./scheduled-preview";

interface GuildOpt {
  id: string;
  name: string;
}
interface ChannelOpt {
  id: string;
  name: string;
  announcement: boolean;
  category: string | null;
}

const EASE = [0.2, 0.9, 0.25, 1] as const;
const COLORS = [0x83a8f3, 0x5865f2, 0x57f287, 0xfee75c, 0xeb459e, 0xed4245, 0xf47b20, 0x99aab5];
const STATUS_TONE = { active: "blue", paused: "neutral", done: "success", failed: "danger" } as const;

async function call(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Action impossible.");
  return data;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/** Gestion complète : liste par serveur, création, modification, pause, suppression. */
export function ScheduledMessagesManager({ guilds, messages, used, max, readOnly = false }: { guilds: GuildOpt[]; messages: ClientScheduledMessage[]; used: number; max: number; readOnly?: boolean }) {
  const [editing, setEditing] = useState<ClientScheduledMessage | "new" | null>(!readOnly && messages.length === 0 && guilds.length > 0 ? "new" : null);
  const reduce = useReducedMotion();
  const names = new Map(guilds.map((g) => [g.id, g.name]));
  const byGuild = new Map<string, ClientScheduledMessage[]>();
  for (const m of messages) byGuild.set(m.guildId, [...(byGuild.get(m.guildId) ?? []), m]);

  return (
    <div className="space-y-8">
      {!readOnly && (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <strong className="text-fg">
            {used}/{max}
          </strong>{" "}
          message(s) programmé(s) actif(s) avec votre offre.
        </p>
        {editing === null && (
          <Button onClick={() => setEditing("new")} disabled={!guilds.length}>
            <IconPlus size={16} /> Nouveau message
          </Button>
        )}
      </div>
      )}

      {!readOnly && !guilds.length && (
        <Notice tone="warning" title="Aucun serveur disponible">
          Invitez d’abord le bot Make Your Server sur un serveur que vous gérez (page Serveurs), puis revenez ici.
        </Notice>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {editing !== null && (
          <motion.section
            key={editing === "new" ? "new" : editing.id}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <MessageEditor guilds={guilds} initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
          </motion.section>
        )}
      </AnimatePresence>

      <section aria-labelledby="liste-messages" className="space-y-6">
        <h2 id="liste-messages" className="sr-only">
          Vos messages programmés
        </h2>
        {messages.length === 0 && editing === null && !readOnly && (
          <div className="panel blueprint flex flex-col items-center px-6 py-12 text-center">
            <p className="font-display text-lg font-semibold">Aucun message programmé</p>
            <p className="mt-1 max-w-md text-sm text-muted">Annonce de soirée, rappel hebdomadaire, message de bienvenue du lundi : programmez-le une fois, le bot s’en charge.</p>
          </div>
        )}
        {[...byGuild.entries()].map(([guildId, items]) => (
          <div key={guildId}>
            <h3 className="mb-2 text-lg font-bold">{names.get(guildId) ?? `Serveur ${guildId}`}</h3>
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {items.map((m) => (
                  <motion.li key={m.id} layout={!reduce} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0, height: 0 }}>
                    <MessageRow message={m} editable={!readOnly && names.has(guildId)} onEdit={() => setEditing(m)} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

function MessageRow({ message: m, editable, onEdit }: { message: ClientScheduledMessage; editable: boolean; onEdit: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const summary = m.content.trim() || m.embedTitle || m.embedDescription || "";
  const act = async (url: string, init: RequestInit, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      await call(url, init);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={cx("panel flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center", m.status === "failed" && "border-danger/50")}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[m.status]}>{SCHEDULED_STATUS_LABELS[m.status]}</Badge>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-fg">
            <IconHash size={14} />
            {m.channelName || "salon"}
          </span>
          <span className="text-xs text-muted">· {SCHEDULED_REPEAT_LABELS[m.repeat]}</span>
        </p>
        <p className="mt-1 truncate text-sm text-ink">{summary}</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <IconClock size={13} />
          {m.status === "done" ? (
            <>Envoyé le {formatParisDateTime(m.lastSentAt)} (heure de Paris)</>
          ) : (
            <>
              Prochain envoi : <strong className="text-fg">{formatParisDateTime(m.nextRunAt)}</strong> (heure de Paris)
              {m.lastSentAt && <> · dernier envoi le {formatParisDateTime(m.lastSentAt)}</>}
            </>
          )}
        </p>
        {m.lastError && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-danger">
            <IconAlert size={13} className="mt-px shrink-0" />
            <span>{m.lastError}</span>
          </p>
        )}
        {error && (
          <p role="alert" className="mt-1.5 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {editable && (
          <Button size="sm" variant="secondary" onClick={onEdit} disabled={busy}>
            Modifier
          </Button>
        )}
        {m.status === "active" && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(`/api/scheduled-messages/${m.id}`, { method: "POST", body: JSON.stringify({ action: "pause" }) })}>
            Mettre en pause
          </Button>
        )}
        {editable && (m.status === "paused" || m.status === "failed") && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(`/api/scheduled-messages/${m.id}`, { method: "POST", body: JSON.stringify({ action: "resume" }) })}>
            Reprendre
          </Button>
        )}
        <Button
          size="sm"
          variant="danger"
          disabled={busy}
          aria-label={`Supprimer le message programmé dans #${m.channelName}`}
          onClick={() => act(`/api/scheduled-messages/${m.id}`, { method: "DELETE" }, "Supprimer ce message programmé ? Les messages déjà envoyés restent sur Discord.")}
        >
          <IconTrash size={14} />
        </Button>
      </div>
    </div>
  );
}

function defaultSendAt() {
  // Dans une heure, arrondi au quart d’heure.
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return dateToParisInput(d);
}

function MessageEditor({ guilds, initial, onClose }: { guilds: GuildOpt[]; initial: ClientScheduledMessage | null; onClose: () => void }) {
  const router = useRouter();
  const id = useId();
  const [guildId, setGuildId] = useState(initial?.guildId ?? guilds[0]?.id ?? "");
  const [channels, setChannels] = useState<ChannelOpt[] | null>(null);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState(initial?.channelId ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [withEmbed, setWithEmbed] = useState(!!(initial?.embedTitle || initial?.embedDescription));
  const [embedTitle, setEmbedTitle] = useState(initial?.embedTitle ?? "");
  const [embedDescription, setEmbedDescription] = useState(initial?.embedDescription ?? "");
  const [embedColor, setEmbedColor] = useState<number>(initial?.embedColor ?? COLORS[0]!);
  const [sendAt, setSendAt] = useState(() => (initial?.sendAt && initial.status !== "done" ? initial.sendAt : defaultSendAt()));
  const [repeat, setRepeat] = useState<ScheduledRepeat>(initial?.repeat ?? "none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!guildId) return;
    let cancelled = false;
    setChannels(null);
    setChannelsError(null);
    fetch(`/api/scheduled-messages/channels?guildId=${guildId}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? "Impossible de lire les salons de ce serveur.");
        return d.channels as ChannelOpt[];
      })
      .then((list) => {
        if (cancelled) return;
        setChannels(list);
        setChannelId((cur) => (list.some((c) => c.id === cur) ? cur : (list[0]?.id ?? "")));
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setChannels([]);
        setChannelsError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [guildId]);

  const when = useMemo(() => parisInputToDate(sendAt), [sendAt]);
  const inPast = when ? when.getTime() <= Date.now() : false;
  const channel = channels?.find((c) => c.id === channelId);
  const hasMentions = /@everyone|@here|<@[!&]?\d+>/.test(`${content} ${withEmbed ? `${embedTitle} ${embedDescription}` : ""}`);
  const empty = !content.trim() && !(withEmbed && (embedTitle.trim() || embedDescription.trim()));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        guildId,
        channelId,
        content,
        embedTitle: withEmbed ? embedTitle : null,
        embedDescription: withEmbed ? embedDescription : null,
        embedColor: withEmbed ? embedColor : null,
        sendAt,
        repeat,
      };
      await call(initial ? `/api/scheduled-messages/${initial.id}` : "/api/scheduled-messages", { method: initial ? "PUT" : "POST", body: JSON.stringify(body) });
      onClose();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="brick p-5 md:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">{initial ? "Modifier le message programmé" : "Nouveau message programmé"}</h2>
          <p className="text-sm text-muted">Le bot publiera ce message dans le salon choisi, à l’heure indiquée (heure de Paris).</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer l’éditeur">
          <IconX size={16} />
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form className="space-y-4" onSubmit={submit} aria-describedby={`${id}-help`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Serveur</span>
              <select className="field" value={guildId} onChange={(e) => setGuildId(e.target.value)} required>
                {guilds.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Salon</span>
              <select className="field" value={channelId} onChange={(e) => setChannelId(e.target.value)} required disabled={!channels?.length} aria-busy={channels === null}>
                {channels === null && <option value="">Chargement des salons…</option>}
                {channels?.length === 0 && <option value="">Aucun salon disponible</option>}
                {channels?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.announcement ? "📢 " : "# "}
                    {c.name}
                    {c.category ? ` — ${c.category}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {channelsError && <Notice tone="danger">{channelsError}</Notice>}

          <label className="block">
            <span className="label flex justify-between">
              <span>Texte du message</span>
              <span className={cx("font-mono text-xs", content.length > SCHEDULED_LIMITS.content ? "text-danger" : "text-muted")}>
                {content.length}/{SCHEDULED_LIMITS.content}
              </span>
            </span>
            <textarea
              className="field min-h-32 py-2 leading-relaxed"
              value={content}
              maxLength={SCHEDULED_LIMITS.content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="🎮 Soirée jeux ce soir à 21 h dans le vocal ! **Venez nombreux.**"
            />
            <span className="mt-1 block text-xs text-muted">Mise en forme Discord acceptée : **gras**, *italique*, __souligné__, ~~barré~~, `code`, # titre, &gt; citation.</span>
          </label>

          <div className="rounded-xl border border-line bg-paper/60 p-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="size-4 accent-[var(--color-blue)]" checked={withEmbed} onChange={(e) => setWithEmbed(e.target.checked)} />
              Ajouter un encadré (facultatif)
            </label>
            <AnimatePresence initial={false}>
              {withEmbed && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }} className="overflow-hidden">
                  <div className="space-y-3 pt-3">
                    <label className="block">
                      <span className="label">Titre</span>
                      <input className="field" value={embedTitle} maxLength={SCHEDULED_LIMITS.embedTitle} onChange={(e) => setEmbedTitle(e.target.value)} placeholder="Programme de la semaine" />
                    </label>
                    <label className="block">
                      <span className="label">Description</span>
                      <textarea className="field min-h-24 py-2" value={embedDescription} maxLength={SCHEDULED_LIMITS.embedDescription} onChange={(e) => setEmbedDescription(e.target.value)} placeholder="Lundi : tournoi · Mercredi : quiz · Vendredi : soirée film" />
                    </label>
                    <fieldset>
                      <legend className="label">Couleur</legend>
                      <div className="flex flex-wrap items-center gap-2">
                        {COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEmbedColor(c)}
                            aria-label={`Couleur ${hex(c)}`}
                            aria-pressed={embedColor === c}
                            className={cx("size-7 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-light", embedColor === c ? "border-white" : "border-transparent")}
                            style={{ background: hex(c) }}
                          />
                        ))}
                        <label className="ml-1 inline-flex items-center gap-1.5 text-xs text-muted">
                          <input type="color" value={hex(embedColor)} onChange={(e) => setEmbedColor(parseInt(e.target.value.slice(1), 16))} className="h-7 w-9 cursor-pointer rounded border border-line bg-transparent" />
                          Autre
                        </label>
                      </div>
                    </fieldset>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Date et heure (heure de Paris)</span>
              <input type="datetime-local" className="field" value={sendAt} min={dateToParisInput(new Date())} onChange={(e) => setSendAt(e.target.value)} required suppressHydrationWarning />
              {when && <span className={cx("mt-1 block text-xs", inPast ? "text-danger" : "text-muted")}>{inPast ? "Cette date est passée : choisissez une date future." : formatParisDateTime(when)}</span>}
            </label>
            <fieldset>
              <legend className="label">Répétition</legend>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(SCHEDULED_REPEAT_LABELS) as ScheduledRepeat[]).map((r) => (
                  <label key={r} className={cx("cursor-pointer rounded-lg border px-3 py-2 text-sm font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-light", repeat === r ? "border-light bg-accent text-on-accent" : "border-line text-ink hover:bg-mist")}>
                    <input type="radio" name={`${id}-repeat`} value={r} checked={repeat === r} onChange={() => setRepeat(r)} className="sr-only" />
                    {SCHEDULED_REPEAT_LABELS[r]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <p id={`${id}-help`} className="text-xs text-muted">
            Le bot n’envoie jamais de message privé. Vos droits « Gérer le serveur » sont vérifiés maintenant et de nouveau au moment de chaque envoi.
          </p>
          {hasMentions && (
            <Notice tone="warning" title="Les mentions ne notifieront personne">
              Pour éviter les abus, les messages programmés ne déclenchent aucune notification : @everyone, @here et les mentions de rôles ou de membres s’affichent sans prévenir qui que ce soit.
            </Notice>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || empty || inPast || !channelId}>
              {busy ? "Enregistrement…" : initial ? "Enregistrer les modifications" : "Programmer le message"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </form>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow mb-2 flex items-center gap-1.5">
            {channel?.announcement ? <IconMegaphone size={14} /> : <IconHash size={14} />} Aperçu en direct
          </p>
          <ScheduledPreview
            content={content}
            embedTitle={withEmbed ? embedTitle : null}
            embedDescription={withEmbed ? embedDescription : null}
            embedColor={withEmbed ? embedColor : null}
            channelName={channel?.name ?? initial?.channelName}
            when={when ? formatParisDateTime(when) : null}
          />
          <p className="mt-2 text-xs text-muted">
            {repeat === "none" ? "Envoyé une seule fois." : repeat === "daily" ? "Envoyé chaque jour à la même heure." : "Envoyé chaque semaine, le même jour à la même heure."}
          </p>
        </div>
      </div>
    </div>
  );
}
