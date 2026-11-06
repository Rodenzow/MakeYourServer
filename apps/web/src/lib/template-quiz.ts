/**
 * « Trouver mon template » : questionnaire et calcul de correspondance, sans IA.
 * Le calcul se fait dans le navigateur à partir des cartes des templates publiés
 * (thème, taille visée, fonctionnalités détectées). Fichier sans dépendance serveur.
 */

/** Sous-ensemble des cartes renvoyées par searchTemplates (src/lib/data.ts). */
export interface QuizTemplate {
  slug: string;
  name: string;
  tagline: string;
  theme: string;
  size: string;
  features: string[];
  popularity: number;
  official: boolean;
  stats: { channels: number; roles: number; messages: number };
}

export type QuizSize = "small" | "medium" | "large" | "unknown";
export type QuizMood = "chill" | "organized" | "creative" | "competitive";
export type QuizModeration = "light" | "standard" | "strict";

export interface QuizAnswers {
  audience?: string;
  size?: QuizSize;
  mood?: QuizMood;
  needs: string[];
  moderation?: QuizModeration;
}

export interface QuizOption<V extends string = string> {
  value: V;
  label: string;
  hint?: string;
  emoji: string;
}

/* --------------------------------- Questions -------------------------------- */

interface AudienceOption extends QuizOption {
  /** Thèmes visés en priorité, puis thèmes proches. */
  themes: string[];
  near: string[];
  /** Pour la phrase « Parce que vous voulez un serveur… ». */
  phrase: string;
}

export const AUDIENCES: AudienceOption[] = [
  { value: "gaming", label: "Une communauté de joueurs", emoji: "🎮", themes: ["gaming"], near: ["communaute", "sport"], phrase: "pour une communauté de joueurs" },
  { value: "amis", label: "Mes amis, un petit groupe", emoji: "🍕", themes: ["amis"], near: ["communaute", "gaming"], phrase: "pour vous retrouver entre amis" },
  { value: "createur", label: "Ma chaîne ou mon audience", hint: "YouTube, Twitch, TikTok…", emoji: "🎬", themes: ["createur"], near: ["communaute", "art", "musique"], phrase: "pour réunir votre audience" },
  { value: "creation", label: "Une passion créative", hint: "Art, musique, photo…", emoji: "🎨", themes: ["art", "musique"], near: ["createur", "anime"], phrase: "autour d’une passion créative" },
  { value: "anime", label: "Anime, manga, pop culture", emoji: "🌸", themes: ["anime"], near: ["communaute", "art", "gaming"], phrase: "pour les fans d’anime et de manga" },
  { value: "tech", label: "Tech et développement", emoji: "💻", themes: ["tech"], near: ["etudes", "professionnel"], phrase: "autour de la tech et du développement" },
  { value: "etudes", label: "Une classe, des études", emoji: "📚", themes: ["etudes"], near: ["tech", "association"], phrase: "pour étudier ensemble" },
  { value: "association", label: "Une association ou un club", hint: "Sport, loisirs, bénévolat…", emoji: "🤝", themes: ["association", "sport"], near: ["communaute", "professionnel"], phrase: "pour une association ou un club" },
  { value: "roleplay", label: "Un univers de roleplay", emoji: "🐉", themes: ["roleplay"], near: ["anime", "gaming"], phrase: "pour faire vivre un univers de roleplay" },
  { value: "pro", label: "Une équipe ou un projet pro", emoji: "💼", themes: ["professionnel"], near: ["tech", "association"], phrase: "pour une équipe ou un projet professionnel" },
  { value: "communaute", label: "Une grande communauté ouverte", emoji: "💬", themes: ["communaute"], near: ["gaming", "createur", "anime"], phrase: "pour une communauté ouverte à tous" },
];

