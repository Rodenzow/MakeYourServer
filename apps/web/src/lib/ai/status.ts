import "server-only";
import { getSetting } from "@mys/db";
import { getEntitlement, getUsage } from "@mys/engine";
import { env } from "../env";

/** État de l’IA pour un utilisateur : affiché dans l’éditeur et la page IA. */
export async function aiStatus(userId: string) {
  const [settings, ent, usage] = await Promise.all([getSetting("ai"), getEntitlement(userId), getUsage(userId)]);
  const configured = env.aiProvider === "mock" || !!env.anthropicApiKey;
  return {
    enabled: settings.enabled && configured,
    configured,
    simulated: env.aiProvider === "mock",
    planKey: ent.planKey,
    planName: ent.planName,
    premium: ent.quotas.aiGenerationsPerMonth > 0 || ent.quotas.aiEditsPerMonth > 0,
    generations: { used: usage.ai_generations, limit: ent.quotas.aiGenerationsPerMonth },
    edits: { used: usage.ai_edits, limit: ent.quotas.aiEditsPerMonth },
  };
}
export type AiStatus = Awaited<ReturnType<typeof aiStatus>>;
