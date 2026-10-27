import { allChannels, type ServerSpec } from "@mys/core";

export interface SpecDiff {
  added: string[];
  removed: string[];
  modified: string[];
}

type Item = { id: string; label: string; json: string };

function items(spec: ServerSpec): Item[] {
  const out: Item[] = [];
  spec.roles.forEach((r) => out.push({ id: `role:${r.id}`, label: `Rôle « ${r.name} »`, json: JSON.stringify(r) }));
  spec.categories.forEach((c) => out.push({ id: `cat:${c.id}`, label: `Catégorie « ${c.name} »`, json: JSON.stringify({ ...c, channels: c.channels.map((x) => x.id) }) }));
  allChannels(spec).forEach(({ channel, category }) => out.push({ id: `ch:${channel.id}`, label: `Salon « ${channel.name} »`, json: JSON.stringify({ channel, parent: category?.id ?? null }) }));
  spec.messages.forEach((m) => out.push({ id: `msg:${m.id}`, label: `Message « ${m.embeds[0]?.title ?? m.content?.slice(0, 40) ?? m.id} »`, json: JSON.stringify(m) }));
  spec.automod.forEach((a) => out.push({ id: `am:${a.id}`, label: `Règle AutoMod « ${a.name} »`, json: JSON.stringify(a) }));
  return out;
}

/** Différences lisibles entre deux versions d’un projet (pour l’aperçu des propositions de l’IA). */
export function diffSpecs(before: ServerSpec, after: ServerSpec): SpecDiff {
  const a = new Map(items(before).map((i) => [i.id, i]));
  const b = new Map(items(after).map((i) => [i.id, i]));
  const diff: SpecDiff = { added: [], removed: [], modified: [] };
  for (const [id, item] of b) {
    const prev = a.get(id);
    if (!prev) diff.added.push(item.label);
    else if (prev.json !== item.json) diff.modified.push(prev.label === item.label ? item.label : `${prev.label} → ${item.label.replace(/^[^«]+/, "")}`);
  }
  for (const [id, item] of a) if (!b.has(id)) diff.removed.push(item.label);
  const sections: Array<[string, unknown, unknown]> = [
    ["Réglages du serveur", before.settings, after.settings],
    ["Onboarding", before.onboarding, after.onboarding],
    ["Écran d’accueil", before.welcomeScreen, after.welcomeScreen],
    ["Fonctionnalités du bot", before.features, after.features],
    ["Guide du serveur", before.serverGuide, after.serverGuide],
    ["Informations du projet", before.meta, after.meta],
    ["Permissions de @everyone", before.everyone, after.everyone],
  ];
  for (const [label, x, y] of sections) if (JSON.stringify(x) !== JSON.stringify(y)) diff.modified.push(label);
  const orderBefore = before.categories.map((c) => c.id).join(",");
  const orderAfter = after.categories.filter((c) => a.has(`cat:${c.id}`)).map((c) => c.id).join(",");
  if (orderBefore !== orderAfter && !diff.removed.some((l) => l.startsWith("Catégorie"))) diff.modified.push("Ordre des catégories");
  return diff;
}
