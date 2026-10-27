import { PageHeader } from "@/components/ui";
import { TemplateBrowser } from "@/components/templates/template-browser";
import { searchTemplates } from "@/lib/data";

export const metadata = { title: "Templates gratuits" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await searchTemplates({ sort: "popular" });
  return (
    <>
      <PageHeader eyebrow="Bibliothèque gratuite" title="Des templates complets, prêts à installer">
        Chaque template comprend la structure, les rôles et leurs permissions, des messages rédigés, l’AutoMod et l’accueil des nouveaux membres. Vous pourrez tout personnaliser avant l’installation.
      </PageHeader>
      <TemplateBrowser initial={templates} />
    </>
  );
}
