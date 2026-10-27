import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t-2 border-night bg-night text-light/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo dark />
          <p className="mt-4 max-w-sm text-sm">
            Préparez votre serveur Discord sur le site, laissez notre bot l’installer. Make Your Server n’est pas affilié à Discord Inc.
          </p>
        </div>
        <FooterCol title="Produit" links={[["/templates", "Templates"], ["/fonctionnement", "Fonctionnement"], ["/abonnement", "Offres"]]} />
        <FooterCol title="Mon espace" links={[["/tableau-de-bord", "Tableau de bord"], ["/sauvegardes", "Sauvegardes"], ["/serveurs", "Serveurs"]]} />
        <FooterCol title="Informations" links={[["/confidentialite", "Confidentialité"], ["/fonctionnement#limites", "Ce que Discord ne permet pas"]]} />
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <p className="eyebrow !text-light/50">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
