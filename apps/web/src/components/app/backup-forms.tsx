"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Notice } from "../ui";

interface GuildOpt {
  id: string;
  name: string;
  botPresent: boolean;
}

async function call(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Action impossible.");
  return data;
}

function useGuilds(initial?: string) {
  const [guilds, setGuilds] = useState<GuildOpt[]>([]);
  const [guildId, setGuildId] = useState(initial ?? "");
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    fetch("/api/guilds")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.guilds ?? []).filter((g: GuildOpt) => g.botPresent);
        setGuilds(list);
        if (!initial && list[0]) setGuildId(list[0].id);
      })
      .catch(() => setGuilds([]));
  }, [initial]);
  useEffect(() => {
    if (!guildId) return;
    fetch(`/api/guilds/${guildId}`)
      .then((r) => r.json())
      .then((d) => setChannels(d.textChannels ?? []))
      .catch(() => setChannels([]));
  }, [guildId]);
  return { guilds, guildId, setGuildId, channels };
}

export function CreateBackupForm({ maxMessageChannels, initialGuild }: { maxMessageChannels: number; initialGuild?: string }) {
  const router = useRouter();
  const { guilds, guildId, setGuildId, channels } = useGuilds(initialGuild);
  const [label, setLabel] = useState("");
  const [msgChannels, setMsgChannels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!guilds.length) return <p className="text-sm text-muted">Invitez d’abord le bot sur un de vos serveurs (page Serveurs).</p>;
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const d = await call("/api/backups", { method: "POST", body: JSON.stringify({ guildId, label: label || undefined, messageChannelIds: msgChannels.length ? msgChannels : undefined }) });
          router.push(`/sauvegardes/${d.backup.id}`);
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Serveur</span>
          <select className="field" value={guildId} onChange={(e) => setGuildId(e.target.value)}>
            {guilds.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Nom (facultatif)</span>
          <input className="field" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="Avant la refonte de septembre" />
        </label>
      </div>
      <fieldset>
        <legend className="label">Exporter les derniers messages de certains salons {maxMessageChannels ? `(Premium, ${maxMessageChannels} max)` : "(Premium)"}</legend>
        {maxMessageChannels === 0 ? (
          <p className="text-xs text-muted">Disponible avec le Premium.</p>
        ) : (
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
            {channels.map((c) => (
              <label key={c.id} className="flex items-center gap-1.5 rounded-md bg-mist px-2 py-1 text-xs">
                <input type="checkbox" checked={msgChannels.includes(c.id)} disabled={!msgChannels.includes(c.id) && msgChannels.length >= maxMessageChannels} onChange={(e) => setMsgChannels(e.target.checked ? [...msgChannels, c.id] : msgChannels.filter((x) => x !== c.id))} />#{c.name}
              </label>
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-muted">Le contenu des messages n’est lisible que si l’application dispose de l’intention « Message Content » ; sinon seuls les messages du bot et ceux qui le mentionnent sont complets.</p>
      </fieldset>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" disabled={busy || !guildId}>
        {busy ? "Sauvegarde en cours…" : "Sauvegarder maintenant"}
      </Button>
    </form>
  );
}

export function ScheduleForm({ minHours, maxMessageChannels }: { minHours: number; maxMessageChannels: number }) {
  const router = useRouter();
  const { guilds, guildId, setGuildId } = useGuilds();
  const [hours, setHours] = useState(Math.max(24, minHours));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!guilds.length) return null;
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await call("/api/schedules", { method: "POST", body: JSON.stringify({ guildId, intervalHours: hours, messageChannelIds: [] }) });
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        <span className="label">Serveur</span>
        <select className="field" value={guildId} onChange={(e) => setGuildId(e.target.value)}>
          {guilds.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">Fréquence</span>
        <select className="field" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
          {[6, 12, 24, 48, 168].filter((h) => h >= minHours).map((h) => (
            <option key={h} value={h}>
              {h === 168 ? "Chaque semaine" : h === 24 ? "Chaque jour" : h === 48 ? "Tous les 2 jours" : `Toutes les ${h} h`}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="secondary" disabled={busy}>
        Programmer
      </Button>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
      <span className="hidden">{maxMessageChannels}</span>
    </form>
  );
}

export function RenameBackup({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [v, setV] = useState(label);
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        await call(`/api/backups/${id}`, { method: "PATCH", body: JSON.stringify({ label: v }) }).catch(() => {});
        router.refresh();
      }}
    >
      <input className="field" value={v} maxLength={80} onChange={(e) => setV(e.target.value)} aria-label="Nom de la sauvegarde" />
      <Button type="submit" size="sm" variant="secondary">
        Renommer
      </Button>
    </form>
  );
}
