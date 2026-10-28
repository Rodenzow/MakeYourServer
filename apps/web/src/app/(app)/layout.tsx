import { SiteHeader } from "@/components/site-header";
import { AppNav } from "@/components/app/app-nav";
import { requireUser } from "@/lib/session";
import { getEntitlement } from "@mys/engine";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const ent = await getEntitlement(user.id);
  return (
    <>
      <SiteHeader />
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:py-10">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 hidden truncate px-3 text-xs text-muted lg:block">
            Connecté : <strong className="text-fg">{user.globalName ?? user.username}</strong>
            <br />
            Offre : <strong className="text-fg">{ent.planName}</strong>
          </p>
          <AppNav
            items={[
              { href: "/tableau-de-bord", label: "Tableau de bord" },
              { href: "/projets", label: "Projets" },
              { href: "/ia", label: "Conception IA", badge: ent.planKey === "premium" ? undefined : "Premium" },
              { href: "/serveurs", label: "Serveurs" },
              { href: "/installations", label: "Installations" },
              { href: "/sauvegardes", label: "Sauvegardes" },
              { href: "/publications", label: "Mes publications" },
              { href: "/abonnement", label: "Abonnement" },
            ]}
          />
          <form action="/api/auth/logout" method="post" className="mt-4 hidden lg:block">
            <button className="px-3 text-sm text-muted hover:text-fg">Se déconnecter</button>
          </form>
        </aside>
        <main id="contenu" className="min-w-0">
          {children}
        </main>
      </div>
    </>
  );
}
