import "server-only";
import { getSetting, type AiSettings } from "@mys/db";
import { getEntitlement, getUsage, incrementUsage, platformUsage, type Entitlement } from "@mys/engine";
import { HttpError } from "../api";
import { env } from "../env";
import type { AiUsage } from "./provider";

export type AiKind = "create" | "edit";

export interface AiAllowance {
  settings: AiSettings;
  entitlement: Entitlement;
  used: number;
  limit: number;
}

const fmt = (micros: number) => `${(micros / 1_000_000).toFixed(2)} $`;

/**
 * Contrôles AVANT tout appel payant : activation, offre, quota mensuel,
 * plafond de coût par utilisateur et budget global de la plateforme.
 */
export async function assertAiAllowed(userId: string, kind: AiKind): Promise<AiAllowance> {
  const settings = await getSetting("ai");
  if (!settings.enabled) throw new HttpError(503, "La conception par IA est temporairement désactivée par l’administration.", "ai_disabled");
  const entitlement = await getEntitlement(userId);
  const q = entitlement.quotas;
  const limit = kind === "create" ? q.aiGenerationsPerMonth : q.aiEditsPerMonth;
  if (limit <= 0) {
    throw new HttpError(402, "La conception et les modifications par IA font partie de l’offre Premium. Les templates complets restent gratuits.", "premium_required");
  }
  const usage = await getUsage(userId);
  const used = kind === "create" ? usage.ai_generations : usage.ai_edits;
  if (used >= limit) {
    throw new HttpError(402, `Quota mensuel atteint : ${used}/${limit} ${kind === "create" ? "conceptions" : "modifications"} IA ce mois-ci. Il sera renouvelé le 1er du mois.`, "quota");
  }
  if (env.aiProvider !== "mock") {
    // Un plafond à 0 signifie « pas de plafond individuel » (le quota mensuel et le budget global s’appliquent toujours).
    if (q.aiCostCapMicrosPerMonth > 0 && usage.ai_cost_micros >= q.aiCostCapMicrosPerMonth) {
      throw new HttpError(402, `Plafond de consommation IA atteint pour ce mois (${fmt(usage.ai_cost_micros)}). Il sera renouvelé le 1er du mois.`, "cost_cap");
    }
    const platform = await platformUsage("ai_cost_micros");
    if (settings.monthlyBudgetMicros <= 0 || platform >= settings.monthlyBudgetMicros) {
      throw new HttpError(503, "Le budget IA de la plateforme est épuisé pour ce mois. Réessayez plus tard ou contactez l’équipe.", "ai_budget");
    }
  }
  return { settings, entitlement, used, limit };
}

/** Coût estimé à partir des prix saisis dans l’administration (écriture en cache ×1,25, lecture ×0,1). */
export function costMicros(settings: AiSettings, u: AiUsage): number {
  const input = u.inputTokens * settings.inputMicrosPerMTok + u.cacheWriteTokens * settings.inputMicrosPerMTok * 1.25 + u.cacheReadTokens * settings.inputMicrosPerMTok * 0.1;
  return Math.round((input + u.outputTokens * settings.outputMicrosPerMTok) / 1_000_000);
}

export function addUsage(a: AiUsage, b: AiUsage): AiUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

export const ZERO_USAGE: AiUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

/** Comptabilise la consommation, y compris en cas d’échec si des jetons ont été consommés. */
export async function recordUsage(userId: string, kind: AiKind, usage: AiUsage, cost: number, succeeded: boolean) {
  const consumed = usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens > 0;
  if (succeeded || consumed) await incrementUsage(userId, kind === "create" ? "ai_generations" : "ai_edits", 1);
  await incrementUsage(userId, "ai_input_tokens", usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens);
  await incrementUsage(userId, "ai_output_tokens", usage.outputTokens);
  await incrementUsage(userId, "ai_cost_micros", cost);
}
