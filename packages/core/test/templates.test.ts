import { describe, expect, it } from "vitest";
import { ServerSpecSchema, validateSpec, specStats, allChannels } from "../src";
import { OFFICIAL_TEMPLATES, detectFeatures } from "../src/templates";

describe("templates officiels", () => {
  it("ont des slugs uniques", () => {
    const slugs = OFFICIAL_TEMPLATES.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  for (const t of OFFICIAL_TEMPLATES) {
    describe(t.slug, () => {
      const parsed = ServerSpecSchema.safeParse(t.spec);
      it("respecte le schéma", () => {
        if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues.slice(0, 5), null, 2));
      });
      it("passe la validation sémantique sans erreur", () => {
        if (!parsed.success) return;
        const v = validateSpec(parsed.data);
        expect(v.errors, JSON.stringify(v.errors, null, 2)).toEqual([]);
      });
      it("est suffisamment complet sans être surchargé", () => {
        if (!parsed.success) return;
        const s = specStats(parsed.data);
        expect(s.channels).toBeGreaterThanOrEqual(12);
        expect(s.channels).toBeLessThanOrEqual(45);
        expect(s.roles).toBeGreaterThanOrEqual(4);
        expect(s.messages).toBeGreaterThanOrEqual(4);
        expect(parsed.data.automod.length).toBeGreaterThanOrEqual(2);
        const purposes = allChannels(parsed.data).map((c) => c.channel.purpose);
        expect(purposes).toContain("rules");
        expect(purposes).toContain("welcome");
        expect(detectFeatures(parsed.data)).toContain("staff");
      });
      it("a une fiche descriptive complète", () => {
        expect(t.highlights.length).toBeGreaterThanOrEqual(3);
        expect(t.audience.length).toBeGreaterThan(20);
        expect(t.description.length).toBeGreaterThan(60);
      });
    });
  }
});
