import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Make Your Server — votre serveur Discord, prêt à l’emploi", template: "%s · Make Your Server" },
  description:
    "Concevez votre serveur Discord sur le site (templates complets ou IA), personnalisez-le, puis laissez notre bot l’installer : salons, rôles, permissions, messages, AutoMod et onboarding.",
  icons: { icon: "/brand/logo-64.png", apple: "/brand/logo-192.png" },
};

export const viewport: Viewport = { themeColor: "#07142d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-night focus:px-4 focus:py-2 focus:text-white">
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}
