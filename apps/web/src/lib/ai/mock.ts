import { ServerSpecSchema, slugify, usedIds, type ChangeSet, type ServerSpec } from "@mys/core";
import { OFFICIAL_TEMPLATES } from "@mys/core/templates";
import type { AiProvider, ToolCall, ToolTurn } from "./provider";

/**
 * Fournisseur simulé, déterministe (AI_PROVIDER=mock) : pour le développement et
 * les tests. Ses réponses sont toujours signalées « réponse simulée » dans l’interface.
 */
const THEME_TO_TEMPLATE: Record<string, string> = {
  communaute: "communaute",
  gaming: "gaming",
  musique: "musique-rap",
  createur: "createur",
  association: "association",
  etudes: "etudes",
  roleplay: "roleplay",
  professionnel: "projet-pro",
  tech: "tech-dev",
  art: "art-creation",
  anime: "anime-manga",
  amis: "entre-amis",
  sport: "sport",
};

export function mockSpec(params: { theme: string; name?: string; size?: string; tone?: string; audience?: string }): ServerSpec {
  const slug = THEME_TO_TEMPLATE[params.theme] ?? "communaute";
  const t = OFFICIAL_TEMPLATES.find((x) => x.slug === slug) ?? OFFICIAL_TEMPLATES[0]!;
  const spec = ServerSpecSchema.parse(structuredClone(t.spec));
  spec.meta.name = (params.name ?? `${t.name} sur mesure`).slice(0, 100);
  spec.meta.description = `Conception simulée inspirée du template « ${t.name} ».`;
  if (params.size === "small" || params.size === "medium" || params.size === "large") spec.meta.size = params.size;
  if (params.tone) spec.meta.tone = params.tone;
  if (params.audience) spec.meta.audience = params.audience;
  return spec;
}

/** Changement simulé : ajoute un espace « événements » complet (catégorie, salons, message). */
export function mockChangeSet(spec: ServerSpec): ChangeSet {
  const ids = usedIds(spec);
  const uid = (base: string) => {
    let id = slugify(base);
    let i = 2;
    while (ids.has(id)) id = `${slugify(base)}-${i++}`;
    ids.add(id);
    return id;
  };
  const cat = uid("cat-evenements-ia");
  const agenda = uid("agenda-ia");
  const vocal = uid("vocal-evenements-ia");
  const msg = uid("msg-agenda-ia");
  const lastCategory = spec.categories.length;
  return {
    summary: "Réponse simulée : ajout d’un espace événements avec un agenda en lecture seule et un salon vocal.",
    changes: [
      {
        title: "Ajouter un espace événements",
        reason: "Centraliser l’agenda et offrir un lieu vocal pour les soirées.",
        ops: [
          { op: "upsert_category", category: { id: cat, name: "🎉 Événements", overwrites: [] }, position: Math.max(0, lastCategory - 1) },
          {
            op: "upsert_channel",
            categoryId: cat,
            channel: {
              id: agenda,
              name: "📅・agenda",
              type: "text",
              topic: "Le programme des prochains événements.",
              nsfw: false,
              slowmode: 0,
              syncPermissions: false,
              overwrites: [{ target: "everyone", allow: ["VIEW_CHANNEL", "READ_MESSAGE_HISTORY", "ADD_REACTIONS"], deny: ["SEND_MESSAGES"] }],
              purpose: "events",
            },
          },
          {
            op: "upsert_channel",
            categoryId: cat,
            channel: { id: vocal, name: "🎤 Soirées", type: "voice", nsfw: false, slowmode: 0, syncPermissions: true, overwrites: [] },
          },
        ],
      },
      {
        title: "Publier un message d’agenda",
        reason: "Expliquer aux membres comment fonctionnent les événements.",
        ops: [
          {
            op: "upsert_message",
            message: {
              id: msg,
              channelId: agenda,
              embeds: [{ title: "📅 L’agenda du serveur", description: "Retrouvez ici les prochains événements. Réagissez avec ✅ pour indiquer votre présence.", fields: [] }],
              buttons: [],
              pin: true,
            },
          },
        ],
      },
    ],
  };
}

export class MockProvider implements AiProvider {
  readonly name = "mock" as const;

  async callTool(call: ToolCall): Promise<ToolTurn> {
    await new Promise((r) => setTimeout(r, 600));
    const input: unknown =
      call.toolName === "enregistrer_serveur"
        ? mockSpec(call.hint?.create ?? { theme: "communaute" })
        : mockChangeSet(call.hint?.spec ?? ServerSpecSchema.parse(OFFICIAL_TEMPLATES[0]!.spec));
    return {
      input,
      toolUseId: "mock-tool-use",
      assistantContent: [],
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      model: "simulation",
      problem: null,
    };
  }
}

