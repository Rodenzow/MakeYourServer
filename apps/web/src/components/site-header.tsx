import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/session";
import { Logo } from "./logo";
import { ButtonLink } from "./ui";
import { MobileNav } from "./mobile-nav";

const NAV = [
  { href: "/templates", label: "Templates" },
  { href: "/fonctionnement", label: "Fonctionnement" },
  { href: "/abonnement", label: "Offres" },
];

export async function SiteHeader({ dark = false }: { dark?: boolean }) {
  const user = await getCurrentUser();
  const avatar = user?.avatar ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64` : null;
  const linkCls = dark ? "text-light/80 hover:text-white" : "text-ink hover:text-night";
  return (
    <header className={dark ? "relative z-20" : "sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur"}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo dark={dark} />
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex" aria-label="Navigation principale">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={linkCls}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              {user.isAdmin && (
                <Link href="/admin" className={`text-sm font-medium ${linkCls}`}>
                  Administration
                </Link>
              )}
              <ButtonLink href="/tableau-de-bord" variant={dark ? "light" : "secondary"} size="sm">
                {avatar ? <Image src={avatar} alt="" width={20} height={20} className="rounded-full" /> : null}
                Mon espace
              </ButtonLink>
            </>
          ) : (
            <ButtonLink href="/connexion" variant={dark ? "light" : "primary"} size="sm">
              Se connecter avec Discord
            </ButtonLink>
          )}
        </div>
        <MobileNav dark={dark} items={[...NAV, ...(user ? [{ href: "/tableau-de-bord", label: "Mon espace" }] : [{ href: "/connexion", label: "Se connecter" }]), ...(user?.isAdmin ? [{ href: "/admin", label: "Administration" }] : [])]} />
      </div>
    </header>
  );
}