export const SIZE_OPTIONS: Array<QuizOption<QuizSize> & { phrase: string }> = [
  { value: "small", label: "Petit", hint: "Moins de 50 membres", emoji: "🌱", phrase: "un petit serveur" },
  { value: "medium", label: "Moyen", hint: "50 à 1 000 membres", emoji: "🌿", phrase: "un serveur de taille moyenne" },
  { value: "large", label: "Grand", hint: "Plus de 1 000 membres", emoji: "🌳", phrase: "un grand serveur" },
  { value: "unknown", label: "Je ne sais pas encore", emoji: "🤔", phrase: "" },
];

interface MoodOption extends QuizOption<QuizMood> {
  themes: string[];
  features: string[];
  phrase: string;
}

export const MOODS: MoodOption[] = [
  { value: "chill", label: "Détendue et conviviale", hint: "On discute, on rigole, on se retrouve en vocal", emoji: "☕", themes: ["amis", "communaute", "anime"], features: ["voice", "welcome"], phrase: "une ambiance détendue" },
  { value: "organized", label: "Organisée et sérieuse", hint: "Annonces claires, salons rangés, rôles précis", emoji: "🗂️", themes: ["professionnel", "association", "etudes", "tech"], features: ["staff", "rules-gate"], phrase: "un serveur organisé" },
  { value: "creative", label: "Créative et inspirante", hint: "On partage ses projets et on se motive", emoji: "✨", themes: ["art", "musique", "createur", "roleplay"], features: ["forum"], phrase: "une ambiance créative" },
  { value: "competitive", label: "Compétitive et motivée", hint: "Matchs, classements, défis", emoji: "🏆", themes: ["gaming", "sport"], features: ["events", "voice"], phrase: "une ambiance compétitive" },
];

interface NeedOption extends QuizOption {
  features: string[];
  phrase: string;
}

export const NEEDS: NeedOption[] = [
  { value: "entraide", label: "Entraide et questions", emoji: "🙋", features: ["forum", "suggestions"], phrase: "de l’entraide entre membres" },
  { value: "tournois", label: "Tournois et matchs", emoji: "🏆", features: ["events", "voice"], phrase: "organiser des tournois" },
  { value: "evenements", label: "Événements", emoji: "📅", features: ["events"], phrase: "organiser des événements" },
  { value: "tickets", label: "Tickets de support", emoji: "🎫", features: ["tickets"], phrase: "des tickets de support privés" },
  { value: "creation", label: "Partage de créations", emoji: "🖼️", features: ["forum"], phrase: "que les membres partagent leurs créations" },
  { value: "roles", label: "Rôles au choix", emoji: "🏷️", features: ["self-roles", "onboarding"], phrase: "que chacun choisisse ses rôles" },
  { value: "vocal", label: "Vocaux", emoji: "🔊", features: ["voice"], phrase: "des salons vocaux" },
  { value: "accueil", label: "Accueil des nouveaux", emoji: "👋", features: ["welcome", "onboarding"], phrase: "bien accueillir les nouveaux" },
  { value: "suggestions", label: "Idées et suggestions", emoji: "💡", features: ["suggestions"], phrase: "recueillir les idées des membres" },
];

interface ModerationOption extends QuizOption<QuizModeration> {
  features: string[];
  phrase: string;
}

export const MODERATIONS: ModerationOption[] = [
  { value: "light", label: "Légère", hint: "Entre personnes de confiance", emoji: "🕊️", features: [], phrase: "une modération légère" },
  { value: "standard", label: "Standard", hint: "Un règlement et un filtre automatique", emoji: "🛡️", features: ["automod", "rules-gate"], phrase: "une modération standard" },
  { value: "strict", label: "Stricte", hint: "Grand public : filtres, journaux, équipe", emoji: "🚨", features: ["automod", "rules-gate", "logs", "staff"], phrase: "une modération stricte" },
];

export const QUIZ_STEPS = ["audience", "size", "mood", "needs", "moderation"] as const;
export type QuizStep = (typeof QUIZ_STEPS)[number];

