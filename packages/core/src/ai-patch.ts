import { z } from "zod";
import {
  AutoModRuleSchema,
  CategorySchema,
  ChannelSchema,
  FeaturesSchema,
  MessageSchema,
  OnboardingSchema,
  RoleSchema,
  ServerGuideSchema,
  SettingsSchema,
  WelcomeScreenSchema,
  type ServerSpec,
} from "./schema";
import { cloneSpec, findCategory, findChannel, moveCategory, moveChannel, moveRole, removeChannel, removeRole } from "./spec-utils";
import { validateSpec, type Issue } from "./validate";

/**
 * Format des modifications ciblées proposées par l’IA. Chaque « changement » est
 * un groupe d’opérations que l’utilisateur peut accepter ou refuser séparément.
 * L’IA ne produit que des données : elle n’exécute jamais d’action Discord.
 */
export const PatchOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("set_meta"),
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional(),
    tone: z.string().max(80).optional(),
    audience: z.string().max(200).optional(),
  }),
  z.object({ op: z.literal("set_settings"), settings: SettingsSchema.partial() }),
  z.object({ op: z.literal("upsert_role"), role: RoleSchema, position: z.number().int().min(0).optional() }),
  z.object({ op: z.literal("remove_role"), id: z.string() }),
  z.object({
    op: z.literal("upsert_category"),
    category: CategorySchema.omit({ channels: true }),
    position: z.number().int().min(0).optional(),
  }),
  z.object({ op: z.literal("remove_category"), id: z.string() }),
  z.object({
    op: z.literal("upsert_channel"),
    channel: ChannelSchema,
    categoryId: z.string().nullable(),
    position: z.number().int().min(0).optional(),
  }),
  z.object({ op: z.literal("remove_channel"), id: z.string() }),
  z.object({ op: z.literal("upsert_message"), message: MessageSchema }),
  z.object({ op: z.literal("remove_message"), id: z.string() }),
  z.object({ op: z.literal("upsert_automod"), rule: AutoModRuleSchema }),
  z.object({ op: z.literal("remove_automod"), id: z.string() }),
  z.object({ op: z.literal("set_onboarding"), onboarding: OnboardingSchema.nullable() }),
  z.object({ op: z.literal("set_welcome_screen"), welcomeScreen: WelcomeScreenSchema.nullable() }),
  z.object({ op: z.literal("set_features"), features: FeaturesSchema }),
  z.object({ op: z.literal("set_server_guide"), serverGuide: ServerGuideSchema.nullable() }),
]);
export type PatchOp = z.infer<typeof PatchOpSchema>;

export const ChangeSetSchema = z.object({
  summary: z.string().max(1000),
  changes: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        reason: z.string().max(500),
        ops: z.array(PatchOpSchema).min(1).max(80),
      }),
    )
    .min(1)
    .max(20),
});
export type ChangeSet = z.infer<typeof ChangeSetSchema>;

export interface PatchConstraints {
  /** « Conserve mes rôles actuels » : interdit toute modification de rôle existant. */
  lockRoles?: boolean;
  /** Interdit les suppressions. */
  noRemovals?: boolean;
}

export interface PatchResult {
  spec: ServerSpec;
  applied: number;
  rejected: Array<{ op: PatchOp["op"]; reason: string }>;
}

