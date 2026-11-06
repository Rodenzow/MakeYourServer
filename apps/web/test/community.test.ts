import { describe, expect, it } from "vitest";
import { averageRating, bayesianScore, commentHasLink, creatorBadges, formatRating, ratingDistribution } from "../src/lib/community-rules";

describe("notes des templates", () => {
  it("formate la moyenne à la française, avec une décimale", () => {
    expect(formatRating(4.56)).toBe("4,6");
    expect(formatRating(5)).toBe("5,0");
    expect(formatRating(3.04)).toBe("3,0");
  });

  it("calcule la moyenne seulement s’il y a des avis", () => {
    expect(averageRating(0, 0)).toBeNull();
    expect(averageRating(23, 5)).toBeCloseTo(4.6);
  });

  it("moyenne bayésienne : un avis isolé ne passe pas devant beaucoup d’excellents avis", () => {
    const single = bayesianScore(5, 1);
    const many = bayesianScore(48 * 5 - 10, 48); // ≈ 4,8 sur 48 avis
    expect(many).toBeGreaterThan(single);
    // Sans avis, le score vaut la moyenne a priori.
    expect(bayesianScore(0, 0)).toBeCloseTo(3.5);
    // Plusieurs mauvaises notes font passer sous un template sans avis.
    expect(bayesianScore(10, 10)).toBeLessThan(bayesianScore(0, 0));
  });

  it("répartit les notes de 5 à 1, y compris celles à zéro", () => {
    const d = ratingDistribution([
      { rating: 5, n: 3 },
      { rating: 4, n: 1 },
    ]);
    expect(d.map((x) => x.rating)).toEqual([5, 4, 3, 2, 1]);
    expect(d[0]).toEqual({ rating: 5, n: 3, percent: 75 });
    expect(d[4]).toEqual({ rating: 1, n: 0, percent: 0 });
    expect(ratingDistribution([]).every((x) => x.percent === 0)).toBe(true);
  });

  it("refuse les liens et les invitations dans les commentaires", () => {
    expect(commentHasLink("Rejoignez discord.gg/abc")).toBe(true);
    expect(commentHasLink("voir https://exemple.org")).toBe(true);
    expect(commentHasLink("mon-site.fr est mieux")).toBe(true);
    expect(commentHasLink("Super template, l’accueil est très clair. Merci !")).toBe(false);
  });
});

describe("badges des créateurs", () => {
  const keys = (t: Parameters<typeof creatorBadges>[0]) => creatorBadges(t).map((b) => b.key);

  it("attribue « Créateur vérifié » dès le premier template publié", () => {
    expect(keys({ published: 0, installs: 0, ratingSum: 0, ratingCount: 0 })).toEqual([]);
    expect(keys({ published: 1, installs: 0, ratingSum: 0, ratingCount: 0 })).toEqual(["verified"]);
  });

  it("attribue « Créateur confirmé » à partir de 3 templates et « 100 installations »", () => {
    expect(keys({ published: 3, installs: 99, ratingSum: 0, ratingCount: 0 })).toEqual(["verified", "confirmed"]);
    expect(keys({ published: 3, installs: 100, ratingSum: 0, ratingCount: 0 })).toContain("installs100");
  });

  it("« Très bien noté » exige une moyenne ≥ 4,5 ET au moins 5 avis", () => {
    expect(keys({ published: 1, installs: 0, ratingSum: 20, ratingCount: 4 })).not.toContain("topRated"); // 5,0 mais 4 avis
    expect(keys({ published: 1, installs: 0, ratingSum: 22, ratingCount: 5 })).not.toContain("topRated"); // 4,4
    expect(keys({ published: 1, installs: 0, ratingSum: 23, ratingCount: 5 })).toContain("topRated"); // 4,6
  });
});
