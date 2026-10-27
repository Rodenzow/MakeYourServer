import { SiteHeader } from "@/components/site-header";
import { requireUser } from "@/lib/session";

export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <>
      <SiteHeader />
      <main id="contenu">{children}</main>
    </>
  );
}
