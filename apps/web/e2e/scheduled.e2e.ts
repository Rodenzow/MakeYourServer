import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appSettings, closeDb, eq, getDb, scheduledMessages, sessions, subscriptions, sql, users } from "@mys/db";
import { dateToParisInput } from "@mys/core";

/**
 * Messages programmés (Premium) sur le serveur simulé : présentation pour un compte
 * gratuit, création avec contrôle des droits, envoi par le worker du bac à sable,
 * puis annulation quand les droits ou le Premium disparaissent.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const GUILD = "100000000000000000";

async function session(discordId: string, username: string) {
  const db = getDb();
  const [u] = await db.insert(users).values({ discordId, username }).onConflictDoUpdate({ target: users.discordId, set: { username } }).returning();
  const token = randomBytes(24).toString("base64url");
  await db.insert(sessions).values({ tokenHash: createHash("sha256").update(token).digest("hex"), userId: u!.id, expiresAt: new Date(Date.now() + 3600_000) });
  return { user: u!, cookie: `mys_session=${token}` };
}

const call = (path: string, init: RequestInit & { cookie?: string } = {}) =>
  fetch(`${BASE}${path}`, {
    ...init,
    redirect: "manual",
    headers: { "Content-Type": "application/json", Origin: BASE, "User-Agent": "Mozilla/5.0 e2e", ...(init.cookie ? { Cookie: init.cookie } : {}) },
  });

const inMinutes = (m: number) => dateToParisInput(new Date(Date.now() + m * 60_000));

async function waitFor<T>(fn: () => Promise<T | null | undefined | false>, timeoutMs = 50_000): Promise<T> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Délai dépassé en attendant le worker du bac à sable.");
}

async function row(id: string) {
  const [r] = await getDb().select().from(scheduledMessages).where(eq(scheduledMessages.id, id));
  return r!;
}

/** Rend le message immédiatement échu (le worker le traite au passage suivant, toutes les 30 s). */
const makeDue = (id: string) => getDb().update(scheduledMessages).set({ nextRunAt: sql`now() - interval '1 second'` }).where(eq(scheduledMessages.id, id));

let free: Awaited<ReturnType<typeof session>>;
let premium: Awaited<ReturnType<typeof session>>;
let other: Awaited<ReturnType<typeof session>>;
let textChannel = "";
let messageId = "";

const body = (extra: Record<string, unknown> = {}) => ({
  guildId: GUILD,
  channelId: textChannel,
  content: "Soirée jeux ce soir @everyone !",
  embedTitle: "Programme",
  embedDescription: "Tournoi à 21 h.",
  embedColor: 0x83a8f3,
  sendAt: inMinutes(30),
  repeat: "none",
  ...extra,
});

beforeAll(async () => {
  free = await session("510000000000000005", "gratuit-e2e");
  premium = await session("520000000000000005", "premium-e2e");
  other = await session("530000000000000005", "autre-e2e");
  for (const u of [premium, other]) {
    await getDb()
      .insert(subscriptions)
      .values({ userId: u.user.id, planKey: "premium", provider: "manual", providerRef: `e2e-sm-${u.user.discordId}`, status: "active" })
      .onConflictDoUpdate({ target: [subscriptions.provider, subscriptions.providerRef], set: { status: "active" } });
  }
});

afterAll(async () => {
  // Rend au compte de test ses droits dans le bac à sable (réattribués au prochain chargement).
  const [s] = await getDb().select().from(appSettings).where(eq(appSettings.key, "sandbox_guild"));
  if (s) {
    const value = s.value as { members: Record<string, string[]> };
    delete value.members[premium.user.discordId];
    await getDb().update(appSettings).set({ value }).where(eq(appSettings.key, "sandbox_guild"));
  }
  await closeDb();
});

describe("compte gratuit", () => {
  it("présente la fonction et renvoie vers l’abonnement", async () => {
    const html = await (await call("/messages-programmes", { cookie: free.cookie })).text();
    expect(html).toContain("Messages programmés");
    expect(html).toContain("Découvrir le Premium");
    expect(html).toContain('href="/abonnement"');
  });
  it("refuse la création (quota Premium)", async () => {
    const r = await call("/api/scheduled-messages", { method: "POST", cookie: free.cookie, body: JSON.stringify(body({ channelId: "100000000000000123" })) });
    expect(r.status).toBe(402);
  });
});

