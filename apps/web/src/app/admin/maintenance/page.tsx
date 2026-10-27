import { getSetting } from "@mys/db";
import { ActionButton } from "@/components/admin/action-button";
import { MaintenanceForm } from "@/components/admin/settings-forms";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Maintenance" };

export default async function MaintenancePage() {
  const m = await getSetting("maintenance");
  return (
    <>
      <PageHeader eyebrow="Administration" title="Maintenance">
        Interrompre temporairement les installations et prévenir les utilisateurs.
      </PageHeader>
      <MaintenanceForm initial={m} />
      <section className="panel mt-8 space-y-3 p-5">
        <h2 className="text-lg font-bold">Nettoyage</h2>
        <p className="text-sm text-muted">Le worker purge automatiquement chaque minute les sauvegardes expirées et les sessions périmées. Vous pouvez forcer la purge des sauvegardes ici.</p>
        <ActionButton url="/api/admin/backups/purge" label="Purger les sauvegardes expirées" confirm="Supprimer toutes les sauvegardes dont la durée de conservation est dépassée ?" successMessage="Purge effectuée." />
      </section>
    </>
  );
}
