import { describe, expect, it } from "vitest";
import {
  addParisDays,
  buildScheduledMessagePayload,
  dateToParisInput,
  nextScheduledOccurrence,
  parisInputToDate,
  validateScheduledContent,
} from "../src";

describe("heure de Paris", () => {
  it("convertit l’heure murale de Paris en UTC (hiver et été)", () => {
    expect(parisInputToDate("2026-01-15T18:30")!.toISOString()).toBe("2026-01-15T17:30:00.000Z");
    expect(parisInputToDate("2026-07-15T18:30")!.toISOString()).toBe("2026-07-15T16:30:00.000Z");
    expect(parisInputToDate("2026-13-01T10:00")).toBeNull();
    expect(parisInputToDate("demain")).toBeNull();
  });

  it("fait l’aller-retour avec le format des champs datetime-local", () => {
    expect(dateToParisInput(new Date("2026-11-20T17:30:00Z"))).toBe("2026-11-20T18:30");
    expect(dateToParisInput(parisInputToDate("2026-03-29T09:05")!)).toBe("2026-03-29T09:05");
  });

  it("conserve l’heure de Paris en ajoutant des jours, même au changement d’heure", () => {
    // Passage à l’heure d’été dans la nuit du 28 au 29 mars 2026.
    const before = parisInputToDate("2026-03-28T20:00")!;
    expect(dateToParisInput(addParisDays(before, 1))).toBe("2026-03-29T20:00");
    expect(addParisDays(before, 1).getTime() - before.getTime()).toBe(23 * 3600_000);
    // Retour à l’heure d’hiver le 25 octobre 2026.
    const oct = parisInputToDate("2026-10-20T09:00")!;
    expect(dateToParisInput(addParisDays(oct, 7))).toBe("2026-10-27T09:00");
  });

  it("calcule la prochaine occurrence en sautant celles qui sont passées", () => {
    const from = parisInputToDate("2026-11-02T08:00")!;
    expect(nextScheduledOccurrence(from, "none", from)).toBeNull();
    expect(dateToParisInput(nextScheduledOccurrence(from, "daily", from)!)).toBe("2026-11-03T08:00");
    expect(dateToParisInput(nextScheduledOccurrence(from, "weekly", from)!)).toBe("2026-11-09T08:00");
    const late = parisInputToDate("2026-11-20T12:00")!;
    expect(dateToParisInput(nextScheduledOccurrence(from, "daily", late)!)).toBe("2026-11-21T08:00");
    expect(dateToParisInput(nextScheduledOccurrence(from, "weekly", late)!)).toBe("2026-11-23T08:00");
  });
});

describe("contenu d’un message programmé", () => {
  it("n’autorise aucune mention et n’ajoute l’encadré que s’il est rempli", () => {
    expect(buildScheduledMessagePayload({ content: " Bonjour @everyone " })).toEqual({ content: "Bonjour @everyone", allowed_mentions: { parse: [] } });
    expect(buildScheduledMessagePayload({ content: "", embedTitle: "Titre", embedColor: 0xff0000 })).toEqual({
      allowed_mentions: { parse: [] },
      embeds: [{ title: "Titre", color: 0xff0000 }],
    });
  });

  it("refuse un message vide ou trop long", () => {
    expect(validateScheduledContent({ content: "  " })).toMatch(/vide/);
    expect(validateScheduledContent({ content: "x".repeat(2001) })).toMatch(/2000/);
    expect(validateScheduledContent({ content: "", embedDescription: "Seulement l’encadré" })).toBeNull();
    expect(validateScheduledContent({ content: "ok", embedColor: 0x1000000 })).toMatch(/Couleur/);
  });
});