describe("création (Premium)", () => {
  it("exige une session", async () => {
    expect((await call("/api/scheduled-messages")).status).toBe(401);
  });
  it("liste les salons textuels et d’annonces du serveur", async () => {
    const r = await call(`/api/scheduled-messages/channels?guildId=${GUILD}`, { cookie: premium.cookie });
    expect(r.status).toBe(200);
    const { channels } = await r.json();
    expect(channels.length).toBeGreaterThan(0);
    textChannel = channels[0].id;
  });
  it("refuse un serveur sans le bot, une date passée et un message vide", async () => {
    expect((await call("/api/scheduled-messages", { method: "POST", cookie: premium.cookie, body: JSON.stringify(body({ guildId: "123456789012345678" })) })).status).toBe(409);
    expect((await call("/api/scheduled-messages", { method: "POST", cookie: premium.cookie, body: JSON.stringify(body({ sendAt: inMinutes(-10) })) })).status).toBe(400);
    expect((await call("/api/scheduled-messages", { method: "POST", cookie: premium.cookie, body: JSON.stringify(body({ content: "", embedTitle: null, embedDescription: null })) })).status).toBe(400);
  });
  it("enregistre le message et l’affiche avec l’heure de Paris", async () => {
    const r = await call("/api/scheduled-messages", { method: "POST", cookie: premium.cookie, body: JSON.stringify(body()) });
    expect(r.status).toBe(201);
    const { message } = await r.json();
    messageId = message.id;
    expect(message.status).toBe("active");
    const html = await (await call("/messages-programmes", { cookie: premium.cookie })).text();
    expect(html).toContain("Prochain envoi");
    expect(html).toContain("heure de Paris");
    expect(html).toContain(message.channelName);
  });
  it("interdit à un autre compte de lire, modifier ou supprimer le message", async () => {
    expect((await call(`/api/scheduled-messages/${messageId}`, { cookie: other.cookie })).status).toBe(404);
    expect((await call(`/api/scheduled-messages/${messageId}`, { method: "PUT", cookie: other.cookie, body: JSON.stringify(body()) })).status).toBe(404);
    expect((await call(`/api/scheduled-messages/${messageId}`, { method: "DELETE", cookie: other.cookie })).status).toBe(404);
  });
  it("met en pause puis reprend", async () => {
    const p = await call(`/api/scheduled-messages/${messageId}`, { method: "POST", cookie: premium.cookie, body: JSON.stringify({ action: "pause" }) });
    expect((await p.json()).message.status).toBe("paused");
    const r = await call(`/api/scheduled-messages/${messageId}`, { method: "POST", cookie: premium.cookie, body: JSON.stringify({ action: "resume" }) });
    expect((await r.json()).message.status).toBe("active");
  });
});

describe("envoi par le worker", () => {
  it("envoie le message échu puis le marque « envoyé »", async () => {
    await makeDue(messageId);
    const done = await waitFor(async () => {
      const r = await row(messageId);
      return r.status !== "active" ? r : null;
    });
    expect(done.status).toBe("done");
    expect(done.lastSentAt).toBeTruthy();
    expect(done.lastError).toBeNull();
  });

  it("annule l’envoi quand le Premium a disparu", async () => {
    const r = await call("/api/scheduled-messages", { method: "POST", cookie: other.cookie, body: JSON.stringify(body({ repeat: "daily" })) });
    expect(r.status).toBe(201);
    const { message } = await r.json();
    await getDb().update(subscriptions).set({ status: "canceled" }).where(eq(subscriptions.userId, other.user.id));
    await makeDue(message.id);
    const failed = await waitFor(async () => {
      const x = await row(message.id);
      return x.status === "failed" ? x : null;
    });
    expect(failed.lastError).toMatch(/Premium/);
    expect(failed.lastSentAt).toBeNull();
  });

  it("annule l’envoi quand le créateur ne gère plus le serveur", async () => {
    const r = await call("/api/scheduled-messages", { method: "POST", cookie: premium.cookie, body: JSON.stringify(body({ repeat: "weekly" })) });
    expect(r.status).toBe(201);
    const { message } = await r.json();
    // Retire ses rôles dans le serveur simulé (et la propriété, s’il l’avait).
    const [s] = await getDb().select().from(appSettings).where(eq(appSettings.key, "sandbox_guild"));
    const value = s!.value as { state: { ownerId: string }; members: Record<string, string[]> };
    if (value.state.ownerId === premium.user.discordId) value.state.ownerId = "100000000000000001";
    value.members[premium.user.discordId] = [];
    await getDb().update(appSettings).set({ value }).where(eq(appSettings.key, "sandbox_guild"));
    await makeDue(message.id);
    const failed = await waitFor(async () => {
      const x = await row(message.id);
      return x.status === "failed" ? x : null;
    });
    expect(failed.lastError).toMatch(/Gérer le serveur/);
    const html = await (await call("/messages-programmes", { cookie: premium.cookie })).text();
    expect(html).toContain("En échec");
  });

  it("laisse le créateur supprimer ses messages", async () => {
    expect((await call(`/api/scheduled-messages/${messageId}`, { method: "DELETE", cookie: premium.cookie })).status).toBe(200);
    expect((await call(`/api/scheduled-messages/${messageId}`, { cookie: premium.cookie })).status).toBe(404);
  });
});
