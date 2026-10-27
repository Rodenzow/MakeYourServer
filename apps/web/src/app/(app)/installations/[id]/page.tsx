import { InstallationProgress } from "@/components/install/installation-progress";

export const metadata = { title: "Suivi d’installation" };

export default async function InstallationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InstallationProgress id={id} />;
}
