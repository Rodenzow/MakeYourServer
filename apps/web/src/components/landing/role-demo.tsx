"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { ServerTree, type TreeCategory } from "../server-tree";
import { cx } from "../ui";

const ROLES = [
  { key: "visiteur", label: "Visiteur", hint: "N’a pas encore accepté le règlement" },
  { key: "membre", label: "Membre", hint: "A accepté le règlement" },
  { key: "staff", label: "Modération", hint: "Équipe du serveur" },
] as const;

const BASE: Array<{ cat: string; chans: Array<[string, string, Array<string>, Array<string>]> }> = [
  // [nom, type, rôles qui voient, rôles qui écrivent]
  { cat: "📌 Accueil", chans: [["👋・bienvenue", "text", ["visiteur", "membre", "staff"], ["staff"]], ["📜・règlement", "text", ["visiteur", "membre", "staff"], ["staff"]]] },
  { cat: "💬 Discussions", chans: [["💬・général", "text", ["membre", "staff"], ["membre", "staff"]], ["📸・médias", "text", ["membre", "staff"], ["membre", "staff"]], ["🛋️ Détente", "voice", ["membre", "staff"], ["membre", "staff"]]] },
  { cat: "🛡️ Équipe", chans: [["🗂️・staff", "text", ["staff"], ["staff"]], ["📋・logs", "text", ["staff"], []]] },
];

export function RoleDemo() {
  const [role, setRole] = useState<(typeof ROLES)[number]["key"]>("visiteur");
  const categories: TreeCategory[] = BASE.map((c) => ({
    key: c.cat,
    name: c.cat,
    channels: c.chans.map(([name, type, view, write]) => ({
      key: name,
      name,
      type,
      status: !view.includes(role) ? "hidden" : !write.includes(role) ? "readonly" : undefined,
    })),
  }));
  return (
    <div className="grid items-start gap-6 md:grid-cols-[0.9fr_1fr]">
      <div>
        <div role="radiogroup" aria-label="Voir le serveur comme…" className="inline-flex rounded-xl border-2 border-night bg-white p-1">
          {ROLES.map((r) => (
            <button
              key={r.key}
              role="radio"
              aria-checked={role === r.key}
              onClick={() => setRole(r.key)}
              className={cx("relative rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors", role === r.key ? "text-white" : "text-ink hover:text-night")}
            >
              {role === r.key && <motion.span layoutId="role-pill" className="absolute inset-0 rounded-lg bg-night" transition={{ type: "spring", bounce: 0.15, duration: 0.35 }} />}
              <span className="relative">{r.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">{ROLES.find((r) => r.key === role)!.hint}. Les salons masqués apparaissent grisés avec un cadenas, ceux en lecture seule sont signalés.</p>
        <p className="mt-4 text-xs text-muted">
          Dans l’éditeur, la simulation applique l’algorithme de permissions de Discord aux rôles de votre projet. Elle ne tient pas compte des permissions propres à un membre ni des rôles déjà présents sur le serveur.
        </p>
      </div>
      <ServerTree name="Aperçu des accès" categories={categories} />
    </div>
  );
}
