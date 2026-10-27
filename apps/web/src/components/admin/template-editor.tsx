"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Notice } from "../ui";
import { adminRequest } from "./client";

export interface TemplateFormValues {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  audience: string;
  highlights: string[];
  theme: string;
  size: string;
  popularity: number;
  official: boolean;
  spec: unknown;
}

interface Issue {
  level: "error" | "warning";
  message: string;
}

/** Édition d’un template : métadonnées de la fiche + projet (JSON) validé côté serveur. */
export function TemplateEditor({
  templateId,
  initial,
  themes,
  sizes,
}: {
  templateId?: string;
  initial: TemplateFormValues;
  themes: Array<[string, string]>;
  sizes: Array<[string, string]>;
}) {
  const router = useRouter();
  const [v, setV] = useState({ ...initial, highlightsText: initial.highlights.join("\n"), specText: JSON.stringify(initial.spec, null, 2) });
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => {
    setSaved(false);
    setV((x) => ({ ...x, [k]: value }));
  };

  const submit = () => {
    setError(null);
    setIssues([]);
    let spec: unknown;
    try {
      spec = JSON.parse(v.specText);
    } catch (e) {
      setError(`Le projet n’est pas un JSON valide : ${(e as Error).message}`);
      return;
    }
    const payload = {
      name: v.name,
      slug: v.slug,
      tagline: v.tagline,
      description: v.description,
      audience: v.audience,
      highlights: v.highlightsText.split("\n").map((s) => s.trim()).filter(Boolean),
      theme: v.theme,
      size: v.size,
      popularity: Number(v.popularity) || 0,
      official: v.official,
      spec,
    };
    start(async () => {
      const r = templateId ? await adminRequest(`/api/admin/templates/${templateId}`, "PUT", payload) : await adminRequest(`/api/admin/templates`, "POST", payload);
      if (!r.ok) return setError(r.error);
      setIssues(r.data.issues ?? []);
      setSaved(true);
      if (!templateId && r.data.id) router.push(`/admin/templates/${r.data.id}`);
      else router.refresh();
    });
  };

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="panel grid gap-4 p-5 md:grid-cols-2">
        <Field label="Nom" id="t-name">
          <input id="t-name" className="field" required maxLength={100} value={v.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Identifiant d’URL (slug)" id="t-slug" hint="Minuscules, chiffres et tirets.">
          <input id="t-slug" className="field font-mono" required pattern="[a-z0-9][a-z0-9-]{1,60}" value={v.slug} onChange={(e) => set("slug", e.target.value)} />
        </Field>
        <Field label="Accroche" id="t-tagline" className="md:col-span-2">
          <input id="t-tagline" className="field" maxLength={200} value={v.tagline} onChange={(e) => set("tagline", e.target.value)} />
        </Field>
        <Field label="Description" id="t-desc" className="md:col-span-2">
          <textarea id="t-desc" className="field min-h-24" maxLength={2000} value={v.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="Public visé" id="t-aud" className="md:col-span-2">
          <textarea id="t-aud" className="field min-h-16" maxLength={500} value={v.audience} onChange={(e) => set("audience", e.target.value)} />
        </Field>
        <Field label="Points forts (un par ligne)" id="t-hl" className="md:col-span-2">
          <textarea id="t-hl" className="field min-h-28" value={v.highlightsText} onChange={(e) => set("highlightsText", e.target.value)} />
        </Field>
        <Field label="Thème" id="t-theme">
          <select id="t-theme" className="field" value={v.theme} onChange={(e) => set("theme", e.target.value)}>
            {themes.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Taille" id="t-size">
          <select id="t-size" className="field" value={v.size} onChange={(e) => set("size", e.target.value)}>
            {sizes.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Popularité initiale" id="t-pop" hint="S’ajoute au nombre d’installations pour le tri.">
          <input id="t-pop" type="number" min={0} max={1000} className="field" value={v.popularity} onChange={(e) => set("popularity", Number(e.target.value))} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold">
          <input type="checkbox" checked={v.official} onChange={(e) => set("official", e.target.checked)} className="size-4 accent-[var(--color-blue)]" />
          Template officiel Make Your Server
        </label>
      </div>

      <div className="panel p-5">
        <label className="label" htmlFor="t-spec">
          Projet (JSON ServerSpec)
        </label>
        <p className="mb-2 text-xs text-muted">Validé à l’enregistrement : schéma strict, références entre rôles et salons, limites Discord. Les fonctionnalités affichées dans la bibliothèque sont recalculées.</p>
        <textarea id="t-spec" spellCheck={false} className="field min-h-[480px] font-mono text-xs" value={v.specText} onChange={(e) => set("specText", e.target.value)} />
      </div>

      {error && (
        <Notice tone="danger" title="Enregistrement impossible">
          {error}
        </Notice>
      )}
      {errors.length > 0 && (
        <Notice tone="danger" title={`${errors.length} erreur(s) de validation`}>
          <ul className="list-disc pl-5">
            {errors.slice(0, 20).map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
          <p className="mt-1">Le template est enregistré mais ne peut pas être publié tant que ces erreurs subsistent.</p>
        </Notice>
      )}
      {warnings.length > 0 && (
        <Notice tone="warning" title={`${warnings.length} avertissement(s)`}>
          <ul className="list-disc pl-5">
            {warnings.slice(0, 20).map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        </Notice>
      )}
      {saved && errors.length === 0 && <Notice tone="success">Enregistré.</Notice>}

      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : templateId ? "Enregistrer les modifications" : "Créer le template (brouillon)"}
      </Button>
    </form>
  );
}

function Field({ label, id, hint, className, children }: { label: string; id: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
