import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import {
  ChangeSetSchema,
  ServerSpecSchema,
  applyChanges,
  applyPatchOps,
  validateSpec,
  type ChangeSet,
  type PatchConstraints,
  type ServerSpec,
} from "@mys/core";
import { aiGenerations, and, audit, eq, getDb, logError } from "@mys/db";
import { HttpError } from "../api";
import { getOwnedProject, saveProject } from "../data";
import { env } from "../env";
import { diffSpecs, type SpecDiff } from "./diff";
import { CREATE_SYSTEM, EDIT_SYSTEM, createUserPrompt, editUserPrompt, repairPrompt } from "./prompts";
import { getProvider, type AiUsage, type ToolCall } from "./provider";
import { ZERO_USAGE, addUsage, assertAiAllowed, costMicros, recordUsage, type AiKind } from "./quota";
import { changeSetToolSchema, specToolSchema, type CreateRequest, type EditRequest } from "./schemas";

export const SIMULATED = () => env.aiProvider === "mock";

function zodErrors(issues: Array<{ path: PropertyKey[]; message: string }>): string[] {
  return issues.slice(0, 25).map((i) => `${i.path.map(String).join(".") || "racine"} : ${i.message}`);
}

/**
 * Boucle « proposition → validation → (une) correction ». La sortie de l’IA n’est
 * jamais utilisée sans être validée par les mêmes contrôles que les templates.
 */
async function proposeWithRepair<T>(
  base: Omit<ToolCall, "messages">,
  firstMessage: string,
  validate: (input: unknown) => { ok: true; value: T } | { ok: false; errors: string[] },
): Promise<{ value: T | null; errors: string[]; usage: AiUsage; model: string; attempts: number }> {
  const provider = await getProvider();
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: firstMessage }];
  let usage = ZERO_USAGE;
  let model = base.model;
  let errors: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const turn = await provider.callTool({ ...base, messages });
    usage = addUsage(usage, turn.usage);
    model = turn.model;
    if (turn.problem) return { value: null, errors: [turn.problem], usage, model, attempts: attempt };
    const result = validate(turn.input);
    if (result.ok) return { value: result.value, errors: [], usage, model, attempts: attempt };
    errors = result.errors;
    if (attempt === 2 || !turn.toolUseId || provider.name === "mock") break;
    messages.push({ role: "assistant", content: turn.assistantContent });
    messages.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: turn.toolUseId, is_error: true, content: repairPrompt(errors) }],
    });
  }
  return { value: null, errors, usage, model, attempts: 2 };
}

async function startGeneration(userId: string, kind: AiKind, prompt: string, options: Record<string, unknown>, projectId: string | null, model: string) {
  const [row] = await getDb()
    .insert(aiGenerations)
    .values({ userId, kind, prompt, options, projectId, status: "running", model: SIMULATED() ? "simulation" : model })
    .returning();
  return row!;
}

async function finishGeneration(
  id: string,
  userId: string,
  kind: AiKind,
  settings: Awaited<ReturnType<typeof assertAiAllowed>>["settings"],
  out: { usage: AiUsage; model: string; ok: boolean; error?: string; resultSpec?: ServerSpec; changeSet?: ChangeSet },
) {
  const cost = SIMULATED() ? 0 : costMicros(settings, out.usage);
  await recordUsage(userId, kind, out.usage, cost, out.ok);
  await getDb()
    .update(aiGenerations)
    .set({
      status: out.ok ? "succeeded" : "failed",
      model: SIMULATED() ? "simulation" : out.model,
      inputTokens: out.usage.inputTokens + out.usage.cacheReadTokens + out.usage.cacheWriteTokens,
      outputTokens: out.usage.outputTokens,
      costMicros: cost,
      resultSpec: out.resultSpec ?? null,
      changeSet: out.changeSet ?? null,
      error: out.error?.slice(0, 2000) ?? null,
      finishedAt: new Date(),
    })
    .where(eq(aiGenerations.id, id));
  await audit({ actorUserId: userId, actorType: "user", action: `ai.${kind}.${out.ok ? "succeeded" : "failed"}`, targetType: "ai_generation", targetId: id, metadata: { cost, model: out.model } });
  return cost;
}

/* -------------------------------------------------------------------------- */
/*                              Conception complète                            */
/* -------------------------------------------------------------------------- */

