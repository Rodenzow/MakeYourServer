import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { claimJob, completeJob, enqueueJob, eq, failJob, getDb, jobs, sql } from "@mys/db";
import { resetDb, setupDb, teardownDb } from "./helpers";

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(resetDb);

describe("file de tâches persistante", () => {
  it("ne duplique pas une tâche déjà en file (clé de déduplication)", async () => {
    const a = await enqueueJob("t", { x: 1 }, { dedupeKey: "k1" });
    const b = await enqueueJob("t", { x: 1 }, { dedupeKey: "k1" });
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.id).toBe(a.id);
  });

  it("un seul worker obtient une tâche donnée", async () => {
    await enqueueJob("t", {});
    const [a, b] = await Promise.all([claimJob("w1"), claimJob("w2")]);
    expect([a, b].filter(Boolean).length).toBe(1);
  });

  it("reprend une tâche dont le worker s’est arrêté (bail expiré)", async () => {
    await enqueueJob("t", {});
    const first = await claimJob("w1", 50);
    expect(first).toBeTruthy();
    expect(await claimJob("w2", 50)).toBeNull();
    await new Promise((r) => setTimeout(r, 120));
    const again = await claimJob("w2", 60_000);
    expect(again?.id).toBe(first!.id);
    expect(again?.attempts).toBe(2);
    await completeJob(again!.id, "w2");
    const [row] = await getDb().select().from(jobs).where(eq(jobs.id, again!.id));
    expect(row!.status).toBe("succeeded");
  });

  it("réessaie avec délai puis échoue définitivement après le maximum", async () => {
    await enqueueJob("t", {}, { maxAttempts: 2 });
    let job = await claimJob("w");
    await failJob(job!, "w", "erreur 1");
    await getDb().execute(sql`update jobs set run_at = now()`);
    job = await claimJob("w");
    expect(job!.attempts).toBe(2);
    await failJob(job!, "w", "erreur 2");
    const [row] = await getDb().select().from(jobs).where(eq(jobs.id, job!.id));
    expect(row!.status).toBe("failed");
    expect(row!.lastError).toBe("erreur 2");
  });
});
