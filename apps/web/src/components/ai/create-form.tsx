"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { SIZE_LABELS, THEME_LABELS, type ServerSpec } from "@mys/core";
import { Button, Notice } from "../ui";
import { IconArrowRight, IconSparkle } from "../icons";
import { SpecPreview } from "./spec-preview";
import { ThinkingIndicator } from "./thinking-indicator";
import { postJson } from "./api";

const FEATURES: Array<[string, string]> = [
  ["welcome", "Message de bienvenue"],
  ["joinLogs", "Logs d’arrivées et départs"],
  ["tickets", "Tickets privés vers l’équipe"],
  ["suggestions", "Boîte à suggestions"],
  ["rulesGate", "Accès après acceptation du règlement"],
  ["selfRoles", "Rôles à choisir par boutons"],
  ["automod", "Modération automatique (AutoMod)"],
];

const TONES = ["Chaleureux, tutoiement", "Professionnel, vouvoiement", "Décontracté et plein d’humour", "Immersif (roleplay)", "Sobre et institutionnel"];

const EXAMPLES = [
  "Crée un serveur de rap français avec des espaces artistes, collaborations, événements, un staff privé, un onboarding personnalisé et une modération adaptée.",
  "Un serveur pour ma classe de BTS : entraide par matière, partage de cours, planning des examens et salles d’étude vocales.",
  "Le serveur de notre association de randonnée : sorties à venir, covoiturage, photos, bureau privé et adhésions.",
];

interface Result {
  generationId: string;
  spec: ServerSpec;
  warnings: string[];
  simulated: boolean;
}

export function AiCreateForm({ simulated, disabledReason }: { simulated: boolean; disabledReason?: string | null }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    description: "",
    theme: "communaute",
    size: "medium",
    tone: TONES[0]!,
    audience: "",
    community: true,
    onboarding: true,
    features: ["welcome", "joinLogs", "tickets", "automod", "selfRoles"],
  });
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await postJson<Result>("/api/ai/generate", {
        ...form,
        name: form.name.trim() || undefined,
        audience: form.audience.trim() || undefined,
        onboarding: form.community && form.onboarding,
      });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    if (!result) return;
    setCreating(true);
    setError(null);
    try {
      const res = await postJson<{ projectId: string }>(`/api/ai/generations/${result.generationId}/project`, {});
      router.push(`/projets/${res.projectId}`);
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {simulated && (
        <Notice tone="warning" title="Mode simulation">
          AI_PROVIDER=mock : les propositions sont simulées à partir des templates officiels. Aucune requête n’est envoyée à un modèle.
        </Notice>
      )}
      {disabledReason && <Notice tone="warning">{disabledReason}</Notice>}
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ThinkingIndicator />
          </motion.div>
        ) : result ? (
          <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Proposition {result.simulated ? "simulée" : "de l’IA"} — validée par le moteur</p>
                <h2 className="text-2xl font-bold">{result.spec.meta.name}</h2>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setResult(null)} disabled={creating}>
                  Modifier la demande
                </Button>
                <Button onClick={createProject} disabled={creating}>
                  {creating ? "Création…" : "Créer le projet"} <IconArrowRight size={16} />
                </Button>
              </div>
            </div>
            <SpecPreview spec={result.spec} />
            {result.warnings.length > 0 && (
              <Notice tone="warning" title="À savoir">
                <ul className="list-disc pl-4">
                  {result.warnings.slice(0, 6).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Notice>
            )}
            <p className="text-sm text-muted">Le projet sera enregistré comme brouillon : vous pourrez tout ajuster dans l’éditeur, puis l’installer après analyse de votre serveur.</p>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={generate} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="brick space-y-5 p-5 md:p-6">
            <div>
              <label className="label" htmlFor="ai-desc">
                Décrivez votre serveur
              </label>
              <textarea
                id="ai-desc"
                className="field min-h-32"
                required
                minLength={20}
                maxLength={2000}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Pour qui ? Pour faire quoi ? Quels espaces, quelles règles, quelle ambiance ?"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button key={ex} type="button" onClick={() => set("description", ex)} className="max-w-full truncate rounded-full border border-line bg-white px-2.5 py-1 text-left text-xs hover:border-night">
                    {ex.slice(0, 60)}…
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="ai-name">
                  Nom du serveur (facultatif)
                </label>
                <input id="ai-name" className="field" maxLength={100} value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="ai-audience">
                  Public visé (facultatif)
                </label>
                <input id="ai-audience" className="field" maxLength={200} value={form.audience} onChange={(e) => set("audience", e.target.value)} placeholder="Ex. : lycéens, artistes indépendants…" />
              </div>
              <div>
                <label className="label" htmlFor="ai-theme">
                  Thème
                </label>
                <select id="ai-theme" className="field" value={form.theme} onChange={(e) => set("theme", e.target.value)}>
                  {Object.entries(THEME_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ai-size">
                  Taille
                </label>
                <select id="ai-size" className="field" value={form.size} onChange={(e) => set("size", e.target.value)}>
                  {Object.entries(SIZE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="ai-tone">
                  Ton des messages
                </label>
                <select id="ai-tone" className="field" value={form.tone} onChange={(e) => set("tone", e.target.value)}>
                  {TONES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <fieldset>
              <legend className="label">Réglages Discord</legend>
              <div className="flex flex-col gap-1.5 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="accent-[var(--color-night)]" checked={form.community} onChange={(e) => set("community", e.target.checked)} />
                  Activer la Communauté Discord (annonces, onboarding, écran d’accueil)
                </label>
                <label className={`flex items-center gap-2 ${form.community ? "" : "opacity-50"}`}>
                  <input type="checkbox" className="accent-[var(--color-night)]" disabled={!form.community} checked={form.community && form.onboarding} onChange={(e) => set("onboarding", e.target.checked)} />
                  Parcours d’arrivée personnalisé (onboarding)
                </label>
              </div>
            </fieldset>
            <fieldset>
              <legend className="label">Fonctionnalités</legend>
              <div className="grid gap-1.5 text-sm sm:grid-cols-2">
                {FEATURES.map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="accent-[var(--color-night)]"
                      checked={form.features.includes(k)}
                      onChange={(e) => set("features", e.target.checked ? [...form.features, k] : form.features.filter((f) => f !== k))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            {error && <Notice tone="danger">{error}</Notice>}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" disabled={form.description.trim().length < 20 || !!disabledReason}>
                <IconSparkle /> Concevoir mon serveur
              </Button>
              <p className="text-xs text-muted">Une conception est décomptée de votre quota mensuel. L’IA ne touche jamais à Discord : vous prévisualisez avant tout.</p>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
      {error && result && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}