export async function runCreation(userId: string, req: CreateRequest) {
  const { settings } = await assertAiAllowed(userId, "create");
  const gen = await startGeneration(userId, "create", req.description, req as unknown as Record<string, unknown>, null, settings.model);
  try {
    const res = await proposeWithRepair<ServerSpec>(
      {
        model: settings.model,
        system: CREATE_SYSTEM,
        toolName: "enregistrer_serveur",
        toolDescription: "Enregistre la conception complète du serveur Discord (ServerSpec version 1). Appelle cet outil une seule fois avec le projet complet.",
        schema: specToolSchema(),
        maxTokens: Math.max(settings.maxOutputTokens, 32000),
        hint: { create: { theme: req.theme, size: req.size, name: req.name, tone: req.tone, audience: req.audience } },
      },
      createUserPrompt(req),
      (input) => {
        const parsed = ServerSpecSchema.safeParse(input);
        if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error.issues) };
        const spec = parsed.data;
        // Paramètres imposés par l’utilisateur.
        if (req.name) spec.meta.name = req.name;
        spec.meta.theme = req.theme;
        spec.meta.size = req.size;
        const v = validateSpec(spec);
        if (!v.ok) return { ok: false, errors: v.errors.map((e) => e.message) };
        return { ok: true, value: spec };
      },
    );
    const ok = !!res.value;
    const error = ok ? undefined : `La proposition de l’IA ne respectait pas les règles du moteur : ${res.errors.slice(0, 3).join(" ; ")}`;
    await finishGeneration(gen.id, userId, "create", settings, { usage: res.usage, model: res.model, ok, error, resultSpec: res.value ?? undefined });
    if (!ok) throw new HttpError(422, `${error} Aucun projet n’a été créé ; le quota n’est décompté que si l’IA a réellement été sollicitée.`, "ai_invalid");
    return { generationId: gen.id, spec: res.value!, validation: validateSpec(res.value!), simulated: SIMULATED() };
  } catch (e) {
    if (!(e instanceof HttpError && e.code === "ai_invalid")) {
      await getDb()
        .update(aiGenerations)
        .set({ status: "failed", error: e instanceof Error ? e.message.slice(0, 2000) : "Erreur inconnue", finishedAt: new Date() })
        .where(and(eq(aiGenerations.id, gen.id), eq(aiGenerations.status, "running")));
      if (!(e instanceof HttpError)) await logError("web", "Conception IA en échec", { generationId: gen.id, error: e });
    }
    throw e;
  }
}

/* -------------------------------------------------------------------------- */
/*                            Modifications ciblées                            */
/* -------------------------------------------------------------------------- */

export interface ChangePreview {
  index: number;
  title: string;
  reason: string;
  valid: boolean;
  errors: string[];
  rejected: string[];
  diff: SpecDiff;
}

/** Aperçu de chaque changement appliqué seul au projet actuel. */
export function previewChanges(spec: ServerSpec, changeSet: ChangeSet, constraints: PatchConstraints): ChangePreview[] {
  return changeSet.changes.map((c, index) => {
    const res = applyPatchOps(spec, c.ops, constraints);
    const v = validateSpec(res.spec);
    return {
      index,
      title: c.title,
      reason: c.reason,
      valid: v.ok,
      errors: v.errors.map((e) => e.message).slice(0, 5),
      rejected: res.rejected.map((r) => r.reason),
      diff: diffSpecs(spec, res.spec),
    };
  });
}

