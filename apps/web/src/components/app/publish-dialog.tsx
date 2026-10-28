"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { THEME_LABELS } from "@mys/core";
import { IconCheck, IconSparkle } from "../icons";
import { Button, Notice, cx } from "../ui";

/**
 * Proposer un projet ou une sauvegarde à la bibliothèque publique.
 * La proposition est relue par l’administration avant toute publication.
 */
export function PublishDialog({
  kind,
  id,
  defaultName,
  defaultTheme,
  label = "Publier dans la bibliothèque",
  variant = "secondary",
}: {
  kind: "project" | "backup";
  id: string;
  defaultName: string;
  defaultTheme?: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    name: defaultName.slice(0, 80),
    tagline: "",
    description: "",
    audience: "",
    theme: defaultTheme && defaultTheme in THEME_LABELS ? defaultTheme : "communaute",
    showAuthor: true,
    consentRules: false,
    consentRights: false,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const ready =
    form.name.trim().length >= 3 && form.tagline.trim().length >= 10 && form.description.trim().length >= 40 && form.audience.trim().length >= 20 && form.consentRules && form.consentRights;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(kind === "project" ? `/api/projects/${id}/submit` : `/api/backups/${id}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "La proposition n’a pas pu être envoyée.");
      setDone(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        <IconSparkle size={15} /> {label}
      </Button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === ref.current && setOpen(false)}
        className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-[18px] border border-edge bg-surface p-0 text-fg shadow-2xl backdrop:bg-paper/80 backdrop:backdrop-blur-sm"
      >
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="p-8 text-center">
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success">
                <IconCheck size={28} />
              </motion.span>
              <h2 className="mt-4 text-2xl font-bold">Proposition envoyée !</h2>
              <p className="mt-2 text-muted">Un administrateur va la relire. Vous suivrez son statut, ses vues et ses installations dans « Mes publications ».</p>
              <div className="mt-6 flex justify-center gap-2">
                <Link href="/publications" className="font-semibold text-blue-strong hover:underline">
                  Voir mes publications →
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={submit} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-h-[85vh] overflow-y-auto p-6">
              <p className="eyebrow">Bibliothèque communautaire</p>
              <h2 className="mt-1 text-2xl font-bold">Partager ce serveur</h2>
              <p className="mt-1 text-sm text-muted">
                {kind === "backup"
                  ? "Seule la structure est publiée : salons, rôles, permissions, AutoMod et onboarding. Les messages exportés et les identifiants de votre serveur ne le sont jamais."
                  : "Votre projet devient un template que tout le monde pourra installer. Vos modifications futures du projet ne changeront pas la version publiée."}
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Nom du template" hint={`${form.name.length}/80`}>
                  <input className="field" value={form.name} maxLength={80} onChange={(e) => set("name", e.target.value)} required />
                </Field>
                <Field label="Thème">
                  <select className="field" value={form.theme} onChange={(e) => set("theme", e.target.value)}>
                    {Object.entries(THEME_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Accroche (une phrase)" hint={`${form.tagline.length}/160`} className="mt-4">
                <input className="field" value={form.tagline} maxLength={160} placeholder="Un QG pour organiser vos soirées jeux et vos sorties." onChange={(e) => set("tagline", e.target.value)} />
              </Field>
              <Field label="Description" hint={`${form.description.length}/1500 · 40 minimum`} className="mt-4">
                <textarea className="field min-h-28" value={form.description} maxLength={1500} placeholder="Ce que contient le serveur, comment il s’organise, ce qui le rend pratique…" onChange={(e) => set("description", e.target.value)} />
              </Field>
              <Field label="Pour qui ?" hint={`${form.audience.length}/300`} className="mt-4">
                <input className="field" value={form.audience} maxLength={300} placeholder="Petites communautés de joueurs qui veulent…" onChange={(e) => set("audience", e.target.value)} />
              </Field>

              <div className="mt-5 space-y-2.5 rounded-xl border border-line bg-night p-4 text-sm">
                <Check checked={form.showAuthor} onChange={(v) => set("showAuthor", v)}>
                  Afficher mon pseudo Discord comme auteur sur la fiche publique
                </Check>
                <Check checked={form.consentRules} onChange={(v) => set("consentRules", v)}>
                  Le contenu respecte les{" "}
                  <Link href="/conditions#publication" target="_blank" className="link">
                    règles de publication
                  </Link>
                  , les{" "}
                  <a href="https://discord.com/terms" target="_blank" rel="noreferrer" className="link">
                    Conditions d’utilisation
                  </a>{" "}
                  et les{" "}
                  <a href="https://discord.com/guidelines" target="_blank" rel="noreferrer" className="link">
                    Règles de la communauté
                  </a>{" "}
                  de Discord (aucun contenu haineux, sexuel, trompeur ou illégal).
                </Check>
                <Check checked={form.consentRights} onChange={(v) => set("consentRights", v)}>
                  {kind === "backup"
                    ? "Je gère ce serveur et j’ai l’accord de ses responsables pour en partager la structure."
                    : "Ce projet est ma création (ou je suis autorisé à le partager)."}
                </Check>
              </div>

              {error && (
                <Notice tone="danger" className="mt-4">
                  {error}
                </Notice>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={!ready || busy} className={cx(busy && "animate-pulse")}>
                  {busy ? "Envoi…" : "Envoyer pour relecture"}
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </dialog>
    </>
  );
}

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cx("block", className)}>
      <span className="label flex justify-between">
        {label}
        {hint && <span className="font-normal text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input type="checkbox" className="mt-1 size-4 shrink-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-ink">{children}</span>
    </label>
  );
}
