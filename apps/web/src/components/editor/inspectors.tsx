"use client";

import { CHANNEL_PURPOSES, findCategory, findChannel, normalizeChannelName, removeChannel, removeRole, uniqueId, type Channel, type ChannelPurpose, type Role, type ServerSpec } from "@mys/core";
import { Button } from "../ui";
import { IconPlus, IconTrash } from "../icons";
import { ColorInput, Field, NumberInput, Section, Select, TextInput, Toggle } from "./fields";
import { OverwriteEditor, RolePermissions } from "./permission-editor";
import { MessageEditor } from "./message-editor";
import type { Editor, Selection } from "./state";

const PURPOSE_LABELS: Record<ChannelPurpose, string> = {
  rules: "Règlement",
  welcome: "Accueil",
  announcements: "Annonces",
  updates: "Mises à jour de Discord (staff)",
  info: "Informations",
  faq: "FAQ",
  roles: "Choix des rôles",
  introductions: "Présentations",
  general: "Discussion générale",
  events: "Événements",
  suggestions: "Suggestions",
  support: "Aide / tickets",
  logs: "Logs",
  "mod-logs": "Logs de modération",
  staff: "Staff",
  afk: "AFK",
  media: "Médias",
};

const TYPE_LABELS: Array<[Channel["type"], string]> = [
  ["text", "Textuel"],
  ["announcement", "Annonces (Communauté)"],
  ["forum", "Forum"],
  ["voice", "Vocal"],
  ["stage", "Conférence (Communauté)"],
];

function Confirm({ label, onConfirm, detail }: { label: string; onConfirm: () => void; detail: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="!text-danger"
      onClick={() => {
        if (window.confirm(detail)) onConfirm();
      }}
    >
      <IconTrash size={15} /> {label}
    </Button>
  );
}

export function CategoryInspector({ editor, id, onSelect }: { editor: Editor; id: string; onSelect: (s: Selection) => void }) {
  const cat = findCategory(editor.spec, id);
  if (!cat) return <Gone />;
  const set = (fn: (c: NonNullable<ReturnType<typeof findCategory>>) => void) => editor.edit((d) => fn(findCategory(d, id)!));
  return (
    <div className="space-y-6">
      <Header kind="Catégorie" title={cat.name} actions={<Confirm label="Supprimer" detail={`Supprimer la catégorie « ${cat.name} » et ses ${cat.channels.length} salons du projet ? (Rien n’est supprimé sur Discord tant que vous n’installez pas.)`} onConfirm={() => { editor.replace(removeChannel(editor.spec, id)); onSelect(null); }} />} />
      <Section title="Général">
        <Field label="Nom de la catégorie">{(fid) => <TextInput id={fid} value={cat.name} maxLength={100} onCommit={(v) => set((c) => (c.name = v || "Catégorie"))} />}</Field>
      </Section>
      <Section title="Permissions de la catégorie">
        <p className="text-sm text-muted">Les salons « synchronisés » héritent de ces permissions.</p>
        <OverwriteEditor overwrites={cat.overwrites} roles={editor.spec.roles} kind="category" onChange={(ows) => set((c) => (c.overwrites = ows))} />
      </Section>
    </div>
  );
}

