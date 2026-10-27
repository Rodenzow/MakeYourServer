import { PageHeader } from "@/components/ui";

export const metadata = { title: "Compte suspendu" };

export default function Suspended() {
  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Accès restreint" title="Votre compte est suspendu">
        Suite à un usage contraire aux conditions d’utilisation, l’accès à votre espace a été suspendu par l’équipe. Si vous pensez qu’il s’agit d’une erreur, contactez-nous en indiquant votre identifiant Discord.
      </PageHeader>
    </div>
  );
}
