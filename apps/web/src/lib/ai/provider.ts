import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ServerSpec } from "@mys/core";
import { env } from "../env";
import { HttpError } from "../api";

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface ToolTurn {
  /** Entrée passée à l’outil (non validée : le service la valide avec zod). */
  input: unknown | null;
  toolUseId: string | null;
  /** Contenu complet de la réponse, à renvoyer tel quel pour un tour de correction. */
  assistantContent: Anthropic.Beta.BetaContentBlock[];
  usage: AiUsage;
  model: string;
  /** Erreur bloquante (refus, réponse tronquée…) en français. */
  problem: string | null;
}

export interface ToolCall {
  model: string;
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  toolName: string;
  toolDescription: string;
  schema: Record<string, unknown>;
  maxTokens: number;
  /** Données structurées de la demande (utilisées seulement par le fournisseur simulé). */
  hint?: { create?: { theme: string; size?: string; name?: string; tone?: string; audience?: string }; spec?: ServerSpec };
}

export interface AiProvider {
  readonly name: "anthropic" | "mock";
  callTool(call: ToolCall): Promise<ToolTurn>;
}

/** Modèles acceptant le repli automatique côté serveur (`fallbacks: "default"`). */
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"]);

class AnthropicProvider implements AiProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic;

  constructor(apiKey: string) {
    // Délai < maxDuration de la route ; une seule nouvelle tentative automatique (429/5xx).
    this.client = new Anthropic({ apiKey, timeout: 270_000, maxRetries: 1 });
  }

  async callTool(call: ToolCall): Promise<ToolTurn> {
    try {
      const stream = this.client.beta.messages.stream({
        model: call.model,
        max_tokens: call.maxTokens,
        // Consignes stables mises en cache (préfixe identique entre les requêtes).
        system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
        tools: [
          {
            name: call.toolName,
            description: call.toolDescription,
            input_schema: call.schema as Anthropic.Beta.BetaTool.InputSchema,
            eager_input_streaming: true,
          },
        ],
        // Le choix forcé d’outil n’est pas accepté par les modèles récents : « auto » + consigne explicite.
        tool_choice: { type: "auto", disable_parallel_tool_use: true },
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        ...(FALLBACK_MODELS.has(call.model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        messages: call.messages,
      });
      const msg = await stream.finalMessage();
      const usage: AiUsage = {
        inputTokens: msg.usage.input_tokens ?? 0,
        outputTokens: msg.usage.output_tokens ?? 0,
        cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: msg.usage.cache_creation_input_tokens ?? 0,
      };
      const tool = msg.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === call.toolName);
      let problem: string | null = null;
      if (msg.stop_reason === "refusal") problem = "Le modèle a refusé cette demande. Reformulez-la (en restant dans les règles de Discord) puis réessayez.";
      else if (msg.stop_reason === "max_tokens") problem = "La réponse de l’IA a été tronquée (trop longue). Demandez un serveur plus compact ou une modification plus ciblée.";
      else if (!tool) problem = "L’IA n’a pas produit de proposition structurée. Réessayez en précisant votre demande.";
      return { input: tool?.input ?? null, toolUseId: tool?.id ?? null, assistantContent: msg.content, usage, model: msg.model, problem };
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
        throw new HttpError(503, "IA indisponible : la clé ANTHROPIC_API_KEY est refusée par l’API.", "ai_config");
      if (e instanceof Anthropic.RateLimitError) throw new HttpError(503, "L’IA est très sollicitée en ce moment. Réessayez dans une minute.", "ai_busy");
      if (e instanceof Anthropic.BadRequestError) throw new HttpError(502, `Requête refusée par l’API de l’IA : ${e.message.slice(0, 200)}`, "ai_request");
      if (e instanceof Anthropic.APIConnectionTimeoutError) throw new HttpError(504, "L’IA a mis trop de temps à répondre. Réessayez avec une demande plus courte.", "ai_timeout");
      if (e instanceof Anthropic.APIError) throw new HttpError(502, "Le service d’IA a rencontré une erreur. Réessayez dans un instant.", "ai_error");
      throw e;
    }
  }
}

let cached: AiProvider | null = null;

export async function getProvider(): Promise<AiProvider> {
  if (env.aiProvider === "mock") {
    const { MockProvider } = await import("./mock");
    return (cached ??= new MockProvider());
  }
  if (!env.anthropicApiKey) {
    throw new HttpError(503, "IA non configurée : ANTHROPIC_API_KEY manquant. Un abonnement personnel à Claude ne donne pas accès à l’API : une clé API Anthropic (facturée à l’usage) est nécessaire.", "ai_config");
  }
  return (cached ??= new AnthropicProvider(env.anthropicApiKey));
}
