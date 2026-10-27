import { getDb } from "./client";
import { auditLogs, errorLogs } from "./schema";

const SECRET_KEY_RE = /(token|secret|password|passwd|authorization|cookie|api[-_]?key|signature|session|refresh|access)/i;
const SECRET_VALUE_RE = /([A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{20,}|sk_(live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|sk-ant-[A-Za-z0-9_-]+|Bot\s+[A-Za-z0-9._-]+)/g;

/** Retire les secrets et tronque les contenus avant d’écrire un log. */
export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[…]";
  if (value == null) return value;
  if (typeof value === "string") return value.replace(SECRET_VALUE_RE, "[masqué]").slice(0, 500);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Error) return { name: value.name, message: sanitize(value.message, depth + 1) };
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
      out[k] = SECRET_KEY_RE.test(k) ? "[masqué]" : sanitize(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

export async function logError(source: "web" | "bot" | "worker", message: string, context: Record<string, unknown> = {}, level: "error" | "warn" = "error") {
  const clean = String(sanitize(message));
  try {
    await getDb().insert(errorLogs).values({ source, level, message: clean, context: sanitize(context) as Record<string, unknown> });
  } catch (e) {
    console.error("[logError] impossible d’écrire le log", e);
  }
  if (level === "error") console.error(`[${source}] ${clean}`);
}

export interface AuditInput {
  actorUserId?: string | null;
  actorType: "user" | "admin" | "system" | "bot";
  action: string;
  targetType?: string;
  targetId?: string;
  guildId?: string;
  metadata?: Record<string, unknown>;
}

export async function audit(input: AuditInput) {
  try {
    await getDb()
      .insert(auditLogs)
      .values({ ...input, actorUserId: input.actorUserId ?? null, metadata: sanitize(input.metadata ?? {}) as Record<string, unknown> });
  } catch (e) {
    console.error("[audit] impossible d’écrire le journal", e);
  }
}
