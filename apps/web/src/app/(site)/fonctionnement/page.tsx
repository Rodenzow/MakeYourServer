import { PageHeader, Notice, ButtonLink } from "@/components/ui";

export const metadata = { title: "Fonctionnement et limites" };

const ROWS: Array<[string, string, string]> = [
  ["Catégories, salons textuels, vocaux, forums, positions, descriptions", "Bot (API Discord)", "Automatique"],
  ["Salons d’annonces et conférences", "Bot (API Discord)", "Automatique si la Communauté est active ; sinon créés en salon standard"],
  ["Rôles, couleurs, hiérarchie, permissions générales", "Bot (API Discord)", "Automatique, sous le rôle du bot"],
  ["Permissions particulières des salons, espaces privés du staff", "Bot (API Discord)", "Automatique"],
  ["Messages, embeds, mentions des rôles et salons créés", "Bot (API Discord)", "Automatique"],
  ["Épingles", "Bot (API Discord)", "Automatique si le bot a « Épingler des messages »"],
  ["Niveau de vérification, filtre, notifications, salon système, AFK", "Bot (API Discord)", "Automatique"],
  ["AutoMod", "Discord (natif), configuré par le bot", "Automatique (6 règles mots-clés max)"],
  ["Activation de la Communauté", "Bot (API Discord)", "Automatique si le bot est Administrateur ; sinon guidé"],
  ["Onboarding (questions, rôles et salons associés)", "Discord (natif), configuré par le bot", "Automatique avec la Communauté"],
  ["Écran d’accueil", "Discord (natif), configuré par le bot", "Automatique avec la Communauté"],
  ["Guide du serveur", "Discord (natif)", "Manuel guidé : non exposé par l’API publique"],
  ["Boutons de rôles, validation du règlement", "Notre bot", "Fonctionne tant que le bot est sur le serveur"],
  ["Tickets privés, suggestions avec votes", "Notre bot", "Fonctionne tant que le bot est sur le serveur"],
  ["Message de bienvenue, logs d’arrivées", "Notre bot", "Nécessite l’intention « Server Members »"],
  ["Création du serveur lui-même", "Vous, dans Discord", "Manuel : l’API ne permet plus aux applications de créer un serveur"],
  ["Icône, bannière, émojis, autocollants", "—", "Non inclus dans les projets pour l’instant"],
];

export default function HowPage() {
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="Transparence" title="Comment fonctionne Make Your Server">
        Nous préférons vous dire exactement ce qui est automatique et ce qui ne l’est pas. Rien n’est présenté comme configuré s’il ne l’est pas réellement.
      </PageHeader>

      <section className="space-y-4 text-ink">
        <h2 className="text-2xl font-bold">Le parcours</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li><strong>Template, projet, sauvegarde.</strong> Un <em>template</em> est un modèle public et réutilisable. Un <em>projet</em> est votre version personnelle, privée, modifiable. Une <em>sauvegarde</em> est un état réellement récupéré depuis un serveur. Une <em>installation</em> applique un projet ou une sauvegarde sur un serveur autorisé.</li>
          <li><strong>Personnalisation.</strong> L’éditeur vérifie en continu la cohérence : un rôle supprimé est retiré de toutes les permissions, boutons et questions qui l’utilisaient.</li>
          <li><strong>Analyse.</strong> Avant d’installer, le site lit l’état réel du serveur via le bot : vos droits, ceux du bot, sa position dans la hiérarchie, les limites de Discord et les éléments déjà présents.</li>
          <li><strong>Installation.</strong> Une sauvegarde de sécurité est prise, puis le bot exécute chaque opération via une file de tâches persistante. En cas d’interruption, il reprend sans créer de doublon (chaque élément créé est mémorisé).</li>
          <li><strong>Suivi.</strong> Chaque étape affiche son vrai résultat. Une installation partielle est indiquée comme telle et peut être relancée.</li>
        </ol>
      </section>

      <section className="mt-12" id="limites">
        <h2 className="text-2xl font-bold">Qui fait quoi ?</h2>
        <div className="panel mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-mist/60 text-xs text-muted">
              <tr>
                <th className="px-4 py-2">Élément</th>
                <th className="px-4 py-2">Assuré par</th>
                <th className="px-4 py-2">Mise en place</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ROWS.map(([a, b, c]) => (
                <tr key={a}>
                  <td className="px-4 py-2.5 font-medium">{a}</td>
                  <td className="px-4 py-2.5">{b}</td>
                  <td className="px-4 py-2.5 text-muted">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-2xl font-bold">Sauvegardes et restaurations : ce qui est possible</h2>
        <Notice tone="warning" title="Une restauration n’est pas une remise à l’identique">
          Discord ne permet pas de réutiliser un identifiant supprimé. Un salon ou un rôle recréé obtient un nouvel identifiant ; l’historique d’un salon supprimé n’est pas récupérable. Avec le Premium, les messages exportés peuvent être republiés par un webhook, avec le nom de leur auteur et leur date d’origine indiquée dans le texte : il s’agit d’une republication, pas des messages d’origine.
        </Notice>
        <p>
          <strong>Archiver</strong> un salon le déplace dans une catégorie « 📦 Archives » masquée aux membres : son historique reste intact. <strong>Supprimer</strong> un salon efface définitivement son historique ; c’est pourquoi toute suppression exige que vous retapiez le nom du serveur.
        </p>
      </section>

      <section className="mt-12 space-y-3">
        <h2 className="text-2xl font-bold">Permissions du bot</h2>
        <p>
          Discord interdit à un bot d’accorder une permission qu’il ne possède pas, et réserve l’activation de la Communauté aux administrateurs. Nous recommandons donc d’inviter le bot avec la permission Administrateur le temps de l’installation, puis de la retirer si vous le souhaitez : les boutons du serveur continueront de fonctionner avec « Gérer les rôles », « Gérer les fils » et « Envoyer des messages ».
        </p>
      </section>

      <div className="mt-12">
        <ButtonLink href="/templates">Voir les templates</ButtonLink>
      </div>
    </div>
  );
}
