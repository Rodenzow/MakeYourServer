import { NextResponse, type NextRequest } from "next/server";
import { getDb, users } from "@mys/db";
import { env } from "@/lib/env";
import { createSession } from "@/lib/session";

/**
 * Connexion de développement (DEV_LOGIN=true, jamais en production) :
 * permet de tester le site sans application Discord. Refusée sinon.
 */
export async function POST(req: NextRequest) {
  if (!env.devLogin) return NextResponse.json({ error: "Indisponible." }, { status: 404 });
  const form = await req.formData();
  const discordId = String(form.get("discordId") || "100000000000000001");
  if (!/^\d{17,20}$/.test(discordId)) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  const username = String(form.get("username") || "testeur");
  const [user] = await getDb()
    .insert(users)
    .values({ discordId, username, lastLoginAt: new Date() })
    .onConflictDoUpdate({ target: users.discordId, set: { lastLoginAt: new Date() } })
    .returning();
  await createSession(user!.id, req.headers.get("user-agent"));
  return NextResponse.redirect(new URL(String(form.get("suivant") || "/tableau-de-bord"), env.appUrl), { status: 303 });
}
