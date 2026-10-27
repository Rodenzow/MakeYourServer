"use client";

import { specStats, type ServerSpec } from "@mys/core";
import { RoleList, ServerTree, type TreeCategory } from "../server-tree";

export function specToTree(spec: ServerSpec): TreeCategory[] {
  const isPrivate = (ows: Array<{ target: string; deny: string[] }>) => ows.some((o) => o.target === "everyone" && o.deny.includes("VIEW_CHANNEL"));
  const cats: TreeCategory[] = [];
  if (spec.uncategorized.length)
    cats.push({ key: "__root", name: null, channels: spec.uncategorized.map((c) => ({ key: c.id, name: c.name, type: c.type, private: isPrivate(c.overwrites) })) });
  for (const cat of spec.categories) {
    cats.push({
      key: cat.id,
      name: cat.name,
      channels: cat.channels.map((c) => ({ key: c.id, name: c.name, type: c.type, private: isPrivate(c.syncPermissions ? cat.overwrites : c.overwrites) })),
    });
  }
  return cats;
}

/** Aperçu d’un projet : arborescence, rôles et chiffres clés. */
export function SpecPreview({ spec }: { spec: ServerSpec }) {
  const s = specStats(spec);
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <ServerTree name={spec.meta.name} categories={specToTree(spec)} dense className="max-h-[520px] overflow-y-auto" />
      <div className="space-y-4">
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Salons", s.channels],
            ["Rôles", s.roles],
            ["Messages", s.messages],
            ["Catégories", s.categories],
            ["AutoMod", s.automodRules],
            ["Questions", s.onboardingPrompts],
          ].map(([label, value]) => (
            <div key={label} className="panel px-2 py-2">
              <dt className="text-[11px] font-semibold text-muted">{label}</dt>
              <dd className="font-display text-xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="eyebrow mb-2">Rôles</p>
          <RoleList roles={spec.roles.map((r) => ({ key: r.id, name: r.name, color: r.color }))} />
        </div>
        {spec.meta.description && <p className="text-sm text-muted">{spec.meta.description}</p>}
      </div>
    </div>
  );
}
