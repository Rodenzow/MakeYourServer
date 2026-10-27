import "server-only";
import { eq, getDb, oauthTokens } from "@mys/db";
import { decrypt, encrypt } from "./crypto";
import { env } from "./env";

const API = "https://discord.com/api/v10";
export const OAUTH_SCOPES = ["identify", "guilds"];

export function authorizeUrl(state: string) {
  const p = new URLSearchParams({
    client_id: env.discordClientId,
    response_type: "code",
    redirect_uri: `${env.appUrl}/api/auth/callback`,
    scope: OAUTH_SCOPES.join(" "),
    state,
    prompt: "none",
  });
  return `https://discord.com/oauth2/authorize?${p}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.discordClientId, client_secret: env.discordClientSecret, ...body }),
  });
  if (!res.ok) throw new Error(`Échange OAuth refusé par Discord (${res.status}).`);
  return res.json();
}

export const exchangeCode = (code: string) => tokenRequest({ grant_type: "authorization_code", code, redirect_uri: `${env.appUrl}/api/auth/callback` });

export async function fetchDiscordUser(accessToken: string) {
  const res = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error("Impossible de lire votre profil Discord.");
  return (await res.json()) as { id: string; username: string; global_name: string | null; avatar: string | null };
}

export async function storeTokens(userId: string, t: TokenResponse) {
  const values = {
    userId,
    accessTokenEnc: encrypt(t.access_token),
    refreshTokenEnc: encrypt(t.refresh_token),
    scope: t.scope,
    expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000),
  };
  await getDb()
    .insert(oauthTokens)
    .values(values)
    .onConflictDoUpdate({ target: oauthTokens.userId, set: { ...values, updatedAt: new Date() } });
}

/** Jeton d’accès valide (rafraîchi si besoin) ou null si l’utilisateur doit se reconnecter. */
export async function getAccessToken(userId: string): Promise<string | null> {
  const [row] = await getDb().select().from(oauthTokens).where(eq(oauthTokens.userId, userId));
  if (!row) return null;
  if (row.expiresAt.getTime() > Date.now()) return decrypt(row.accessTokenEnc);
  try {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(row.refreshTokenEnc) });
    await storeTokens(userId, t);
    return t.access_token;
  } catch {
    return null;
  }
}

export interface OAuthGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

const guildCache = new Map<string, { at: number; guilds: OAuthGuild[] }>();

/** Serveurs de l’utilisateur (cache court : l’endpoint Discord est strictement limité). */
export async function fetchUserGuilds(userId: string, force = false): Promise<OAuthGuild[] | null> {
  const cached = guildCache.get(userId);
  if (!force && cached && Date.now() - cached.at < 60_000) return cached.guilds;
  const token = await getAccessToken(userId);
  if (!token) return null;
  const res = await fetch(`${API}/users/@me/guilds`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 429 && cached) return cached.guilds;
  if (!res.ok) return null;
  const guilds = (await res.json()) as OAuthGuild[];
  guildCache.set(userId, { at: Date.now(), guilds });
  return guilds;
}
