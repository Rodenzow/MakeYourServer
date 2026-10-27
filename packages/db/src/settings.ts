import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { appSettings } from "./schema";

export interface AiSettings {
  enabled: boolean;
  model: string;
  /** Prix fournisseur par million de jetons (µ$) : à tenir à jour depuis l’administration. */
  inputMicrosPerMTok: number;
  outputMicrosPerMTok: number;
  maxOutputTokens: number;
  /** Budget global mensuel de la plateforme (µ$). 0 = IA bloquée. */
  monthlyBudgetMicros: number;
}

export interface MaintenanceSettings {
  enabled: boolean;
  message: string;
  /** Bloque les nouvelles installations (les installations en cours terminent). */
  blockInstalls: boolean;
}

export const SETTING_DEFAULTS = {
  ai: {
    enabled: true,
    model: process.env.AI_MODEL ?? "claude-sonnet-5-5",
    inputMicrosPerMTok: 2_000_000,
    outputMicrosPerMTok: 10_000_000,
    maxOutputTokens: 16000,
    monthlyBudgetMicros: 50_000_000,
  } satisfies AiSettings,
  maintenance: { enabled: false, message: "Maintenance en cours, merci de réessayer dans quelques minutes.", blockInstalls: false } satisfies MaintenanceSettings,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
type SettingValue<K extends SettingKey> = K extends "ai" ? AiSettings : MaintenanceSettings;

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const [row] = await getDb().select().from(appSettings).where(eq(appSettings.key, key));
  return { ...SETTING_DEFAULTS[key], ...((row?.value as object) ?? {}) } as SettingValue<K>;
}

export async function setSetting<K extends SettingKey>(key: K, value: SettingValue<K>, updatedBy?: string) {
  await getDb()
    .insert(appSettings)
    .values({ key, value, updatedBy: updatedBy ?? null })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date(), updatedBy: updatedBy ?? null } });
}
