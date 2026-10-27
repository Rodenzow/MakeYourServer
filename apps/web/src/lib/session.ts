import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { and, eq, getDb, gt, sessions, users } from "@mys/db";
import { randomToken, sha256 } from "./crypto";
import { env } from "./env";

export const SESSION_COOKIE = "mys_session";
const SESSION_DAYS = 30;

export type User = typeof users.$inferSelect;
export interface CurrentUser extends User {
  isAdmin: boolean;
}

/**
 * Le statut administrateur provient UNIQUEMENT de la variable ADMIN_DISCORD_IDS
 * (configuration serveur). Aucune donnée modifiable par un utilisateur ne l’accorde.
 */
export function isAdminDiscordId(discordId: string) {
  return env.adminDiscordIds.includes(discordId);
}

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await getDb().insert(sessions).values({ tokenHash: sha256(token), userId, expiresAt, userAgent: userAgent?.slice(0, 300) ?? null });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.appUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

export async function userFromToken(token: string | undefined): Promise<CurrentUser | null> {
  if (!token) return null;
  const rows = await getDb()
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())));
  const user = rows[0]?.user;
  if (!user) return null;
  return { ...user, isAdmin: isAdminDiscordId(user.discordId) };
}

/** Utilisateur courant (mis en cache pour la durée de la requête). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
});

export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion${next ? `?suivant=${encodeURIComponent(next)}` : ""}`);
  if (user.suspendedAt) redirect("/compte-suspendu");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser("/admin");
  if (!user.isAdmin) redirect("/tableau-de-bord");
  return user;
}
