"use client";

import { allChannels, uniqueId, type AutoModRule, type ServerSpec, THEME_LABELS, SIZE_LABELS, THEMES, SIZES } from "@mys/core";
import { Button, Notice } from "../ui";
import { IconPlus, IconTrash } from "../icons";
import { Field, NumberInput, Section, Select, TextInput, Toggle, ColorInput } from "./fields";
import { Header } from "./inspectors";
import type { Editor } from "./state";

function channelOptions(spec: ServerSpec, types?: string[]) {
  return [["", "—"] as [string, string], ...allChannels(spec).filter((c) => !types || types.includes(c.channel.type)).map((c) => [c.channel.id, c.channel.name] as [string, string])];
}

export function SettingsPanel({ editor }: { editor: Editor }) {
  const { spec } = editor;
  const s = spec.settings;
  const set = (fn: (d: ServerSpec) => void) => editor.edit(fn);
  return (
    <div className="space-y-6">
      <Header kind="Projet" title="Réglages du serveur" />
      <Section title="Identité du projet">
        <Field label="Nom du serveur">{(id) => <TextInput id={id} value={spec.meta.name} maxLength={100} onCommit={(v) => set((d) => (d.meta.name = v.length >= 2 ? v : d.meta.name))} />}</Field>
        <Field label="Description">{(id) => <TextInput id={id} multiline rows={2} value={spec.meta.description ?? ""} maxLength={500} onCommit={(v) => set((d) => (d.meta.description = v || undefined))} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Thème">{(id) => <Select id={id} value={spec.meta.theme} options={THEMES.map((t) => [t, THEME_LABELS[t]] as [typeof t, string])} onChange={(v) => set((d) => (d.meta.theme = v))} />}</Field>
          <Field label="Taille visée">{(id) => <Select id={id} value={spec.meta.size} options={SIZES.map((t) => [t, SIZE_LABELS[t]] as [typeof t, string])} onChange={(v) => set((d) => (d.meta.size = v))} />}</Field>
        </div>
        <Field label="Couleur des embeds">{() => <ColorInput value={spec.meta.accentColor ?? 0x83a8f3} onChange={(v) => set((d) => (d.meta.accentColor = v))} />}</Field>
      </Section>
      <Section title="Sécurité et notifications (réglages Discord)">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Niveau de vérification" hint="Conditions à remplir pour écrire.">
            {(id) => (
              <Select id={id} value={s.verificationLevel} onChange={(v) => set((d) => (d.settings.verificationLevel = v))} options={[["none", "Aucun"], ["low", "Faible : e-mail vérifié"], ["medium", "Moyen : inscrit depuis 5 min"], ["high", "Élevé : membre depuis 10 min"], ["very_high", "Très élevé : téléphone vérifié"]]} />
            )}
          </Field>
          <Field label="Filtre de contenu multimédia">
            {(id) => <Select id={id} value={s.explicitContentFilter} onChange={(v) => set((d) => (d.settings.explicitContentFilter = v))} options={[["disabled", "Désactivé"], ["members_without_roles", "Membres sans rôle"], ["all_members", "Tous les membres"]]} />}
          </Field>
          <Field label="Notifications par défaut">
            {(id) => <Select id={id} value={s.defaultNotifications} onChange={(v) => set((d) => (d.settings.defaultNotifications = v))} options={[["only_mentions", "Mentions seulement (recommandé)"], ["all_messages", "Tous les messages"]]} />}
          </Field>
          <Field label="Salon des messages système">{(id) => <Select id={id} value={s.systemChannelId ?? ""} options={channelOptions(spec, ["text"])} onChange={(v) => set((d) => (d.settings.systemChannelId = v || undefined))} />}</Field>
          <Field label="Salon AFK">{(id) => <Select id={id} value={s.afkChannelId ?? ""} options={channelOptions(spec, ["voice"])} onChange={(v) => set((d) => (d.settings.afkChannelId = v || undefined))} />}</Field>
          <Field label="Délai avant AFK">
            {(id) => <Select id={id} value={String(s.afkTimeout) as "300"} options={[["60", "1 minute"], ["300", "5 minutes"], ["900", "15 minutes"], ["1800", "30 minutes"], ["3600", "1 heure"]]} onChange={(v) => set((d) => (d.settings.afkTimeout = Number(v) as 300))} />}
          </Field>
        </div>
        <Toggle checked={s.suppressJoinNotifications} onChange={(v) => set((d) => (d.settings.suppressJoinNotifications = v))} label="Masquer les messages d’arrivée de Discord" hint="Conseillé si le bot publie déjà un message de bienvenue." />
        <Toggle checked={s.suppressSetupTips} onChange={(v) => set((d) => (d.settings.suppressSetupTips = v))} label="Masquer les conseils de configuration de Discord" />
      </Section>
      <Section title="Communauté Discord">
        <Toggle checked={s.community} onChange={(v) => set((d) => (d.settings.community = v))} label="Activer la Communauté" hint="Nécessaire pour les salons d’annonces, l’onboarding et l’écran d’accueil. Le bot doit être Administrateur pour l’activer ; sinon un assistant vous guidera." />
        {s.community && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Salon du règlement">{(id) => <Select id={id} value={s.rulesChannelId ?? ""} options={channelOptions(spec, ["text"])} onChange={(v) => set((d) => (d.settings.rulesChannelId = v || undefined))} />}</Field>
            <Field label="Mises à jour de Discord (staff)">{(id) => <Select id={id} value={s.publicUpdatesChannelId ?? ""} options={channelOptions(spec, ["text"])} onChange={(v) => set((d) => (d.settings.publicUpdatesChannelId = v || undefined))} />}</Field>
            <Field label="Alertes de sécurité">{(id) => <Select id={id} value={s.safetyAlertsChannelId ?? ""} options={channelOptions(spec, ["text"])} onChange={(v) => set((d) => (d.settings.safetyAlertsChannelId = v || undefined))} />}</Field>
            <Field label="Description publique">{(id) => <TextInput id={id} value={s.description ?? ""} maxLength={120} onCommit={(v) => set((d) => (d.settings.description = v || undefined))} />}</Field>
          </div>
        )}
      </Section>
    </div>
  );
}

