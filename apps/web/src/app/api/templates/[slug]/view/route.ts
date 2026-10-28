import { and, eq, getDb, sql, templates } from "@mys/db";
import { json, withPublic } from "@/lib/api";

const BOT_UA = /bot|crawler|spider|preview|facebookexternalhit|embed|slurp|curl|wget/i;

/**
 * Compte une vue de la fiche publique. Appelée par le navigateur après affichage
 * (pas lors d’un préchargement) ; un cookie limite le décompte à une vue par
 * visiteur, par template et par 24 h. Les robots ne sont pas comptés.
 */
export const POST = withPublic<{ slug: string }>(async (req, _user, { slug }) => {
  if (!/^[a-z0-9-]{1,120}$/.test(slug) || BOT_UA.test(req.headers.get("user-agent") ?? "")) return json({ counted: false });
  const cookie = `mys_v_${slug.slice(0, 60)}`;
  if (req.cookies.get(cookie)) return json({ counted: false });
  const rows = await getDb()
    .update(templates)
    .set({ viewCount: sql`${templates.viewCount} + 1` })
    .where(and(eq(templates.slug, slug), eq(templates.status, "published")))
    .returning({ id: templates.id });
  const res = json({ counted: rows.length > 0 });
  if (rows.length) res.cookies.set(cookie, "1", { maxAge: 86_400, httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/" });
  return res;
});