export function ChannelInspector({ editor, id, onSelect }: { editor: Editor; id: string; onSelect: (s: Selection) => void }) {
  const found = findChannel(editor.spec, id);
  if (!found) return <Gone />;
  const { channel: ch, category } = found;
  const set = (fn: (c: Channel) => void) => editor.edit((d) => fn(findChannel(d, id)!.channel));
  const messages = editor.spec.messages.filter((m) => m.channelId === id);
  const textual = ch.type === "text" || ch.type === "announcement";
  const voice = ch.type === "voice" || ch.type === "stage";
  const addMessage = () => {
    const mid = uniqueId(editor.spec, `msg-${ch.id}`);
    editor.edit((d) => d.messages.push({ id: mid, channelId: id, embeds: [{ title: "Nouveau message", description: "Rédigez votre message ici.", fields: [] }], buttons: [], pin: false }));
    onSelect({ kind: "message", id: mid });
  };
  return (
    <div className="space-y-6">
      <Header
        kind="Salon"
        title={normalizeChannelName(ch.type, ch.name)}
        actions={<Confirm label="Supprimer" detail={`Supprimer « ${ch.name} » du projet ? Ses messages préparés et les références qui le visent seront retirés.`} onConfirm={() => { editor.replace(removeChannel(editor.spec, id)); onSelect(null); }} />}
      />
      <Section title="Général">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom" hint={textual ? `Discord l’affichera : ${normalizeChannelName(ch.type, ch.name)}` : undefined}>
            {(fid) => <TextInput id={fid} value={ch.name} maxLength={100} onCommit={(v) => set((c) => (c.name = v || "salon"))} />}
          </Field>
          <Field label="Type">{(fid) => <Select id={fid} value={ch.type} options={TYPE_LABELS} onChange={(v) => set((c) => (c.type = v))} />}</Field>
        </div>
        {!voice && (
          <Field label={ch.type === "forum" ? "Consignes du forum" : "Description (sujet)"}>{(fid) => <TextInput id={fid} multiline rows={2} value={ch.topic ?? ""} maxLength={1024} onCommit={(v) => set((c) => (c.topic = v || undefined))} />}</Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {(ch.type === "text" || ch.type === "forum") && <Field label="Mode lent" hint="0 = désactivé">{(fid) => <NumberInput id={fid} value={ch.slowmode} min={0} max={21600} suffix="secondes" onCommit={(v) => set((c) => (c.slowmode = v))} />}</Field>}
          {voice && <Field label="Limite de personnes" hint="0 = illimité">{(fid) => <NumberInput id={fid} value={ch.userLimit ?? 0} min={0} max={99} onCommit={(v) => set((c) => (c.userLimit = v || undefined))} />}</Field>}
          <Field label="Rôle du salon" hint="Aide les vérifications et l’IA à comprendre votre structure.">
            {(fid) => <Select id={fid} value={(ch.purpose ?? "") as ChannelPurpose} options={[["" as ChannelPurpose, "—"], ...CHANNEL_PURPOSES.map((p) => [p, PURPOSE_LABELS[p]] as [ChannelPurpose, string])]} onChange={(v) => set((c) => (c.purpose = v || undefined))} />}
          </Field>
        </div>
        {!voice && <Toggle checked={ch.nsfw} onChange={(v) => set((c) => (c.nsfw = v))} label="Réservé aux adultes (NSFW)" />}
      </Section>

      {ch.type === "forum" && (
        <Section title="Tags du forum">
          <TagEditor tags={ch.forumTags ?? []} onChange={(tags) => set((c) => (c.forumTags = tags))} />
        </Section>
      )}

      <Section title="Permissions">
        {category && (
          <Toggle
            checked={ch.syncPermissions}
            onChange={(v) =>
              set((c) => {
                c.syncPermissions = v;
                if (!v && c.overwrites.length === 0) c.overwrites = structuredClone(category.overwrites);
              })
            }
            label={`Synchroniser avec la catégorie « ${category.name} »`}
            hint="Désactivez pour définir des permissions propres à ce salon."
          />
        )}
        {(!ch.syncPermissions || !category) && <OverwriteEditor overwrites={ch.overwrites} roles={editor.spec.roles} kind={ch.type} onChange={(ows) => set((c) => (c.overwrites = ows))} />}
      </Section>

      {textual && (
        <Section
          title={`Messages préparés (${messages.length})`}
          actions={
            <Button size="sm" variant="secondary" onClick={addMessage}>
              <IconPlus size={14} /> Message
            </Button>
          }
        >
          {messages.length === 0 && <p className="text-sm text-muted">Aucun message : le salon démarrera vide.</p>}
          <ul className="space-y-1">
            {messages.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onSelect({ kind: "message", id: m.id })} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-left text-sm hover:border-night">
                  <span className="font-medium">{m.embeds[0]?.title ?? m.content?.slice(0, 60) ?? m.id}</span>
                  <span className="ml-2 text-xs text-muted">
                    {m.buttons.length ? `${m.buttons.length} bouton(s)` : ""} {m.pin ? "· épinglé" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function TagEditor({ tags, onChange }: { tags: NonNullable<Channel["forumTags"]>; onChange: (t: NonNullable<Channel["forumTags"]>) => void }) {
  return (
    <div className="space-y-2">
      {tags.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className="field !w-16 text-center" value={t.emoji ?? ""} maxLength={8} placeholder="🙂" aria-label="Émoji du tag" onChange={(e) => onChange(tags.map((x, j) => (j === i ? { ...x, emoji: e.target.value || undefined } : x)))} />
          <input className="field" value={t.name} maxLength={20} aria-label="Nom du tag" onChange={(e) => onChange(tags.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <label className="flex shrink-0 items-center gap-1 text-xs">
            <input type="checkbox" checked={t.moderated} onChange={(e) => onChange(tags.map((x, j) => (j === i ? { ...x, moderated: e.target.checked } : x)))} /> staff
          </label>
          <button type="button" onClick={() => onChange(tags.filter((_, j) => j !== i))} className="text-muted hover:text-danger" aria-label="Retirer le tag">
            <IconTrash size={15} />
          </button>
        </div>
      ))}
      {tags.length < 20 && (
        <Button size="sm" variant="ghost" onClick={() => onChange([...tags, { name: "Nouveau tag", moderated: false }])}>
          <IconPlus size={14} /> Ajouter un tag
        </Button>
      )}
    </div>
  );
}

export function RoleInspector({ editor, id, onSelect }: { editor: Editor; id: string; onSelect: (s: Selection) => void }) {
  const role = editor.spec.roles.find((r) => r.id === id);
  if (!role) return <Gone />;
  const set = (fn: (r: Role) => void) => editor.edit((d) => fn(d.roles.find((r) => r.id === id)!));
  const usages = countRoleUsages(editor.spec, id);
  return (
    <div className="space-y-6">
      <Header kind="Rôle" title={role.name} actions={<Confirm label="Supprimer" detail={`Supprimer le rôle « ${role.name} » ? Il est utilisé à ${usages} endroit(s) (permissions, boutons, onboarding…) : ces références seront retirées proprement.`} onConfirm={() => { editor.replace(removeRole(editor.spec, id)); onSelect(null); }} />} />
      <Section title="Apparence">
        <Field label="Nom">{(fid) => <TextInput id={fid} value={role.name} maxLength={100} onCommit={(v) => set((r) => (r.name = v || "Rôle"))} />}</Field>
        <Field label="Couleur">{() => <ColorInput value={role.color} onChange={(v) => set((r) => (r.color = v))} />}</Field>
        <Field label="Description (pour vous et l’équipe)">{(fid) => <TextInput id={fid} multiline rows={2} value={role.description ?? ""} maxLength={300} onCommit={(v) => set((r) => (r.description = v || undefined))} />}</Field>
        <div className="grid gap-1 sm:grid-cols-2">
          <Toggle checked={role.hoist} onChange={(v) => set((r) => (r.hoist = v))} label="Afficher séparément" hint="Les membres apparaissent sous ce rôle dans la liste." />
          <Toggle checked={role.mentionable} onChange={(v) => set((r) => (r.mentionable = v))} label="Mentionnable par tous" />
          <Toggle
            checked={role.selfAssignable}
            onChange={(v) => set((r) => { r.selfAssignable = v; if (v) r.permissions = r.permissions.filter((p) => !["KICK_MEMBERS", "BAN_MEMBERS", "MANAGE_CHANNELS", "MANAGE_GUILD", "MANAGE_ROLES", "MANAGE_MESSAGES", "MANAGE_WEBHOOKS", "MENTION_EVERYONE", "MODERATE_MEMBERS", "VIEW_AUDIT_LOG", "MANAGE_NICKNAMES", "MANAGE_THREADS", "MANAGE_EVENTS", "MANAGE_GUILD_EXPRESSIONS", "MUTE_MEMBERS", "DEAFEN_MEMBERS", "MOVE_MEMBERS"].includes(p)); })}
            label="Les membres peuvent le prendre"
            hint="Via un bouton ou l’onboarding."
          />
          <Toggle checked={role.staff} onChange={(v) => set((r) => (r.staff = v))} label="Rôle d’équipe" hint="Utile pour les tickets." />
        </div>
      </Section>
      <Section title="Permissions générales">
        <RolePermissions value={role.permissions} selfAssignable={role.selfAssignable} onChange={(v) => set((r) => (r.permissions = v))} />
      </Section>
      <p className="text-xs text-muted">Utilisé à {usages} endroit(s) dans le projet.</p>
    </div>
  );
}

export function EveryoneInspector({ editor }: { editor: Editor }) {
  return (
    <div className="space-y-6">
      <Header kind="Rôle par défaut" title="@everyone" />
      <p className="text-sm text-muted">Ces permissions s’appliquent à tous les membres, y compris les nouveaux arrivants. Gardez-les simples : les accès particuliers se règlent dans les salons.</p>
      <RolePermissions value={editor.spec.everyone.permissions} selfAssignable onChange={(v) => editor.edit((d) => (d.everyone.permissions = v))} />
    </div>
  );
}

export function MessageInspector({ editor, id, onSelect }: { editor: Editor; id: string; onSelect: (s: Selection) => void }) {
  const m = editor.spec.messages.find((x) => x.id === id);
  if (!m) return <Gone />;
  return (
    <div className="space-y-6">
      <Header
        kind="Message"
        title={m.embeds[0]?.title ?? "Message"}
        back={() => onSelect({ kind: "channel", id: m.channelId })}
        actions={<Confirm label="Supprimer" detail="Supprimer ce message préparé ?" onConfirm={() => { editor.edit((d) => (d.messages = d.messages.filter((x) => x.id !== id))); onSelect({ kind: "channel", id: m.channelId }); }} />}
      />
      <MessageEditor editor={editor} message={m} />
    </div>
  );
}

function countRoleUsages(spec: ServerSpec, id: string) {
  let n = 0;
  const ows = [...spec.categories.flatMap((c) => [...c.overwrites, ...c.channels.flatMap((x) => x.overwrites)]), ...spec.uncategorized.flatMap((x) => x.overwrites)];
  n += ows.filter((o) => o.target === id).length;
  n += spec.messages.reduce((k, m) => k + m.buttons.filter((b) => "roleId" in b && b.roleId === id).length + (JSON.stringify(m).includes(`{@${id}}`) ? 1 : 0), 0);
  n += spec.onboarding?.prompts.reduce((k, p) => k + p.options.filter((o) => o.roleIds.includes(id)).length, 0) ?? 0;
  n += spec.automod.filter((a) => a.exemptRoles.includes(id)).length;
  return n;
}

export function Header({ kind, title, actions, back }: { kind: string; title: string; actions?: React.ReactNode; back?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <button type="button" onClick={back} className="mb-1 text-xs font-semibold text-muted hover:text-night">
            ← Retour au salon
          </button>
        )}
        <p className="eyebrow">{kind}</p>
        <h2 className="truncate text-xl font-bold">{title}</h2>
      </div>
      {actions}
    </div>
  );
}

function Gone() {
  return <p className="text-sm text-muted">Cet élément n’existe plus (il a peut-être été supprimé ou annulé).</p>;
}