export function applyPatchOps(input: ServerSpec, ops: PatchOp[], constraints: PatchConstraints = {}): PatchResult {
  let spec = cloneSpec(input);
  const rejected: PatchResult["rejected"] = [];
  let applied = 0;
  const existingRoleIds = new Set(input.roles.map((r) => r.id));

  for (const op of ops) {
    const reject = (reason: string) => rejected.push({ op: op.op, reason });
    if (constraints.noRemovals && op.op.startsWith("remove_")) {
      reject("Suppressions interdites pour cette demande.");
      continue;
    }
    switch (op.op) {
      case "set_meta": {
        const { op: _o, ...rest } = op;
        for (const [k, v] of Object.entries(rest)) if (v !== undefined) (spec.meta as Record<string, unknown>)[k] = v;
        break;
      }
      case "set_settings":
        spec.settings = { ...spec.settings, ...Object.fromEntries(Object.entries(op.settings).filter(([, v]) => v !== undefined)) };
        break;
      case "upsert_role": {
        if (constraints.lockRoles && existingRoleIds.has(op.role.id)) {
          reject(`Le rôle « ${op.role.name} » est conservé tel quel.`);
          continue;
        }
        const i = spec.roles.findIndex((r) => r.id === op.role.id);
        if (i >= 0) spec.roles[i] = op.role;
        else spec.roles.push(op.role);
        if (op.position !== undefined) spec = moveRole(spec, op.role.id, op.position);
        break;
      }
      case "remove_role":
        if (constraints.lockRoles && existingRoleIds.has(op.id)) {
          reject("Les rôles actuels sont conservés.");
          continue;
        }
        spec = removeRole(spec, op.id);
        break;
      case "upsert_category": {
        const existing = findCategory(spec, op.category.id);
        if (existing) {
          existing.name = op.category.name;
          existing.overwrites = op.category.overwrites;
        } else spec.categories.push({ ...op.category, channels: [] });
        if (op.position !== undefined) spec = moveCategory(spec, op.category.id, op.position);
        break;
      }
      case "remove_category":
        spec = removeChannel(spec, op.id);
        break;
      case "upsert_channel": {
        if (op.categoryId && !findCategory(spec, op.categoryId)) {
          reject(`Catégorie « ${op.categoryId} » introuvable pour le salon « ${op.channel.name} ».`);
          continue;
        }
        const found = findChannel(spec, op.channel.id);
        if (found) Object.assign(found.channel, op.channel);
        else (op.categoryId ? findCategory(spec, op.categoryId)!.channels : spec.uncategorized).push(op.channel);
        const currentParent = findChannel(spec, op.channel.id)!.category?.id ?? null;
        if (currentParent !== op.categoryId || op.position !== undefined) {
          const list = op.categoryId ? findCategory(spec, op.categoryId)!.channels : spec.uncategorized;
          spec = moveChannel(spec, op.channel.id, op.categoryId, op.position ?? list.length);
        }
        break;
      }
      case "remove_channel":
        spec = removeChannel(spec, op.id);
        break;
      case "upsert_message": {
        const i = spec.messages.findIndex((m) => m.id === op.message.id);
        if (i >= 0) spec.messages[i] = op.message;
        else spec.messages.push(op.message);
        break;
      }
      case "remove_message":
        spec.messages = spec.messages.filter((m) => m.id !== op.id);
        break;
      case "upsert_automod": {
        const i = spec.automod.findIndex((a) => a.id === op.rule.id);
        if (i >= 0) spec.automod[i] = op.rule;
        else spec.automod.push(op.rule);
        break;
      }
      case "remove_automod":
        spec.automod = spec.automod.filter((a) => a.id !== op.id);
        break;
      case "set_onboarding":
        if (op.onboarding) spec.onboarding = op.onboarding;
        else delete spec.onboarding;
        break;
      case "set_welcome_screen":
        if (op.welcomeScreen) spec.welcomeScreen = op.welcomeScreen;
        else delete spec.welcomeScreen;
        break;
      case "set_features":
        spec.features = op.features;
        break;
      case "set_server_guide":
        if (op.serverGuide) spec.serverGuide = op.serverGuide;
        else delete spec.serverGuide;
        break;
    }
    applied++;
  }
  return { spec, applied, rejected };
}

/** Applique les changements acceptés, dans l’ordre, et valide le résultat. */
export function applyChanges(
  spec: ServerSpec,
  changeSet: ChangeSet,
  acceptedIndexes: number[],
  constraints: PatchConstraints = {},
): PatchResult & { issues: Issue[]; ok: boolean } {
  const ops = acceptedIndexes.sort((a, b) => a - b).flatMap((i) => changeSet.changes[i]?.ops ?? []);
  const result = applyPatchOps(spec, ops, constraints);
  const v = validateSpec(result.spec);
  return { ...result, issues: v.issues, ok: v.ok };
}
