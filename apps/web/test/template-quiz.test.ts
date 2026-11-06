import { describe, expect, it } from "vitest";
import { ServerSpecSchema, specStats } from "@mys/core";
import { OFFICIAL_TEMPLATES, detectFeatures } from "@mys/core/templates";
import { AUDIENCES, NEEDS, isAnswered, recommendTemplates, scoreTemplate, type QuizAnswers, type QuizTemplate } from "../src/lib/template-quiz";

/** Cartes construites comme celles de searchTemplates, à partir des templates officiels. */
const CARDS: QuizTemplate[] = OFFICIAL_TEMPLATES.map((t) => {
  const spec = ServerSpecSchema.parse(t.spec);
  const s = specStats(spec);
  return {
    slug: t.slug,
    name: t.name,
    tagline: t.tagline,
    theme: t.theme,
    size: t.size,
    features: detectFeatures(spec),
    popularity: t.popularity,
    official: true,
    stats: { channels: s.channels, roles: s.roles, messages: s.messages },
  };
});

const card = (over: Partial<QuizTemplate>): QuizTemplate => ({
  slug: "x",
  name: "X",
  tagline: "",
  theme: "communaute",
  size: "medium",
  features: [],
  popularity: 0,
  official: true,
  stats: { channels: 10, roles: 5, messages: 2 },
  ...over,
});

describe("score de correspondance", () => {
  it("donne 100 % à un template qui coche tout", () => {
    const a: QuizAnswers = { audience: "gaming", size: "medium", mood: "competitive", needs: ["tournois", "tickets"], moderation: "standard" };
    const t = card({ theme: "gaming", size: "medium", features: ["events", "voice", "tickets", "automod", "rules-gate"] });
    expect(scoreTemplate(a, t)).toBe(100);
  });

  it("pondère d’abord le thème, puis la taille et les fonctions", () => {
    const a: QuizAnswers = { audience: "gaming", size: "small", needs: ["tickets"], moderation: "light" };
    const right = card({ theme: "gaming", size: "large" });
    const wrong = card({ theme: "professionnel", size: "small", features: ["tickets"] });
    expect(scoreTemplate(a, right)).toBeGreaterThan(scoreTemplate(a, wrong));
    const near = card({ theme: "communaute", size: "large" });
    expect(scoreTemplate(a, near)).toBeGreaterThan(scoreTemplate(a, card({ theme: "etudes", size: "large" })));
  });

  it("ignore la taille quand la réponse est « je ne sais pas »", () => {
    const base: QuizAnswers = { audience: "amis", needs: [], moderation: "light" };
    const t = card({ theme: "amis", size: "large" });
    expect(scoreTemplate({ ...base, size: "unknown" }, t)).toBe(100);
    expect(scoreTemplate({ ...base, size: "small" }, t)).toBeLessThan(100);
  });

  it("reste entre 0 et 100", () => {
    for (const audience of AUDIENCES)
      for (const t of CARDS) {
        const s = scoreTemplate({ audience: audience.value, size: "large", mood: "creative", needs: NEEDS.map((n) => n.value), moderation: "strict" }, t);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
      }
  });
});

describe("recommandations", () => {
  it("propose le template du thème choisi en premier", () => {
    const cases: Array<[string, string]> = [
      ["gaming", "gaming"],
      ["amis", "amis"],
      ["etudes", "etudes"],
      ["roleplay", "roleplay"],
      ["pro", "professionnel"],
      ["tech", "tech"],
    ];
    for (const [audience, theme] of cases) {
      const top = recommendTemplates({ audience, needs: [] }, CARDS)[0]!;
      expect(top.template.theme, audience).toBe(theme);
    }
  });

  it("renvoie trois résultats triés, avec pourcentage et raisons « Parce que vous voulez… »", () => {
    const res = recommendTemplates({ audience: "gaming", size: "medium", mood: "competitive", needs: ["tournois", "tickets"], moderation: "strict" }, CARDS);
    expect(res).toHaveLength(3);
    expect(res[0]!.score).toBeGreaterThanOrEqual(res[1]!.score);
    expect(res[1]!.score).toBeGreaterThanOrEqual(res[2]!.score);
    expect(res[0]!.reasons.length).toBeGreaterThan(0);
    expect(res[0]!.reasons.length).toBeLessThanOrEqual(4);
    for (const r of res[0]!.reasons) expect(r.startsWith("Parce que vous voulez")).toBe(true);
  });

  it("signale les fonctions demandées absentes", () => {
    const [r] = recommendTemplates({ audience: "amis", needs: ["tickets"] }, [card({ theme: "amis", features: ["voice"] })]);
    expect(r!.missing).toEqual(["Tickets de support"]);
  });

  it("départage les égalités par popularité", () => {
    const res = recommendTemplates({ audience: "gaming", needs: [] }, [card({ slug: "a", theme: "gaming", popularity: 1 }), card({ slug: "b", theme: "gaming", popularity: 9 })]);
    expect(res.map((r) => r.template.slug)).toEqual(["b", "a"]);
  });

  it("gère une bibliothèque vide", () => {
    expect(recommendTemplates({ needs: [] }, [])).toEqual([]);
  });
});

describe("progression", () => {
  it("rend facultative la question des fonctions", () => {
    expect(isAnswered("needs", { needs: [] })).toBe(true);
    expect(isAnswered("audience", { needs: [] })).toBe(false);
    expect(isAnswered("size", { needs: [], size: "unknown" })).toBe(true);
  });
});
