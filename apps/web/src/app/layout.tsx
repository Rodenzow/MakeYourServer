import type { Metadata, Viewport } from "next";
import "./globals.css";
import { analyticsToken } from "@/lib/env";

const DESCRIPTION =
  "Concevez votre serveur Discord sur le site (templates complets ou IA), personnalisez-le, puis laissez notre bot l’installer : salons, rôles, permissions, messages, AutoMod et onboarding.";

/** Adresse publique du site : sert de base aux liens absolus des images de partage. */
function siteUrl() {
  try {
    return new URL(process.env.APP_URL || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

// Calculé à chaque requête : APP_URL n’est connue qu’à l’exécution sur Cloudflare.
export function generateMetadata(): Metadata {
  return {
    metadataBase: siteUrl(),
    title: { default: "Make Your Server — votre serveur Discord, prêt à l’emploi", template: "%s · Make Your Server" },
    description: DESCRIPTION,
    icons: { icon: "/brand/logo-64.png", apple: "/brand/logo-192.png" },
    // Aperçu des liens partagés (Discord, X, WhatsApp…). L’image vient de opengraph-image.tsx ;
    // sans titre ici, chaque page garde son propre titre dans l’aperçu.
    openGraph: { type: "website", siteName: "Make Your Server", locale: "fr_FR" },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = { themeColor: "#07142d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Cloudflare Web Analytics (facultatif, CF_ANALYTICS_TOKEN) : mesure d’audience sans cookie.
  const cfToken = analyticsToken();
  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-night focus:px-4 focus:py-2 focus:text-white">
          Aller au contenu
        </a>
        {children}
        {cfToken && <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={JSON.stringify({ token: cfToken })} />}
      </body>
    </html>
  );
}
