import { simulateAsRoles, type ServerSpec } from "@mys/core";
import type { TreeCategory } from "../server-tree";

/** Convertit un projet en arborescence affichable, avec la simulation d’accès optionnelle. */
export function specToTree(spec: ServerSpec, asRoles?: string[] | null): TreeCategory[] {
  const access = asRoles ? simulateAsRoles(spec, asRoles) : null;
  const status = (id: string) => {
    if (!access) return undefined;
    const a = access.get(id);
    if (!a || !a.canView) return "hidden" as const;
    if (!a.canSend) return "readonly" as const;
    return undefined;
  };
  const isPrivate = (id: string) => {
    const a = simulateAsRoles(spec, []).get(id);
    return !!a && !a.canView;
  };
  const cats: TreeCategory[] = [];
  if (spec.uncategorized.length)
    cats.push({ key: "__root", name: null, channels: spec.uncategorized.map((c) => ({ key: c.id, name: c.name, type: c.type, status: status(c.id), private: !access && isPrivate(c.id) })) });
  for (const cat of spec.categories) {
    cats.push({
      key: cat.id,
      name: cat.name,
      channels: cat.channels.map((c) => ({ key: c.id, name: c.name, type: c.type, status: status(c.id), private: !access && isPrivate(c.id) })),
    });
  }
  return cats;
}