const TRIGGER_LABELS: Record<AutoModRule["trigger"]["type"], string> = {
  keyword: "Mots-clés et expressions",
  spam: "Contenu suspecté de spam",
  keyword_preset: "Listes prédéfinies de Discord",
  mention_spam: "Spam de mentions",
};

export function AutomodPanel({ editor }: { editor: Editor }) {
  const { spec } = editor;
  const set = (id: string, fn: (r: AutoModRule) => void) => editor.edit((d) => fn(d.automod.find((r) => r.id === id)!));
  const has = (t: string) => spec.automod.some((r) => r.trigger.type === t);
  const add = (type: AutoModRule["trigger"]["type"]) => {
    const id = uniqueId(spec, `automod-${type}`);
    const trigger: AutoModRule["trigger"] =
      type === "keyword" ? { type, keywords: ["*mot-interdit*"], regexPatterns: [], allowList: [] } : type === "keyword_preset" ? { type, presets: ["slurs"], allowList: [] } : type === "mention_spam" ? { type, mentionLimit: 6, raidProtection: true } : { type };
    editor.edit((d) => d.automod.push({ id, name: TRIGGER_LABELS[type], enabled: true, trigger, actions: [{ type: "block" }], exemptRoles: [], exemptChannels: [] }));
  };
  return (
    <div className="space-y-6">
      <Header kind="Modération native Discord" title="AutoMod" />
      <Notice tone="blue">AutoMod est appliqué par Discord lui-même, même si notre bot est hors ligne. Discord limite à 6 règles par mots-clés et une règle de chaque autre type.</Notice>
      {spec.automod.map((r) => (
        <Section
          key={r.id}
          title={r.name}
          actions={
            <Button size="sm" variant="ghost" className="!text-danger" onClick={() => editor.edit((d) => (d.automod = d.automod.filter((x) => x.id !== r.id)))}>
              <IconTrash size={14} /> Retirer
            </Button>
          }
        >
          <p className="text-xs text-muted">Type : {TRIGGER_LABELS[r.trigger.type]}</p>
          <Field label="Nom">{(id) => <TextInput id={id} value={r.name} maxLength={100} onCommit={(v) => set(r.id, (x) => (x.name = v || x.name))} />}</Field>
          <Toggle checked={r.enabled} onChange={(v) => set(r.id, (x) => (x.enabled = v))} label="Règle active" />
          {r.trigger.type === "keyword" && (
            <Field label="Mots-clés (un par ligne)" hint="* = joker. Exemple : *arnaque* bloque aussi « arnaques ».">
              {(id) => <TextInput id={id} multiline rows={4} value={r.trigger.type === "keyword" ? r.trigger.keywords.join("\n") : ""} onCommit={(v) => set(r.id, (x) => x.trigger.type === "keyword" && (x.trigger.keywords = v.split("\n").map((k) => k.trim()).filter(Boolean).slice(0, 1000)))} />}
            </Field>
          )}
          {r.trigger.type === "keyword_preset" && (
            <div className="flex flex-wrap gap-3">
              {(["profanity", "sexual_content", "slurs"] as const).map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={r.trigger.type === "keyword_preset" && r.trigger.presets.includes(p)}
                    onChange={(e) =>
                      set(r.id, (x) => {
                        if (x.trigger.type !== "keyword_preset") return;
                        x.trigger.presets = e.target.checked ? [...x.trigger.presets, p] : x.trigger.presets.filter((y) => y !== p);
                        if (!x.trigger.presets.length) x.trigger.presets = [p];
                      })
                    }
                  />
                  {{ profanity: "Grossièretés", sexual_content: "Contenu sexuel", slurs: "Insultes graves" }[p]}
                </label>
              ))}
            </div>
          )}
          {r.trigger.type === "mention_spam" && (
            <Field label="Mentions maximum par message">{(id) => <NumberInput id={id} value={r.trigger.type === "mention_spam" ? r.trigger.mentionLimit : 5} min={1} max={50} onCommit={(v) => set(r.id, (x) => x.trigger.type === "mention_spam" && (x.trigger.mentionLimit = v))} />}</Field>
          )}
          <div className="space-y-2">
            <p className="label">Actions</p>
            <Toggle checked={r.actions.some((a) => a.type === "block")} onChange={(v) => set(r.id, (x) => (x.actions = v ? [{ type: "block" }, ...x.actions.filter((a) => a.type !== "block")] : x.actions.filter((a) => a.type !== "block")))} label="Bloquer le message" />
            <div className="flex flex-wrap items-center gap-2">
              <Toggle
                checked={r.actions.some((a) => a.type === "alert")}
                onChange={(v) => {
                  const first = allChannels(spec).find((c) => c.channel.purpose === "mod-logs" || c.channel.purpose === "logs")?.channel.id ?? allChannels(spec)[0]?.channel.id;
                  set(r.id, (x) => (x.actions = v && first ? [...x.actions.filter((a) => a.type !== "alert"), { type: "alert", channelId: first }] : x.actions.filter((a) => a.type !== "alert")));
                }}
                label="Alerter l’équipe dans"
              />
              {r.actions.find((a) => a.type === "alert") && (
                <div className="w-56">
                  <Select value={(r.actions.find((a) => a.type === "alert") as { channelId: string }).channelId} options={channelOptions(spec, ["text"]).slice(1)} onChange={(v) => set(r.id, (x) => ((x.actions.find((a) => a.type === "alert") as { channelId: string }).channelId = v))} />
                </div>
              )}
            </div>
            {(r.trigger.type === "keyword" || r.trigger.type === "mention_spam") && (
              <Toggle checked={r.actions.some((a) => a.type === "timeout")} onChange={(v) => set(r.id, (x) => (x.actions = v ? [...x.actions.filter((a) => a.type !== "timeout"), { type: "timeout", durationSeconds: 600 }] : x.actions.filter((a) => a.type !== "timeout")))} label="Exclure temporairement l’auteur (10 min)" />
            )}
          </div>
          <Field label="Rôles exemptés">
            {() => (
              <div className="flex flex-wrap gap-2">
                {spec.roles.map((role) => (
                  <label key={role.id} className="flex items-center gap-1.5 rounded-md bg-mist px-2 py-1 text-xs">
                    <input type="checkbox" checked={r.exemptRoles.includes(role.id)} onChange={(e) => set(r.id, (x) => (x.exemptRoles = e.target.checked ? [...x.exemptRoles, role.id] : x.exemptRoles.filter((y) => y !== role.id)))} />
                    {role.name}
                  </label>
                ))}
              </div>
            )}
          </Field>
        </Section>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => add("keyword")} disabled={spec.automod.filter((r) => r.trigger.type === "keyword").length >= 6}>
          <IconPlus size={14} /> Mots-clés
        </Button>
        {!has("spam") && (
          <Button size="sm" variant="secondary" onClick={() => add("spam")}>
            <IconPlus size={14} /> Anti-spam
          </Button>
        )}
        {!has("keyword_preset") && (
          <Button size="sm" variant="secondary" onClick={() => add("keyword_preset")}>
            <IconPlus size={14} /> Listes Discord
          </Button>
        )}
        {!has("mention_spam") && (
          <Button size="sm" variant="secondary" onClick={() => add("mention_spam")}>
            <IconPlus size={14} /> Anti-mentions
          </Button>
        )}
      </div>
    </div>
  );
}

