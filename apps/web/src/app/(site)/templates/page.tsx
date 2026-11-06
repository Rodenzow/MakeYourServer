import { ButtonLink, PageHeader } from "@/components/ui";
import { IconSparkle } from "@/components/icons";
import { TemplateBrowser } from "@/components/templates/template-browser";
import { searchTemplates } from "@/lib/data";

export const metadata = { title: "Templates gratuits" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const templates = await searchTemplates({ sort: "popular" });
  return (
    <>
      <PageHeader eyebrow="Bibliothèque gratuite" title="Des templates complets, prêts à installer"
        help={{ href: "/aide#choisir-template" }}
        actions={
          <ButtonLink href="/trouver" variant="secondary">
            <IconSparkle size={16} /> Trouver le mien en 1 minute
          </ButtonLink>
        }
      >
        Chaque template comprend la structure, les rôles et leurs permissions, des messages rédigés, l’AutoMod et l’accueil des nouveaux membres. Vous pourrez tout personnaliser avant l’installation.
      </PageHeader>
      <TemplateBrowser initial={templates} />
    </>
  );
}
