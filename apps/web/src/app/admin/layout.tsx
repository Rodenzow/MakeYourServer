import { SiteHeader } from "@/components/site-header";
import { AppNav } from "@/components/app/app-nav";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: { default: "Administration", template: "%s · Administration" }, robots: { index: false } };
export const dynamic = "force-dynamic";

/** Espace privé : réservé aux identifiants Discord listés dans ADMIN_DISCORD_IDS (contrôle côté serveur). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <>
      <SiteHeader />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[210px_1fr] lg:py-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 hidden px-3 lg:block">
            <span className="eyebrow">Administration</span>
            <br />
            <span className="text-xs text-muted">{admin.globalName ?? admin.username}</span>
          </p>
          <AppNav
            layoutId="admin-nav"
            items={[
              { href: "/admin", label: "Vue d’ensemble" },
              { href: "/admin/utilisateurs", label: "Utilisateurs" },
              { href: "/admin/templates", label: "Templates" },
              { href: "/admin/offres", label: "Offres & quotas" },
              { href: "/admin/installations", label: "Installations" },
              { href: "/admin/sauvegardes", label: "Sauvegardes" },
              { href: "/admin/file", label: "File & bot" },
              { href: "/admin/ia", label: "IA & coûts" },
              { href: "/admin/journaux", label: "Journaux" },
              { href: "/admin/maintenance", label: "Maintenance" },
            ]}
          />
        </aside>
        <main id="contenu" className="min-w-0">
          {children}
        </main>
      </div>
    </>
  );
}
