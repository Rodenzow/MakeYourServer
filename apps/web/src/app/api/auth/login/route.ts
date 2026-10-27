import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { randomToken } from "@/lib/crypto";
import { authorizeUrl } from "@/lib/discord-oauth";
import { discordConfigured, env } from "@/lib/env";

export async function GET(req: NextRequest) {
  if (!discordConfigured()) {
    return NextResponse.redirect(new URL("/connexion?erreur=config", env.appUrl));
  }
  const state = randomToken(24);
  const next = req.nextUrl.searchParams.get("suivant");
  const jar = await cookies();
  // L’état anti-CSRF et la page de retour sont conservés 10 minutes.
  jar.set("mys_oauth", JSON.stringify({ state, next: next?.startsWith("/") && !next.startsWith("//") ? next : "/tableau-de-bord" }), {
    httpOnly: true,
    secure: env.appUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(authorizeUrl(state));
}
