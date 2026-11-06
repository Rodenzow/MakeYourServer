import { notFound } from "next/navigation";
import { validateSpec } from "@mys/core";
import { InstallWizard } from "@/components/install/install-wizard";
import { getAccessibleProject } from "@/lib/project-access";
import { requireUser } from "@/lib/session";
import { env } from "@/lib/env";

export const metadata = { title: "Installer le projet" };

export default async function InstallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/projets/${id}/installer`);
  // Propriétaire ou co-gestionnaire : les droits Discord sur le serveur choisi sont revérifiés par le bot.
  const project = (await getAccessibleProject(user.id, id))?.project;
  if (!project) notFound();
  const v = validateSpec(project.spec);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <InstallWizard
        source={{ kind: "project", id: project.id, name: project.name, spec: project.spec }}
        validationErrors={v.errors.map((e) => e.message)}
        sandbox={env.sandbox}
      />
    </div>
  );
}