export function WelcomePanel({ editor }: { editor: Editor }) {
  const { spec } = editor;
  const ob = spec.onboarding;
  const ws = spec.welcomeScreen;
  const chans = allChannels(spec).map((c) => c.channel);
  return (
    <div className="space-y-6">
      <Header kind="Nouveaux membres" title="Accueil et onboarding" />
      {!spec.settings.community && <Notice tone="warning" title="La Communauté est désactivée">L’onboarding et l’écran d’accueil de Discord en ont besoin. Activez-la dans les Réglages, ou utilisez la validation du règlement par bouton (Fonctionnalités).</Notice>}
      <Section title="Onboarding Discord">
        <Toggle
          checked={!!ob?.enabled}
          onChange={(v) => editor.edit((d) => (d.onboarding = v ? (d.onboarding ? { ...d.onboarding, enabled: true } : { enabled: true, mode: "default", defaultChannelIds: chans.slice(0, 8).map((c) => c.id), prompts: [] }) : d.onboarding ? { ...d.onboarding, enabled: false } : undefined))}
          label="Activer l’onboarding"
          hint="Discord exige au moins 7 salons par défaut, dont 5 où @everyone peut écrire."
        />
        {ob?.enabled && (
          <>
            <div>
              <p className="label">Salons par défaut ({ob.defaultChannelIds.length})</p>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {chans.map((c) => (
                  <label key={c.id} className="flex items-center gap-1.5 rounded-md bg-mist px-2 py-1 text-xs">
                    <input type="checkbox" checked={ob.defaultChannelIds.includes(c.id)} onChange={(e) => editor.edit((d) => (d.onboarding!.defaultChannelIds = e.target.checked ? [...d.onboarding!.defaultChannelIds, c.id] : d.onboarding!.defaultChannelIds.filter((x) => x !== c.id)))} />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            {ob.prompts.map((p, pi) => (
              <div key={p.id} className="rounded-xl border border-line p-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <TextInput value={p.title} maxLength={100} onCommit={(v) => editor.edit((d) => (d.onboarding!.prompts[pi]!.title = v || p.title))} />
                  </div>
                  <button type="button" className="text-muted hover:text-danger" onClick={() => editor.edit((d) => d.onboarding!.prompts.splice(pi, 1))} aria-label="Retirer la question">
                    <IconTrash size={15} />
                  </button>
                </div>
                <div className="mt-2 flex gap-4 text-xs">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={p.singleSelect} onChange={(e) => editor.edit((d) => (d.onboarding!.prompts[pi]!.singleSelect = e.target.checked))} /> Choix unique
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={p.required} onChange={(e) => editor.edit((d) => (d.onboarding!.prompts[pi]!.required = e.target.checked))} /> Obligatoire
                  </label>
                </div>
                <ul className="mt-2 space-y-2">
                  {p.options.map((o, oi) => (
                    <li key={o.id} className="grid gap-2 rounded-lg bg-mist/60 p-2 sm:grid-cols-[60px_1fr_1fr_auto]">
                      <input className="field text-center" value={o.emoji ?? ""} maxLength={8} aria-label="Émoji" onChange={(e) => editor.edit((d) => (d.onboarding!.prompts[pi]!.options[oi]!.emoji = e.target.value || undefined))} />
                      <input className="field" value={o.title} maxLength={50} aria-label="Réponse" onChange={(e) => editor.edit((d) => (d.onboarding!.prompts[pi]!.options[oi]!.title = e.target.value || "Option"))} />
                      <select
                        className="field"
                        multiple
                        aria-label="Rôles donnés"
                        value={o.roleIds}
                        onChange={(e) => editor.edit((d) => (d.onboarding!.prompts[pi]!.options[oi]!.roleIds = [...e.target.selectedOptions].map((x) => x.value)))}
                      >
                        {spec.roles.filter((r) => r.selfAssignable).map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="text-muted hover:text-danger" onClick={() => editor.edit((d) => d.onboarding!.prompts[pi]!.options.splice(oi, 1))} aria-label="Retirer la réponse">
                        <IconTrash size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
                <Button size="sm" variant="ghost" onClick={() => editor.edit((d) => d.onboarding!.prompts[pi]!.options.push({ id: uniqueId(d, `${p.id}-option`), title: "Nouvelle réponse", roleIds: [], channelIds: [] }))}>
                  <IconPlus size={14} /> Réponse
                </Button>
              </div>
            ))}
            {ob.prompts.length < 15 && (
              <Button size="sm" variant="secondary" onClick={() => editor.edit((d) => d.onboarding!.prompts.push({ id: uniqueId(d, "question"), title: "Qu’est-ce qui t’intéresse ?", type: "multiple_choice", singleSelect: false, required: false, inOnboarding: true, options: [] }))}>
                <IconPlus size={14} /> Ajouter une question
              </Button>
            )}
            <p className="text-xs text-muted">Une réponse sans rôle ni salon est ignorée à l’enregistrement. Seuls les rôles « que les membres peuvent prendre » sont proposés.</p>
          </>
        )}
      </Section>
      <Section title="Écran d’accueil">
        <Toggle checked={!!ws?.enabled} onChange={(v) => editor.edit((d) => (d.welcomeScreen = v ? d.welcomeScreen ? { ...d.welcomeScreen, enabled: true } : { enabled: true, description: "", channels: [] } : d.welcomeScreen ? { ...d.welcomeScreen, enabled: false } : undefined))} label="Afficher un écran d’accueil" hint="Jusqu’à 5 salons mis en avant." />
        {ws?.enabled && (
          <>
            <Field label="Description">{(id) => <TextInput id={id} value={ws.description ?? ""} maxLength={140} onCommit={(v) => editor.edit((d) => (d.welcomeScreen!.description = v || undefined))} />}</Field>
            {ws.channels.map((c, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[60px_1fr_1fr_auto]">
                <input className="field text-center" value={c.emoji ?? ""} maxLength={8} aria-label="Émoji" onChange={(e) => editor.edit((d) => (d.welcomeScreen!.channels[i]!.emoji = e.target.value || undefined))} />
                <Select value={c.channelId} options={channelOptions(spec).slice(1)} onChange={(v) => editor.edit((d) => (d.welcomeScreen!.channels[i]!.channelId = v))} />
                <input className="field" value={c.description} maxLength={50} aria-label="Description" onChange={(e) => editor.edit((d) => (d.welcomeScreen!.channels[i]!.description = e.target.value || "Salon"))} />
                <button type="button" className="text-muted hover:text-danger" onClick={() => editor.edit((d) => d.welcomeScreen!.channels.splice(i, 1))} aria-label="Retirer">
                  <IconTrash size={15} />
                </button>
              </div>
            ))}
            {ws.channels.length < 5 && chans[0] && (
              <Button size="sm" variant="ghost" onClick={() => editor.edit((d) => d.welcomeScreen!.channels.push({ channelId: chans[0]!.id, description: "Découvrir" }))}>
                <IconPlus size={14} /> Salon mis en avant
              </Button>
            )}
          </>
        )}
      </Section>
      <Section title="Guide du serveur (étape manuelle guidée)">
        <Notice tone="warning">Discord ne permet pas de configurer le Guide du serveur via son API publique. Préparez ici son contenu : après l’installation, un assistant vous indiquera où le coller.</Notice>
        <Field label="Message d’accueil du guide">{(id) => <TextInput id={id} multiline rows={3} value={spec.serverGuide?.welcomeMessage ?? ""} maxLength={300} onCommit={(v) => editor.edit((d) => (d.serverGuide = { newMemberActions: [], resourceChannels: [], ...d.serverGuide, welcomeMessage: v || undefined }))} />}</Field>
      </Section>
    </div>
  );
}

export function FeaturesPanel({ editor }: { editor: Editor }) {
  const { spec } = editor;
  const f = spec.features;
  const text = channelOptions(spec, ["text", "announcement"]).slice(1);
  const firstText = text[0]?.[0] ?? "";
  return (
    <div className="space-y-6">
      <Header kind="Assuré par notre bot" title="Fonctionnalités" />
      <p className="text-sm text-muted">Ces fonctions ne sont pas natives de Discord : c’est notre bot qui les fait fonctionner, tant qu’il reste sur votre serveur.</p>
      <Section title="Message de bienvenue">
        <Toggle checked={!!f.welcome?.enabled} onChange={(v) => editor.edit((d) => (d.features.welcome = v ? d.features.welcome ? { ...d.features.welcome, enabled: true } : { enabled: true, channelId: firstText, message: "Bienvenue {user} sur **{server}** !" } : undefined))} label="Souhaiter la bienvenue aux nouveaux membres" hint="Nécessite l’intention « Server Members » activée pour le bot." />
        {f.welcome?.enabled && (
          <>
            <Field label="Salon">{(id) => <Select id={id} value={f.welcome!.channelId} options={text} onChange={(v) => editor.edit((d) => (d.features.welcome!.channelId = v))} />}</Field>
            <Field label="Message" hint="Jetons : {user}, {server}, {memberCount}, {#salon}, {@rôle}">{(id) => <TextInput id={id} multiline rows={3} value={f.welcome!.message} maxLength={1500} onCommit={(v) => editor.edit((d) => (d.features.welcome!.message = v || d.features.welcome!.message))} />}</Field>
          </>
        )}
      </Section>
      <Section title="Logs d’arrivées et de départs">
        <Toggle checked={!!f.joinLogs?.enabled} onChange={(v) => editor.edit((d) => (d.features.joinLogs = v ? { enabled: true, channelId: d.features.joinLogs?.channelId ?? firstText } : undefined))} label="Consigner les arrivées et départs" />
        {f.joinLogs?.enabled && <Field label="Salon (de préférence privé)">{(id) => <Select id={id} value={f.joinLogs!.channelId} options={channelOptions(spec, ["text"]).slice(1)} onChange={(v) => editor.edit((d) => (d.features.joinLogs!.channelId = v))} />}</Field>}
      </Section>
      <Section title="Tickets privés">
        <Toggle
          checked={!!f.tickets?.enabled}
          onChange={(v) => editor.edit((d) => (d.features.tickets = v ? d.features.tickets ? { ...d.features.tickets, enabled: true } : { enabled: true, channelId: firstText, staffRoleIds: d.roles.filter((r) => r.staff).map((r) => r.id).slice(0, 5).length ? d.roles.filter((r) => r.staff).map((r) => r.id).slice(0, 5) : d.roles.slice(0, 1).map((r) => r.id), intro: "Merci pour ta demande ! Décris ton besoin, l’équipe te répondra ici." } : undefined))}
          label="Permettre d’ouvrir un ticket"
          hint="Ajoutez ensuite un bouton « Ouvrir un ticket » dans un message."
        />
        {f.tickets?.enabled && (
          <>
            <Field label="Salon des tickets (visible des membres)">{(id) => <Select id={id} value={f.tickets!.channelId} options={channelOptions(spec, ["text"]).slice(1)} onChange={(v) => editor.edit((d) => (d.features.tickets!.channelId = v))} />}</Field>
            <Field label="Rôles prévenus">
              {() => (
                <div className="flex flex-wrap gap-2">
                  {spec.roles.map((r) => (
                    <label key={r.id} className="flex items-center gap-1.5 rounded-md bg-mist px-2 py-1 text-xs">
                      <input type="checkbox" checked={f.tickets!.staffRoleIds.includes(r.id)} onChange={(e) => editor.edit((d) => { const ids = e.target.checked ? [...d.features.tickets!.staffRoleIds, r.id] : d.features.tickets!.staffRoleIds.filter((x) => x !== r.id); if (ids.length) d.features.tickets!.staffRoleIds = ids.slice(0, 5); })} />
                      {r.name}
                    </label>
                  ))}
                </div>
              )}
            </Field>
            <Field label="Message d’introduction">{(id) => <TextInput id={id} multiline rows={2} value={f.tickets!.intro} maxLength={1000} onCommit={(v) => editor.edit((d) => (d.features.tickets!.intro = v || d.features.tickets!.intro))} />}</Field>
          </>
        )}
      </Section>
      <Section title="Suggestions">
        <Toggle checked={!!f.suggestions?.enabled} onChange={(v) => editor.edit((d) => (d.features.suggestions = v ? { enabled: true, channelId: d.features.suggestions?.channelId ?? firstText } : undefined))} label="Boîte à suggestions avec votes" hint="Ajoutez un bouton « Proposer une idée » dans un message." />
        {f.suggestions?.enabled && <Field label="Salon de publication">{(id) => <Select id={id} value={f.suggestions!.channelId} options={text} onChange={(v) => editor.edit((d) => (d.features.suggestions!.channelId = v))} />}</Field>}
      </Section>
      <Section title="Validation du règlement">
        <Toggle checked={!!f.rulesGate?.enabled} onChange={(v) => editor.edit((d) => (d.features.rulesGate = v ? { enabled: true, roleId: d.features.rulesGate?.roleId ?? d.roles.at(-1)?.id ?? "" } : undefined))} label="Donner un rôle quand le membre accepte le règlement" hint="Ajoutez un bouton « J’accepte » au message du règlement ; masquez les salons à @everyone et ouvrez-les à ce rôle." />
        {f.rulesGate?.enabled && <Field label="Rôle attribué">{(id) => <Select id={id} value={f.rulesGate!.roleId} options={spec.roles.map((r) => [r.id, r.name] as [string, string])} onChange={(v) => editor.edit((d) => (d.features.rulesGate!.roleId = v))} />}</Field>}
      </Section>
    </div>
  );
}