export async function runEdit(userId: string, req: EditRequest) {
  const project = await getOwnedProject(userId, req.projectId);
  if (!project) throw new HttpError(404, "Projet introuvable.");
  const { settings } = await assertAiAllowed(userId, "edit");
  const constraints: PatchConstraints = { lockRoles: req.lockRoles, noRemovals: req.noRemovals };
  const gen = await startGeneration(userId, "edit", req.instruction, { ...constraints, baseRevision: project.revision }, project.id, settings.model);
  try {
    const res = await proposeWithRepair<ChangeSet>(
      {
        model: settings.model,
        system: EDIT_SYSTEM,
        toolName: "proposer_modifications",
        toolDescription: "Propose des modifications ciblées du projet sous forme de changements indépendants (ChangeSet). Appelle cet outil une seule fois.",
        schema: changeSetToolSchema(),
        maxTokens: Math.max(settings.maxOutputTokens, 16000),
        hint: { spec: project.spec },
      },
      editUserPrompt(project.spec, req),
      (input) => {
        const parsed = ChangeSetSchema.safeParse(input);
        if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error.issues) };
        const previews = previewChanges(project.spec, parsed.data, constraints);
        if (previews.every((p) => !p.valid)) return { ok: false, errors: previews.flatMap((p) => p.errors.map((e) => `${p.title} : ${e}`)) };
        return { ok: true, value: parsed.data };
      },
    );
    const ok = !!res.value;
    const error = ok ? undefined : `La proposition de l’IA ne respectait pas les règles du moteur : ${res.errors.slice(0, 3).join(" ; ")}`;
    await finishGeneration(gen.id, userId, "edit", settings, { usage: res.usage, model: res.model, ok, error, changeSet: res.value ?? undefined });
    if (!ok) throw new HttpError(422, `${error} Votre projet n’a pas été modifié.`, "ai_invalid");
    return { generationId: gen.id, changeSet: res.value!, previews: previewChanges(project.spec, res.value!, constraints), revision: project.revision, simulated: SIMULATED() };
  } catch (e) {
    if (!(e instanceof HttpError && e.code === "ai_invalid")) {
      await getDb()
        .update(aiGenerations)
        .set({ status: "failed", error: e instanceof Error ? e.message.slice(0, 2000) : "Erreur inconnue", finishedAt: new Date() })
        .where(and(eq(aiGenerations.id, gen.id), eq(aiGenerations.status, "running")));
      if (!(e instanceof HttpError)) await logError("web", "Modification IA en échec", { generationId: gen.id, error: e });
    }
    throw e;
  }
}

export async function getOwnedGeneration(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [g] = await getDb()
    .select()
    .from(aiGenerations)
    .where(and(eq(aiGenerations.id, id), eq(aiGenerations.userId, userId)));
  return g ?? null;
}

/** Applique un sous-ensemble des changements proposés, sans régénérer le projet. */
export async function applyEdit(userId: string, generationId: string, accepted: number[], revision: number) {
  const gen = await getOwnedGeneration(userId, generationId);
  if (!gen || gen.kind !== "edit" || !gen.projectId || !gen.changeSet) throw new HttpError(404, "Proposition introuvable.");
  if (gen.status !== "succeeded") throw new HttpError(409, "Cette proposition a déjà été traitée.");
  const project = await getOwnedProject(userId, gen.projectId);
  if (!project) throw new HttpError(404, "Projet introuvable.");
  const indexes = [...new Set(accepted)].filter((i) => Number.isInteger(i) && i >= 0 && i < gen.changeSet!.changes.length);
  if (!indexes.length) throw new HttpError(400, "Sélectionnez au moins une modification à appliquer.");
  const constraints = { lockRoles: !!gen.options.lockRoles, noRemovals: !!gen.options.noRemovals };
  const result = applyChanges(project.spec, gen.changeSet, indexes, constraints);
  if (!result.ok) {
    throw new HttpError(422, `Ces modifications, combinées, rendraient le projet invalide : ${result.issues.filter((i) => i.level === "error").slice(0, 3).map((i) => i.message).join(" ; ")}`, "invalid_combination");
  }
  const titles = indexes.map((i) => gen.changeSet!.changes[i]!.title).join(", ");
  const saved = await saveProject(userId, project.id, { spec: result.spec, revision, author: "ai", note: `IA : ${titles}`.slice(0, 300) });
  await getDb().update(aiGenerations).set({ status: "applied", acceptedChanges: indexes }).where(eq(aiGenerations.id, gen.id));
  await audit({ actorUserId: userId, actorType: "user", action: "ai.edit.applied", targetType: "project", targetId: project.id, metadata: { generationId: gen.id, accepted: indexes } });
  return { spec: saved.project.spec, revision: saved.project.revision, validation: saved.validation };
}

export async function rejectGeneration(userId: string, generationId: string) {
  const gen = await getOwnedGeneration(userId, generationId);
  if (!gen) throw new HttpError(404, "Proposition introuvable.");
  if (gen.status !== "succeeded") return;
  await getDb().update(aiGenerations).set({ status: "rejected" }).where(eq(aiGenerations.id, gen.id));
}
