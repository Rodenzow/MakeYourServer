import Image from "next/image";
import { getCurrentUser } from "@/lib/session";
import { Logo } from "./logo";
import { ButtonLink } from "./ui";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";
import { IconArrowRight } from "./icons";
import { ScrollProgress } from "./scroll-progress";

const NAV = [
  { href: "/templates", label: "Templates" },
  { href: "/fonctionnement", label: "Comment ça marche" },
  { href: "/abonnement", label: "Offres" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  const avatar = user?.avatar ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64` : null;
  return (
    <header className="glass sticky top-0 z-40 border-b border-line/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <NavLinks items={NAV} />
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              {user.isAdmin && (
                <ButtonLink href="/admin" variant="ghost" size="sm">
                  Administration
                </ButtonLink>
              )}
              <ButtonLink href="/tableau-de-bord" variant="secondary" size="sm">
                {avatar ? <Image src={avatar} alt="" width={20} height={20} className="rounded-full" /> : null}
                Mon espace
              </ButtonLink>
            </>
          ) : (
            <>
              <ButtonLink href="/connexion" variant="ghost" size="sm">
                Se connecter
              </ButtonLink>
              <ButtonLink href="/templates" size="sm">
                Créer mon serveur <IconArrowRight size={15} />
              </ButtonLink>
            </>
          )}
        </div>
        <MobileNav items={[...NAV, ...(user ? [{ href: "/tableau-de-bord", label: "Mon espace" }, { href: "/publications", label: "Mes publications" }] : [{ href: "/connexion", label: "Se connecter" }]), ...(user?.isAdmin ? [{ href: "/admin", label: "Administration" }] : [])]} />
      </div>
      <ScrollProgress />
    </header>
  );
}
