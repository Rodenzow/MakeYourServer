import { describe, expect, it } from "vitest";
import { decideHealth, INITIAL_HEALTH, isDiscordWebhook, scrub, type HealthState } from "../src/health";

/** Enchaîne des contrôles en supposant chaque alerte bien envoyée. */
function run(statuts: string[]) {
  let state: HealthState = INITIAL_HEALTH;
  const alerts: string[] = [];
  statuts.forEach((s, i) => {
    const d = decideHealth(state, s, i * 300_000);
    if (d.alert) alerts.push(d.alert);
    state = d.next;
  });
  return { state, alerts };
}

describe("suivi de l’état du bot", () => {
  it("n’alerte pas sur un seul contrôle raté (redémarrage)", () => {
    expect(run(["connecté", "démarrage", "connecté"]).alerts).toEqual([]);
  });

  it("alerte une seule fois après deux contrôles ratés, puis annonce le rétablissement", () => {
    const { alerts, state } = run(["connecté", "erreur", "erreur", "erreur", "injoignable", "connecté", "connecté"]);
    expect(alerts).toEqual(["down", "up"]);
    expect(state).toEqual(INITIAL_HEALTH);
  });

  it("réessaie au contrôle suivant si l’alerte n’a pas pu partir", () => {
    const first = decideHealth(INITIAL_HEALTH, "erreur", 0);
    const second = decideHealth(first.next, "erreur", 300_000);
    expect(second.alert).toBe("down");
    const third = decideHealth(second.ifUnsent, "erreur", 600_000);
    expect(third.alert).toBe("down");
    expect(third.next.since).toBe(0);
  });

  it("masque jetons et adresses dans les détails", () => {
    const token = `${"a".repeat(26)}.${"b".repeat(6)}.${"c".repeat(27)}`;
    const out = scrub(`Jeton ${token} refusé ; base postgres://u:motdepasse@hote:5432/db injoignable`);
    expect(out).not.toContain(token);
    expect(out).not.toContain("motdepasse");
  });

  it("n’accepte que les webhooks Discord", () => {
    expect(isDiscordWebhook("https://discord.com/api/webhooks/1/x")).toBe(true);
    expect(isDiscordWebhook("https://exemple.com/api/webhooks/1/x")).toBe(false);
    expect(isDiscordWebhook(undefined)).toBe(false);
  });
});
