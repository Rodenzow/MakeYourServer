import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { audit, getDb, logError, users } from "@mys/db";
import { safeEqual } from "@/lib/crypto";
import { exchangeCode, fetchDiscordUser, storeTokens } from "@/lib/discord-oauth";
import { env } from "@/lib/env";
import { createSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const fail = (code: string) => NextResponse.redirect(new URL(`/connexion?erreur=${code}`, env.appUrl));
  const jar = await cookies();
  const raw = jar.get("mys_oauth")?.value;
  jar.delete("mys_oauth");
  const params = req.nextUrl.searchParams;
  if (params.get("error")) return fail("refus");
  const code = params.get("code");
  const state = params.get("state");
  let saved: { state: string; next: string } | null = null;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch {
    saved = null;
  }
  if (!code || !state || !saved || !safeEqual(state, saved.state)) return fail("etat");

  try {
    const tokens = await exchangeCode(code);
    const profile = await fetchDiscordUser(tokens.access_token);
    const db = getDb();
    const [user] = await db
      .insert(users)
      .values({ discordId: profile.id, username: profile.username, globalName: profile.global_name, avatar: profile.avatar, lastLoginAt: new Date() })
      .onConflictDoUpdate({
        target: users.discordId,
        set: { username: profile.username, globalName: profile.global_name, avatar: profile.avatar, lastLoginAt: new Date() },
      })
      .returning();
    if (user!.suspendedAt) return fail("suspendu");
    await storeTokens(user!.id, tokens);
    await createSession(user!.id, req.headers.get("user-agent"));
    await audit({ actorUserId: user!.id, actorType: "user", action: "auth.login" });
    return NextResponse.redirect(new URL(saved.next, env.appUrl));
  } catch (e) {
    await logError("web", "Connexion Discord échouée", { error: e });
    return fail("discord");
  }
}

// Empêche toute réutilisation par un tiers : la route n’accepte que GET.
export const dynamic = "force-dynamic";
