import { createHash, randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, getDb, sessions, users } from "./db";

/** Essai gratuit : une conception IA offerte une seule fois aux comptes gratuits (fournisseur simulé). */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";

async function session(discordId: string, username: string) {
  const db = getDb();
  const [u] = await db.insert(users).values({ discordId, username }).onConflictDoUpdate({ target: users.discordId, set: { username } }).returning();
  const token = randomBytes(24).toString("base64url");
  await db.insert(sessions).values({ tokenHash: createHash("sha256").update(token).digest("hex"), userId: u!.id, expiresAt: new Date(Date.now() + 3600_000) });
  return `mys_session=${token}`;
}

const generate = (cookie: string) =>
  fetch(`${BASE}/api/ai/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE, Cookie: cookie },
    body: JSON.stringify({ description: "Un serveur pour une petite communauté de joueurs de jeux de société.", theme: "gaming", size: "small" }),
  });

afterAll(closeDb);

describe("essai de la conception IA", () => {
  it("offre une conception, puis demande le Premium", async () => {
    const cookie = await session("800000000000000008", "essai-e2e");
    const first = await generate(cookie);
    expect(first.status).toBe(200);
    expect((await first.json()).spec.meta.theme).toBe("gaming");
    const second = await generate(cookie);
    expect(second.status).toBe(402);
    expect((await second.json()).code).toBe("premium_required");
  });

  it("refuse toujours les modifications IA en gratuit", async () => {
    const cookie = await session("800000000000000009", "essai-edit-e2e");
    const r = await fetch(`${BASE}/api/ai/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE, Cookie: cookie },
      body: JSON.stringify({ projectId: "00000000-0000-0000-0000-000000000000", instruction: "Ajoute un salon" }),
    });
    expect([402, 404]).toContain(r.status);
  });
});
