import { beforeEach, describe, expect, it } from "vitest";
import { alertInstallationProblem, alertPayload, isDiscordWebhookUrl, resetAlertThrottle, sendAlert, takeAlertSlot } from "../src/alerts";

const HOOK = "https://discord.com/api/webhooks/123/abc";

function recorder() {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(null, { status: 204 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe("alertes Discord", () => {
  beforeEach(() => resetAlertThrottle());

  it("n’accepte que des webhooks Discord en https", () => {
    expect(isDiscordWebhookUrl(HOOK)).toBe(true);
    expect(isDiscordWebhookUrl("https://canary.discord.com/api/webhooks/1/x")).toBe(true);
    expect(isDiscordWebhookUrl("http://discord.com/api/webhooks/1/x")).toBe(false);
    expect(isDiscordWebhookUrl("https://exemple.com/api/webhooks/1/x")).toBe(false);
    expect(isDiscordWebhookUrl("pas une adresse")).toBe(false);
    expect(isDiscordWebhookUrl(undefined)).toBe(false);
  });

  it("ne mentionne personne et masque les secrets", () => {
    const p = alertPayload({ title: "Test", description: "jeton sk_live_abcdef123456 fuité", fields: [{ name: "x", value: "" }] });
    expect(p.allowed_mentions.parse).toEqual([]);
    expect(p.embeds[0]!.description).not.toContain("sk_live_abcdef123456");
    expect(p.embeds[0]!.fields[0]!.value).toBe("—");
  });

  it("n’envoie rien sans webhook et ne lève jamais d’erreur", async () => {
    const { calls, fetchImpl } = recorder();
    expect(await sendAlert({ title: "x" }, { webhookUrl: "", fetchImpl })).toBe(false);
    expect(calls).toHaveLength(0);
    const failing = (async () => {
      throw new Error("réseau coupé");
    }) as unknown as typeof fetch;
    expect(await sendAlert({ title: "x" }, { webhookUrl: HOOK, fetchImpl: failing })).toBe(false);
  });

  it("limite à une alerte par serveur et par heure", () => {
    const t0 = 1_000_000;
    expect(takeAlertSlot("guild:1", t0)).toBe(true);
    expect(takeAlertSlot("guild:1", t0 + 60_000)).toBe(false);
    expect(takeAlertSlot("guild:2", t0 + 60_000)).toBe(true);
    expect(takeAlertSlot("guild:1", t0 + 3_600_000)).toBe(true);
  });

  it("plafonne le nombre total d’alertes par heure", () => {
    const t0 = 5_000_000;
    let sent = 0;
    for (let i = 0; i < 30; i++) if (takeAlertSlot(`guild:${i}`, t0 + i)) sent++;
    expect(sent).toBe(20);
  });

  it("alerte sur une installation en échec, sans les simulations", async () => {
    const { calls, fetchImpl } = recorder();
    const base = { installationId: "0f1e2d3c-aaaa-bbbb-cccc-1234567890ab", guildId: "42", kind: "install", status: "partial" as const, failedSteps: 2, totalSteps: 30 };
    expect(await alertInstallationProblem({ ...base, dryRun: true }, { webhookUrl: HOOK, fetchImpl })).toBe(false);
    expect(await alertInstallationProblem(base, { webhookUrl: HOOK, fetchImpl })).toBe(true);
    expect(await alertInstallationProblem({ ...base, status: "failed" }, { webhookUrl: HOOK, fetchImpl })).toBe(false); // même serveur, < 1 h
    expect(calls).toHaveLength(1);
    const embed = (calls[0]!.body.embeds as { title: string; fields: { name: string; value: string }[] }[])[0]!;
    expect(embed.title).toMatch(/partiellement/);
    expect(embed.fields.find((f) => f.name === "Étapes en échec")?.value).toBe("2 sur 30");
  });
});
