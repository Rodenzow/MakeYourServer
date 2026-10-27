import { notFound } from "next/navigation";
import { getEntitlement } from "@mys/engine";
import { ProjectEditor } from "@/components/editor/editor";
import { getOwnedProject } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Éditeur" };

export default async function EditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ depuis?: string }> }) {
  const { id } = await params;
  const { depuis } = await searchParams;
  const user = await requireUser(`/projets/${id}`);
  const project = await getOwnedProject(user.id, id);
  if (!project) notFound();
  const ent = await getEntitlement(user.id);
  return (
    <ProjectEditor
      project={{ id: project.id, name: project.name, spec: project.spec, revision: project.revision }}
      fromTemplate={depuis === "template"}
      aiAvailable={ent.quotas.aiEditsPerMonth > 0}
    />
  );
}
