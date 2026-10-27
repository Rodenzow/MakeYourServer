import { withPublic, json } from "@/lib/api";
import { searchTemplates } from "@/lib/data";

/** Recherche publique : seuls les templates publiés apparaissent (jamais les projets ni les sauvegardes). */
export const GET = withPublic(async (req) => {
  const p = req.nextUrl.searchParams;
  const sort = p.get("tri");
  const results = await searchTemplates({
    q: p.get("q")?.slice(0, 80) || undefined,
    theme: p.get("theme") || undefined,
    size: p.get("taille") || undefined,
    features: p.get("fonctionnalites")?.split(",").filter(Boolean).slice(0, 8),
    sort: sort === "recent" || sort === "name" ? sort : "popular",
  });
  return json({ templates: results });
});
