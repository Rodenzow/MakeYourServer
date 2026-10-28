import { slugify } from "./spec-utils";
import { ServerSpecSchema, type ServerSpec } from "./schema";

/**
 * Prépare un projet pour la bibliothèque publique.
 *
 * Les projets issus d’une sauvegarde portent des identifiants locaux construits à
 * partir des identifiants Discord du serveur d’origine (`r-1234…`, `c-1234…`).
 * On les remplace par des identifiants lisibles dérivés des noms, pour ne publier
 * aucune trace du serveur source. Les références ({#salon}, {@rôle}, permissions,
 * onboarding…) sont mises à jour en même temps.
 */
const SNOWFLAKE_ID = /\b[rckapo]-\d{15,21}\b/g;

export function prepareForPublication(input: ServerSpec, name: string): ServerSpec {
  const used = new Set<string>();
  const remap = new Map<string, string>();
  const claim = (oldId: string, label: string, fallback: string) => {
    if (!/^[rckapo]-\d{15,21}$/.test(oldId) || remap.has(oldId)) return;
    const base = (slugify(label) || fallback).slice(0, 48).replace(/-+$/, "") || fallback;
    let id = base;
    for (let i = 2; used.has(id); i++) id = `${base}-${i}`;
    used.add(id);
    remap.set(oldId, id);
  };

  // Les identifiants déjà lisibles restent réservés.
  const keep = (id: string) => !/^[rckapo]-\d{15,21}$/.test(id) && used.add(id);
  input.roles.forEach((r) => keep(r.id));
  input.categories.forEach((c) => {
    keep(c.id);
    c.channels.forEach((ch) => keep(ch.id));
  });
  input.uncategorized.forEach((ch) => keep(ch.id));
  input.automod.forEach((a) => keep(a.id));
  input.messages.forEach((m) => keep(m.id));

  input.roles.forEach((r) => claim(r.id, r.name, "role"));
  input.categories.forEach((c) => {
    claim(c.id, `cat-${c.name}`, "categorie");
    c.channels.forEach((ch) => claim(ch.id, ch.name, "salon"));
  });
  input.uncategorized.forEach((ch) => claim(ch.id, ch.name, "salon"));
  input.automod.forEach((a) => claim(a.id, `am-${a.name}`, "automod"));
  input.onboarding?.prompts.forEach((p) => {
    claim(p.id, `q-${p.title}`, "question");
    p.options.forEach((o) => claim(o.id, `o-${o.title}`, "option"));
  });

  const json = JSON.stringify(input).replace(SNOWFLAKE_ID, (m) => remap.get(m) ?? m);
  const spec = ServerSpecSchema.parse(JSON.parse(json));
  spec.meta.name = name;
  return spec;
}

/** Vrai si la spécification contient encore des identifiants dérivés d’un serveur réel. */
export function hasSourceIdentifiers(spec: ServerSpec): boolean {
  return new RegExp(SNOWFLAKE_ID.source).test(JSON.stringify(spec));
}
