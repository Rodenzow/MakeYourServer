import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
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
