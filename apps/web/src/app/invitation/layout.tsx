import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

/**
 * Pages d’invitation : hors du groupe (site) pour que la redirection vers la
 * connexion soit une vraie redirection HTTP (pas d’écran de chargement en flux).
 */
export default function InvitationLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
