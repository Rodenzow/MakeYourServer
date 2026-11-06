import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DISCORD_CHANNEL_TYPE, toBitfield } from "@mys/core";
import { eq, getDb, plans, scheduledMessages, subscriptions } from "@mys/db";
import {
  AccessDeniedError,
  FakeGateway,
  GatewayError,
  QuotaError,
  ScheduledMessageError,
  createScheduledMessage,
  deleteScheduledMessage,
  runDueScheduledMessages,
  setScheduledMessagePaused,
  updateScheduledMessage,
  type ScheduledMessageInput,
} from "../src";
import { createUser, resetDb, setupDb, teardownDb } from "./helpers";

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(resetDb);

const MANAGER_ROLE = "200000000000000222";
const MANAGER_ID = "300000000000000003";

function setup() {
  const gw = FakeGateway.emptyGuild();
  const text = gw.state.channels.find((c) => c.type === DISCORD_CHANNEL_TYPE.text)!;
  const voice = gw.state.channels.find((c) => c.type === DISCORD_CHANNEL_TYPE.voice)!;
  gw.state.roles.push({ id: MANAGER_ROLE, name: "Modération", color: 0, hoist: false, mentionable: false, permissions: toBitfield(["MANAGE_GUILD"]).toString(), position: 1, managed: false });
  gw.members.set(MANAGER_ID, [MANAGER_ROLE]);
  return { gw, text, voice };
}

async function premiumUser(discordId: string) {
  const u = await createUser(discordId);
  await getDb().insert(subscriptions).values({ userId: u.id, planKey: "premium", provider: "manual", providerRef: `test-${discordId}`, status: "active" });
  return u;
}

const inMinutes = (m: number) => new Date(Date.now() + m * 60_000);
const sent = (gw: FakeGateway) => gw.calls.filter((c) => c.method === "sendMessage");

function input(guildId: string, channelId: string, extra: Partial<ScheduledMessageInput> = {}): ScheduledMessageInput {
  return { guildId, channelId, content: "Rappel : soirée jeux ce soir @everyone !", nextRunAt: inMinutes(10), repeat: "none", ...extra };
}

async function row(id: string) {
  const [r] = await getDb().select().from(scheduledMessages).where(eq(scheduledMessages.id, id));
  return r!;
}

