import Link from "next/link";
import { TemplateEditor } from "@/components/admin/template-editor";
import { PageHeader } from "@/components/ui";
import { sizeOptions, themeOptions } from "../options";

export const metadata = { title: "Nouveau template" };

const EMPTY_SPEC = {
  version: 1,
  meta: { name: "Nouveau template", theme: "autre", size: "medium" },
  everyone: { permissions: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY", "CONNECT", "SPEAK"] },
  roles: [],
  categories: [],
};

export default function NewTemplate() {
  return (
    <>
      <PageHeader eyebrow="Templates" title="Nouveau template" actions={<Link href="/admin/templates" className="text-sm text-muted hover:text-fg">← Retour</Link>}>
        Le template est créé en brouillon. Sa publication est une action distincte, après validation.
      </PageHeader>
      <TemplateEditor
        initial={{ name: "", slug: "", tagline: "", description: "", audience: "", highlights: [], theme: "autre", size: "medium", popularity: 0, official: false, spec: EMPTY_SPEC }}
        themes={themeOptions}
        sizes={sizeOptions}
      />
    </>
  );
}