export const QUIZ_QUESTIONS: Record<QuizStep, { title: string; help: string }> = {
  audience: { title: "Pour qui est ce serveur ?", help: "Choisissez ce qui ressemble le plus à votre projet." },
  size: { title: "Combien de membres visez-vous ?", help: "Une estimation suffit : vous pourrez tout ajuster ensuite." },
  mood: { title: "Quelle ambiance souhaitez-vous ?", help: "Elle oriente l’organisation des salons." },
  needs: { title: "Quelles fonctions sont importantes ?", help: "Plusieurs choix possibles. Vous pouvez aussi passer cette question." },
  moderation: { title: "Quel niveau de modération ?", help: "Le bot configure AutoMod, règlement et journaux selon votre choix." },
};

/** Ce que chaque fonctionnalité apporte, pour « Parce que vous voulez… ». */
const FEATURE_PHRASES: Record<string, string> = {
  onboarding: "les questions d’accueil de Discord sont configurées",
  automod: "l’AutoMod est configuré",
  tickets: "un système de tickets est inclus",
  suggestions: "un salon de suggestions avec votes est prêt",
  "self-roles": "des rôles à boutons sont prêts",
  "rules-gate": "la validation du règlement est en place",
  welcome: "un message de bienvenue est prévu",
  logs: "des journaux de modération sont prêts",
  forum: "des forums sont prêts",
  events: "un espace événements est prévu",
  voice: "des salons vocaux sont inclus",
  staff: "un espace staff privé est prévu",
};

