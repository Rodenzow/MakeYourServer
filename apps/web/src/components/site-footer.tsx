import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-28 border-t border-line bg-night/80 text-ink">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm">
            Préparez votre serveur Discord sur le site, laissez notre bot l’installer. Make Your Server n’est pas affilié à Discord Inc.
          </p>
        </div>
        <FooterCol title="Produit" links={[["/templates", "Templates"], ["/fonctionnement", "Fonctionnement"], ["/abonnement", "Offres"]]} />
        <FooterCol title="Mon espace" links={[["/tableau-de-bord", "Tableau de bord"], ["/sauvegardes", "Sauvegardes"], ["/publications", "Mes publications"]]} />
        <FooterCol title="Informations" links={[["/conditions", "Conditions d’utilisation"], ["/confidentialite", "Confidentialité"], ["/conditions#publication", "Règles de publication"], ["/fonctionnement#limites", "Ce que Discord ne permet pas"]]} />
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <p className="eyebrow">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="hover:text-fg">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
