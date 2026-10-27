import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import type { z } from "zod";
import { logError } from "@mys/db";
import { AccessDeniedError, BotMissingError, InstallError, QuotaError, GatewayError } from "@mys/engine";
import { env } from "./env";
import { SESSION_COOKIE, userFromToken, type CurrentUser } from "./session";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export const json = (data: unknown, init?: number | ResponseInit) => NextResponse.json(data, typeof init === "number" ? { status: init } : init);

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return json({ error: e.message, code: e.code }, e.status);
  if (e instanceof BotMissingError) return json({ error: e.message, code: "bot_missing", guildId: e.guildId }, 409);
  if (e instanceof AccessDeniedError) return json({ error: e.message, code: "forbidden" }, 403);
  if (e instanceof QuotaError) return json({ error: e.message, code: "quota" }, 402);
  if (e instanceof InstallError) return json({ error: e.message, code: e.status === 428 ? "confirmation_required" : "install" }, e.status);
  if (e instanceof GatewayError) return json({ error: e.message, code: "discord" }, e.status >= 500 || e.status === 0 ? 502 : 409);
  void logError("web", e instanceof Error ? e.message : "Erreur inconnue", { stack: e instanceof Error ? e.stack?.slice(0, 1500) : undefined });
  return json({ error: "Une erreur inattendue est survenue. Réessayez dans un instant." }, 500);
}

/**
 * Protection CSRF : toute requête qui modifie des données doit provenir du site
 * lui-même (en-tête Origin), en plus du cookie SameSite=Lax.
 */
function checkOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const allowed = new URL(env.appUrl).origin;
  const self = req.nextUrl.origin;
  if (!origin || (origin !== allowed && origin !== self)) throw new HttpError(403, "Requête refusée (origine non autorisée).", "bad_origin");
}

type Ctx<P> = { params: Promise<P> };
type Handler<P> = (req: NextRequest, user: CurrentUser, params: P) => Promise<Response>;

export function withUser<P = Record<string, string>>(handler: Handler<P>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      checkOrigin(req);
      const jar = await cookies();
      const user = await userFromToken(jar.get(SESSION_COOKIE)?.value);
      if (!user) throw new HttpError(401, "Connectez-vous avec Discord pour continuer.", "unauthenticated");
      if (user.suspendedAt) throw new HttpError(403, "Votre compte est suspendu.", "suspended");
      return await handler(req, user, await ctx.params);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/** Routes d’administration : la vérification est faite côté serveur, à chaque requête. */
export function withAdmin<P = Record<string, string>>(handler: Handler<P>) {
  return withUser<P>(async (req, user, params) => {
    if (!user.isAdmin) throw new HttpError(403, "Accès réservé à l’administration.", "not_admin");
    return handler(req, user, params);
  });
}

export function withPublic<P = Record<string, string>>(handler: (req: NextRequest, user: CurrentUser | null, params: P) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      const jar = await cookies();
      const user = await userFromToken(jar.get(SESSION_COOKIE)?.value);
      return await handler(req, user, await ctx.params);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function parseBody<T extends z.ZodType>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Corps de requête invalide (JSON attendu).");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new HttpError(400, `Données invalides : ${first?.path.join(".") || "racine"} — ${first?.message}`, "validation");
  }
  return parsed.data;
}