describe("création", () => {
  it("est réservée au Premium", async () => {
    const { gw, text } = setup();
    const u = await createUser(gw.state.ownerId);
    await expect(createScheduledMessage(gw, u, input(gw.state.id, text.id))).rejects.toBeInstanceOf(QuotaError);
  });

  it("exige « Gérer le serveur »", async () => {
    const { gw, text } = setup();
    const u = await premiumUser("400000000000000004");
    gw.members.set("400000000000000004", []);
    await expect(createScheduledMessage(gw, u, input(gw.state.id, text.id))).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("valide le salon, la date et le contenu", async () => {
    const { gw, text, voice } = setup();
    const u = await premiumUser(gw.state.ownerId);
    await expect(createScheduledMessage(gw, u, input(gw.state.id, voice.id))).rejects.toThrow(/textuel ou d’annonces/);
    await expect(createScheduledMessage(gw, u, input(gw.state.id, text.id, { nextRunAt: inMinutes(-5) }))).rejects.toThrow(/futur/);
    await expect(createScheduledMessage(gw, u, input(gw.state.id, text.id, { content: "  " }))).rejects.toBeInstanceOf(ScheduledMessageError);
    await expect(createScheduledMessage(gw, u, input(gw.state.id, "123456789012345678"))).rejects.toThrow(/n’existe pas/);
  });

  it("respecte le quota de messages actifs", async () => {
    const { gw, text } = setup();
    const u = await premiumUser(gw.state.ownerId);
    const [premium] = await getDb().select().from(plans).where(eq(plans.key, "premium"));
    await getDb().update(plans).set({ quotas: { ...premium!.quotas, scheduledMessages: 1 } }).where(eq(plans.key, "premium"));
    const first = await createScheduledMessage(gw, u, input(gw.state.id, text.id));
    expect(first.channelName).toBe(text.name);
    await expect(createScheduledMessage(gw, u, input(gw.state.id, text.id))).rejects.toBeInstanceOf(QuotaError);
    // Une mise en pause libère la place ; la reprise est alors refusée tant que le quota est plein.
    await setScheduledMessagePaused(gw, u, first.id, true);
    const second = await createScheduledMessage(gw, u, input(gw.state.id, text.id));
    await expect(setScheduledMessagePaused(gw, u, first.id, false)).rejects.toBeInstanceOf(QuotaError);
    expect(await deleteScheduledMessage(u.id, second.id)).toBe(true);
    expect((await setScheduledMessagePaused(gw, u, first.id, false)).status).toBe("active");
  });
});

describe("envoi", () => {
  it("envoie le contenu et l’encadré sans aucune mention, puis passe à « envoyé »", async () => {
    const { gw, text } = setup();
    const u = await premiumUser(gw.state.ownerId);
    const m = await createScheduledMessage(gw, u, input(gw.state.id, text.id, { embedTitle: "Soirée jeux", embedDescription: "Rendez-vous à 21 h.", embedColor: 0x83a8f3 }));

    expect((await runDueScheduledMessages(gw, inMinutes(5))).sent).toBe(0);
    expect(sent(gw)).toHaveLength(0);

    const r = await runDueScheduledMessages(gw, new Date(m.nextRunAt!.getTime() + 1000));
    expect(r.sent).toBe(1);
    const [, body] = sent(gw)[0]!.args as [string, Record<string, unknown>];
    expect(sent(gw)[0]!.args[0]).toBe(text.id);
    expect(body.allowed_mentions).toEqual({ parse: [] });
    expect(body.content).toBe("Rappel : soirée jeux ce soir @everyone !");
    expect(body.embeds).toEqual([{ title: "Soirée jeux", description: "Rendez-vous à 21 h.", color: 0x83a8f3 }]);
    expect(gw.messages.get(text.id)).toHaveLength(1);

    const after = await row(m.id);
    expect(after.status).toBe("done");
    expect(after.lastSentAt).toBeTruthy();
    // Un nouveau passage n’envoie rien de plus.
    await runDueScheduledMessages(gw, new Date(m.nextRunAt!.getTime() + 60_000));
    expect(sent(gw)).toHaveLength(1);
  });

  it("répète chaque jour ou chaque semaine en recalculant le prochain envoi", async () => {
    const { gw, text } = setup();
    const u = await premiumUser(gw.state.ownerId);
    const daily = await createScheduledMessage(gw, u, input(gw.state.id, text.id, { repeat: "daily" }));
    const weekly = await createScheduledMessage(gw, u, input(gw.state.id, text.id, { repeat: "weekly", nextRunAt: daily.nextRunAt! }));
    const t0 = daily.nextRunAt!.getTime();

    expect((await runDueScheduledMessages(gw, new Date(t0 + 1000))).sent).toBe(2);
    const d1 = await row(daily.id);
    const w1 = await row(weekly.id);
    expect(d1.status).toBe("active");
    expect(Math.round((d1.nextRunAt!.getTime() - t0) / 3600_000)).toBeGreaterThanOrEqual(23);
    expect(Math.round((d1.nextRunAt!.getTime() - t0) / 3600_000)).toBeLessThanOrEqual(25);
    expect(Math.round((w1.nextRunAt!.getTime() - t0) / 86400_000)).toBe(7);

    // Même instant : rien de plus. Le lendemain : seul le message quotidien part.
    expect((await runDueScheduledMessages(gw, new Date(t0 + 2000))).sent).toBe(0);
    expect((await runDueScheduledMessages(gw, new Date(d1.nextRunAt!.getTime() + 1000))).sent).toBe(1);
    expect(sent(gw)).toHaveLength(3);
  });

  it("n’envoie jamais deux fois la même occurrence avec plusieurs workers", async () => {
    const { gw, text } = setup();
    const u = await premiumUser(gw.state.ownerId);
    const at = inMinutes(10);
    for (let i = 0; i < 6; i++) await createScheduledMessage(gw, u, input(gw.state.id, text.id, { content: `Message ${i}`, nextRunAt: at }));
    const now = new Date(at.getTime() + 1000);
    const results = await Promise.all([runDueScheduledMessages(gw, now), runDueScheduledMessages(gw, now), runDueScheduledMessages(gw, now)]);
    expect(results.reduce((n, r) => n + r.sent, 0)).toBe(6);
    const contents = sent(gw).map((c) => (c.args[1] as { content: string }).content).sort();
    expect(contents).toEqual(["Message 0", "Message 1", "Message 2", "Message 3", "Message 4", "Message 5"]);
  });

  it("annule l’envoi si le créateur ne gère plus le serveur", async () => {
    const { gw, text } = setup();
    const u = await premiumUser(MANAGER_ID);
    const m = await createScheduledMessage(gw, u, input(gw.state.id, text.id, { repeat: "daily" }));
    gw.members.set(MANAGER_ID, []);
    const r = await runDueScheduledMessages(gw, new Date(m.nextRunAt!.getTime() + 1000));
    expect(r).toMatchObject({ sent: 0, failed: 1 });
    expect(sent(gw)).toHaveLength(0);
    const after = await row(m.id);
    expect(after.status).toBe("failed");
    expect(after.lastError).toMatch(/Gérer le serveur/);
    // La reprise revérifie les droits.
    await expect(setScheduledMessagePaused(gw, u, m.id, false, new Date(m.nextRunAt!.getTime() + 2000))).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("suspend l’envoi si le compte n’a plus le Premium", async () => {
    const { gw, text } = setup();
    const u = await premiumUser(gw.state.ownerId);
    const m = await createScheduledMessage(gw, u, input(gw.state.id, text.id));
    await getDb().update(subscriptions).set({ status: "canceled" }).where(eq(subscriptions.userId, u.id));
    await runDueScheduledMessages(gw, new Date(m.nextRunAt!.getTime() + 1000));
    expect(sent(gw)).toHaveLength(0);
    const after = await row(m.id);
    expect(after.status).toBe("failed");
    expect(after.lastError).toMatch(/Premium/);
  });

  it("réessaie si Discord est indisponible, échoue clairement sinon", async () => {
    const { gw, text } = setup();
    const u = await premiumUser(gw.state.ownerId);
    const m = await createScheduledMessage(gw, u, input(gw.state.id, text.id));
    const now = new Date(m.nextRunAt!.getTime() + 1000);
    gw.failures.push({ method: "sendMessage", error: new GatewayError("Discord indisponible", 0, 503, true), times: 1 });
    expect((await runDueScheduledMessages(gw, now)).retried).toBe(1);
    expect((await row(m.id)).status).toBe("active");
    expect((await runDueScheduledMessages(gw, new Date(now.getTime() + 30_000))).sent).toBe(1);
    expect((await row(m.id)).lastError).toBeNull();

    const m2 = await createScheduledMessage(gw, u, input(gw.state.id, text.id));
    gw.state.channels = gw.state.channels.filter((c) => c.id !== text.id);
    await runDueScheduledMessages(gw, new Date(m2.nextRunAt!.getTime() + 1000));
    const failed = await row(m2.id);
    expect(failed.status).toBe("failed");
    expect(failed.lastError).toMatch(/Salon introuvable/);
  });

  it("signale un envoi manqué après une longue indisponibilité", async () => {
    const { gw, text } = setup();
    const u = await premiumUser(gw.state.ownerId);
    const once = await createScheduledMessage(gw, u, input(gw.state.id, text.id));
    const daily = await createScheduledMessage(gw, u, input(gw.state.id, text.id, { repeat: "daily", nextRunAt: once.nextRunAt! }));
    const late = new Date(once.nextRunAt!.getTime() + 30 * 3600_000);
    expect((await runDueScheduledMessages(gw, late)).missed).toBe(2);
    expect(sent(gw)).toHaveLength(0);
    expect((await row(once.id)).status).toBe("failed");
    const d = await row(daily.id);
    expect(d.status).toBe("active");
    expect(d.nextRunAt!.getTime()).toBeGreaterThan(late.getTime());
    expect(d.lastError).toMatch(/manqué/);
  });
});

describe("modification et pause", () => {
  it("modifie, met en pause puis reprend (un message en pause n’est pas envoyé)", async () => {
    const { gw, text } = setup();
    const u = await premiumUser(gw.state.ownerId);
    const m = await createScheduledMessage(gw, u, input(gw.state.id, text.id));
    const updated = await updateScheduledMessage(gw, u, m.id, input(gw.state.id, text.id, { content: "Nouveau texte", repeat: "weekly", nextRunAt: inMinutes(60) }));
    expect(updated).toMatchObject({ content: "Nouveau texte", repeat: "weekly", status: "active" });

    await setScheduledMessagePaused(gw, u, m.id, true);
    expect((await runDueScheduledMessages(gw, inMinutes(61))).sent).toBe(0);
    // Reprise après la date prévue : le prochain envoi est recalculé dans le futur.
    const resumed = await setScheduledMessagePaused(gw, u, m.id, false, inMinutes(61));
    expect(resumed.status).toBe("active");
    expect(resumed.nextRunAt!.getTime()).toBeGreaterThan(inMinutes(61).getTime());
  });

  it("ne laisse personne d’autre modifier ou supprimer le message", async () => {
    const { gw, text } = setup();
    const u = await premiumUser(gw.state.ownerId);
    const other = await premiumUser(MANAGER_ID);
    const m = await createScheduledMessage(gw, u, input(gw.state.id, text.id));
    await expect(updateScheduledMessage(gw, other, m.id, input(gw.state.id, text.id))).rejects.toThrow(/introuvable/);
    await expect(setScheduledMessagePaused(gw, other, m.id, true)).rejects.toThrow(/introuvable/);
    expect(await deleteScheduledMessage(other.id, m.id)).toBe(false);
    expect(await deleteScheduledMessage(u.id, m.id)).toBe(true);
  });
});
