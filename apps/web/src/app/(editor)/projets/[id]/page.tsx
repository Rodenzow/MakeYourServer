import { notFound } from "next/navigation";
import { eq, getDb, users } from "@mys/db";
import { getEntitlement } from "@mys/engine";
import { ProjectEditor } from "@/components/editor/editor";
import { getAccessibleProject } from "@/lib/project-access";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Éditeur" };

export default async function EditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ depuis?: string; nouveautes?: string }> }) {
  const { id } = await params;
  const { depuis, nouveautes } = await searchParams;
  const user = await requireUser(`/projets/${id}`);
  // Propriétaire ou co-gestionnaire.
  const access = await getAccessibleProject(user.id, id);
  if (!access) notFound();
  const { project, role } = access;
  const [ent, owner] = await Promise.all([
    getEntitlement(user.id),
    role === "editor"
      ? getDb()
          .select({ username: users.username, globalName: users.globalName })
          .from(users)
          .where(eq(users.id, project.userId))
          .then((r) => r[0] ?? null)
      : null,
  ]);
  return (
    <ProjectEditor
      project={{ id: project.id, name: project.name, spec: project.spec, revision: project.revision }}
      fromTemplate={depuis === "template"}
      aiAvailable={ent.quotas.aiEditsPerMonth > 0}
      role={role}
      ownerName={owner ? (owner.globalName ?? owner.username) : null}
      showAdditions={nouveautes === "1"}
    />
  );
}