function featureList(features: string[]) {
  const parts = features.map((f) => FEATURE_PHRASES[f] ?? f);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} et ${parts.at(-1)}` : (parts[0] ?? "");
}

/* ---------------------------------- Calcul ---------------------------------- */

export interface QuizResult {
  template: QuizTemplate;
  /** Correspondance en pourcentage (0 à 100). */
  score: number;
  reasons: string[];
  /** Fonctions demandées absentes du template (ajoutables dans l’éditeur). */
  missing: string[];
}

const WEIGHTS = { theme: 50, size: 15, needs: 25, moderation: 10 };
const SIZE_ORDER = ["small", "medium", "large"];

function sizeScore(wanted: QuizSize | undefined, actual: string): number | null {
  if (!wanted || wanted === "unknown") return null;
  const a = SIZE_ORDER.indexOf(actual);
  const w = SIZE_ORDER.indexOf(wanted);
  if (a < 0) return 0.5;
  const gap = Math.abs(a - w);
  return gap === 0 ? 1 : gap === 1 ? 0.5 : 0;
}

function themeScore(answers: QuizAnswers, theme: string): number | null {
  const audience = AUDIENCES.find((a) => a.value === answers.audience);
  const mood = MOODS.find((m) => m.value === answers.mood);
  if (!audience && !mood) return null;
  let s = 0;
  if (audience?.themes.includes(theme)) s = 1;
  else if (audience?.near.includes(theme)) s = 0.45;
  if (mood?.themes.includes(theme)) s += audience ? 0.2 : 1;
  return Math.min(1, s);
}

/** Fonctions attendues d’après les besoins cochés et l’ambiance (cette dernière pèse moins). */
function wantedFeatures(answers: QuizAnswers) {
  const strong = new Set<string>();
  for (const n of answers.needs) for (const f of NEEDS.find((x) => x.value === n)?.features ?? []) strong.add(f);
  const soft = new Set<string>();
  for (const f of MOODS.find((m) => m.value === answers.mood)?.features ?? []) if (!strong.has(f)) soft.add(f);
  return { strong: [...strong], soft: [...soft] };
}

function needsScore(answers: QuizAnswers, features: string[]): number | null {
  const { strong, soft } = wantedFeatures(answers);
  const total = strong.length + soft.length * 0.5;
  if (!total) return null;
  const got = strong.filter((f) => features.includes(f)).length + soft.filter((f) => features.includes(f)).length * 0.5;
  return got / total;
}

function moderationScore(level: QuizModeration | undefined, features: string[]): number | null {
  if (!level) return null;
  const wanted = MODERATIONS.find((m) => m.value === level)?.features ?? [];
  if (!wanted.length) {
    // Modération légère : un template sans dispositif lourd convient mieux.
    const heavy = ["logs", "staff"].filter((f) => features.includes(f)).length;
    return heavy === 0 ? 1 : heavy === 1 ? 0.9 : 0.8;
  }
  return wanted.filter((f) => features.includes(f)).length / wanted.length;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function reasonsFor(answers: QuizAnswers, t: QuizTemplate): { reasons: string[]; missing: string[] } {
  const reasons: string[] = [];
  const audience = AUDIENCES.find((a) => a.value === answers.audience);
  if (audience?.themes.includes(t.theme)) reasons.push(`Parce que vous voulez un serveur ${audience.phrase} : ce template est conçu exactement pour ça.`);
  else if (audience?.near.includes(t.theme)) reasons.push(`Parce que vous voulez un serveur ${audience.phrase} : ce template s’en approche et se personnalise facilement.`);

  const mood = MOODS.find((m) => m.value === answers.mood);
  if (mood?.themes.includes(t.theme)) reasons.push(`Parce que vous voulez ${mood.phrase} : c’est l’esprit de ce template.`);

  const size = SIZE_OPTIONS.find((s) => s.value === answers.size);
  if (size && size.value !== "unknown" && t.size === size.value) reasons.push(`Parce que vous voulez ${size.phrase} : sa structure (${t.stats.channels} salons, ${t.stats.roles} rôles) est dimensionnée pour cette taille.`);

  const missing: string[] = [];
  for (const n of answers.needs) {
    const need = NEEDS.find((x) => x.value === n);
    if (!need) continue;
    const have = need.features.filter((f) => t.features.includes(f));
    if (have.length) reasons.push(`Parce que vous voulez ${need.phrase} : ${featureList(have)}.`);
    else missing.push(need.label);
  }

  const mod = MODERATIONS.find((m) => m.value === answers.moderation);
  if (mod && mod.features.length) {
    const have = mod.features.filter((f) => t.features.includes(f));
    if (have.length) reasons.push(`Parce que vous voulez ${mod.phrase} : ${featureList(have)}.`);
  } else if (mod) {
    reasons.push(`Parce que vous voulez ${mod.phrase} : rien n’est imposé, vous gardez la main.`);
  }
  return { reasons: reasons.map(cap), missing };
}

/** Score de correspondance d’un template (0 à 100). */
export function scoreTemplate(answers: QuizAnswers, t: QuizTemplate): number {
  const parts: Array<[number, number | null]> = [
    [WEIGHTS.theme, themeScore(answers, t.theme)],
    [WEIGHTS.size, sizeScore(answers.size, t.size)],
    [WEIGHTS.needs, needsScore(answers, t.features)],
    [WEIGHTS.moderation, moderationScore(answers.moderation, t.features)],
  ];
  let total = 0;
  let weight = 0;
  for (const [w, s] of parts) {
    if (s === null) continue;
    total += w * s;
    weight += w;
  }
  if (!weight) return 0;
  return Math.round((total / weight) * 100);
}

/** Les meilleurs templates pour ces réponses, avec pourcentage et raisons. */
export function recommendTemplates(answers: QuizAnswers, templates: QuizTemplate[], limit = 3): QuizResult[] {
  return templates
    .map((t) => ({ template: t, score: scoreTemplate(answers, t), ...reasonsFor(answers, t) }))
    .sort((a, b) => b.score - a.score || Number(b.template.official) - Number(a.template.official) || b.template.popularity - a.template.popularity || a.template.name.localeCompare(b.template.name, "fr"))
    .slice(0, limit)
    .map((r) => ({ ...r, reasons: r.reasons.slice(0, 4) }));
}

/** Une question est-elle répondue (la question des fonctions est facultative) ? */
export function isAnswered(step: QuizStep, a: QuizAnswers): boolean {
  if (step === "needs") return true;
  return a[step] !== undefined;
}
