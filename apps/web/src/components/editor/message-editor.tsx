"use client";

import { allChannels, type Button as SpecButton, type Embed, type Message } from "@mys/core";
import { Button } from "../ui";
import { IconPlus, IconTrash } from "../icons";
import { ColorInput, Field, Section, Select, TextInput, Toggle } from "./fields";
import { MessagePreview } from "../spec/message-preview";
import type { Editor } from "./state";

const ACTIONS: Array<[SpecButton["action"], string]> = [
  ["role-toggle", "Prendre / retirer un rôle"],
  ["rules-accept", "Accepter le règlement (donne un rôle)"],
  ["ticket-open", "Ouvrir un ticket privé"],
  ["suggestion-open", "Proposer une suggestion"],
  ["link", "Lien vers un site"],
];

/** Édition d’un message préparé : texte, embeds, boutons interactifs (avec vrai comportement côté bot). */
export function MessageEditor({ editor, message }: { editor: Editor; message: Message }) {
  const set = (fn: (m: Message) => void) => editor.edit((d) => fn(d.messages.find((x) => x.id === message.id)!));
  const setEmbed = (i: number, fn: (e: Embed) => void) => set((m) => fn(m.embeds[i]!));
  const selfRoles = editor.spec.roles.filter((r) => r.selfAssignable);
  const channels = allChannels(editor.spec).map((c) => c.channel);

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-[#313338] p-4">
        <MessagePreview message={message} spec={editor.spec} />
      </div>

      <TokenHelp channels={channels.map((c) => [c.id, c.name])} roles={editor.spec.roles.map((r) => [r.id, r.name])} />

      <Section title="Texte (hors embed)">
        <Field label="Contenu" hint="Facultatif. 2 000 caractères maximum.">
          {(id) => <TextInput id={id} multiline value={message.content ?? ""} maxLength={2000} onCommit={(v) => set((m) => (m.content = v || undefined))} />}
        </Field>
        <Toggle checked={message.pin} onChange={(v) => set((m) => (m.pin = v))} label="Épingler ce message" hint="Nécessite la permission « Épingler des messages » pour le bot." />
      </Section>

      {message.embeds.map((e, i) => (
        <Section
          key={i}
          title={`Embed ${i + 1}`}
          actions={
            <Button size="sm" variant="ghost" className="!text-danger" onClick={() => set((m) => m.embeds.splice(i, 1))}>
              <IconTrash size={14} /> Retirer
            </Button>
          }
        >
          <Field label="Titre">{(id) => <TextInput id={id} value={e.title ?? ""} maxLength={256} onCommit={(v) => setEmbed(i, (x) => (x.title = v || undefined))} />}</Field>
          <Field label="Description">{(id) => <TextInput id={id} multiline rows={6} value={e.description ?? ""} maxLength={4096} onCommit={(v) => setEmbed(i, (x) => (x.description = v || undefined))} />}</Field>
          <Field label="Couleur">{() => <ColorInput value={e.color ?? editor.spec.meta.accentColor ?? 0x83a8f3} onChange={(v) => setEmbed(i, (x) => (x.color = v))} />}</Field>
          <div className="space-y-3">
            <p className="label">Rubriques</p>
            {e.fields.map((f, j) => (
              <div key={j} className="rounded-xl border border-line p-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <TextInput value={f.name} maxLength={256} placeholder="Titre de la rubrique" onCommit={(v) => setEmbed(i, (x) => (x.fields[j]!.name = v || "Rubrique"))} />
                  </div>
                  <button type="button" className="text-muted hover:text-danger" onClick={() => setEmbed(i, (x) => x.fields.splice(j, 1))} aria-label="Retirer la rubrique">
                    <IconTrash size={15} />
                  </button>
                </div>
                <div className="mt-2">
                  <TextInput multiline rows={3} value={f.value} maxLength={1024} onCommit={(v) => setEmbed(i, (x) => (x.fields[j]!.value = v || "—"))} />
                </div>
              </div>
            ))}
            {e.fields.length < 25 && (
              <Button size="sm" variant="ghost" onClick={() => setEmbed(i, (x) => x.fields.push({ name: "Nouvelle rubrique", value: "Contenu", inline: false }))}>
                <IconPlus size={14} /> Ajouter une rubrique
              </Button>
            )}
          </div>
          <Field label="Pied de page">{(id) => <TextInput id={id} value={e.footer ?? ""} maxLength={2048} onCommit={(v) => setEmbed(i, (x) => (x.footer = v || undefined))} />}</Field>
        </Section>
      ))}
      {message.embeds.length < 10 && (
        <Button size="sm" variant="secondary" onClick={() => set((m) => m.embeds.push({ title: "Titre", description: "Description", fields: [] }))}>
          <IconPlus size={14} /> Ajouter un embed
        </Button>
      )}

      <Section title={`Boutons (${message.buttons.length}/5)`}>
        <p className="text-sm text-muted">Chaque bouton a un vrai comportement assuré par notre bot. Les rôles proposés doivent être marqués « Les membres peuvent le prendre ».</p>
        {message.buttons.map((b, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
            <Select
              value={b.action}
              options={ACTIONS}
              onChange={(action) =>
                set((m) => {
                  const base = { label: b.label, emoji: b.emoji };
                  m.buttons[i] =
                    action === "link"
                      ? { action, url: "https://", ...base }
                      : action === "role-toggle" || action === "rules-accept"
                        ? { action, roleId: (action === "role-toggle" ? selfRoles[0] : editor.spec.roles.at(-1))?.id ?? "", style: "secondary", ...base }
                        : { action, style: "primary", ...base };
                })
              }
            />
            <div className="flex gap-2">
              <input className="field !w-16 text-center" placeholder="🙂" value={b.emoji ?? ""} maxLength={8} aria-label="Émoji" onChange={(e) => set((m) => (m.buttons[i]!.emoji = e.target.value || undefined))} />
              <input className="field" value={b.label} maxLength={80} aria-label="Libellé du bouton" onChange={(e) => set((m) => (m.buttons[i]!.label = e.target.value || "Bouton"))} />
            </div>
            {(b.action === "role-toggle" || b.action === "rules-accept") && (
              <Select
                value={b.roleId}
                options={(b.action === "role-toggle" ? selfRoles : editor.spec.roles).map((r) => [r.id, r.name] as [string, string])}
                onChange={(v) => set((m) => ((m.buttons[i] as { roleId: string }).roleId = v))}
              />
            )}
            {b.action === "link" && <input className="field" value={b.url} aria-label="Adresse du lien" onChange={(e) => set((m) => ((m.buttons[i] as { url: string }).url = e.target.value))} />}
            {b.action !== "link" && (
              <Select
                value={b.style}
                options={[
                  ["primary", "Bleu"],
                  ["secondary", "Gris"],
                  ["success", "Vert"],
                  ["danger", "Rouge"],
                ]}
                onChange={(v) => set((m) => ((m.buttons[i] as { style: string }).style = v))}
              />
            )}
            <Button size="sm" variant="ghost" className="!text-danger justify-self-start" onClick={() => set((m) => m.buttons.splice(i, 1))}>
              <IconTrash size={14} /> Retirer le bouton
            </Button>
          </div>
        ))}
        {message.buttons.length < 5 && (
          <Button size="sm" variant="secondary" onClick={() => set((m) => m.buttons.push(selfRoles[0] ? { action: "role-toggle", roleId: selfRoles[0].id, label: selfRoles[0].name, style: "secondary" } : { action: "link", url: "https://discord.com", label: "Lien" }))}>
            <IconPlus size={14} /> Ajouter un bouton
          </Button>
        )}
      </Section>
    </div>
  );
}

function TokenHelp({ channels, roles }: { channels: Array<[string, string]>; roles: Array<[string, string]> }) {
  const copy = (t: string) => navigator.clipboard?.writeText(t);
  return (
    <details className="rounded-xl border border-line bg-mist/50 p-3 text-sm">
      <summary className="cursor-pointer font-semibold">Mentionner un salon ou un rôle</summary>
      <p className="mt-2 text-muted">
        Écrivez <code className="rounded bg-surface px-1">{"{#identifiant}"}</code> pour un salon et <code className="rounded bg-surface px-1">{"{@identifiant}"}</code> pour un rôle : ils deviendront de vraies mentions à l’installation, et restent corrects si vous renommez. <code className="rounded bg-surface px-1">{"{server}"}</code> affiche le nom du serveur. Cliquez pour copier :
      </p>
      <div className="mt-2 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
        {channels.map(([id, name]) => (
          <button key={id} type="button" onClick={() => copy(`{#${id}}`)} className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs hover:bg-light">
            #{name}
          </button>
        ))}
        {roles.map(([id, name]) => (
          <button key={id} type="button" onClick={() => copy(`{@${id}}`)} className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs hover:bg-light">
            @{name}
          </button>
        ))}
      </div>
    </details>
  );
}
