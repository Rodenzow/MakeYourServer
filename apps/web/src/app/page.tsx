import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BuildDemo } from "@/components/landing/build-demo";
import { RoleDemo } from "@/components/landing/role-demo";
import { BeforeAfter } from "@/components/landing/before-after";
import { ProgressDemo } from "@/components/landing/progress-demo";
import { ButtonLink, colorHex } from "@/components/ui";
import { IconArrowRight, IconBot, IconCheck, IconHand, IconShield, ChannelIcon } from "@/components/icons";
import { searchTemplates } from "@/lib/data";
import { THEME_LABELS } from "@mys/core";

export const dynamic = "force-dynamic";

const BEFORE = [
  { key: "a", name: "Salons textuels", channels: ["général", "général-2", "annonces", "regles", "memes", "test", "bot-commands", "nouveau-salon"].map((n) => ({ key: n, name: n, type: "text" })) },
  { key: "b", name: "Salons vocaux", channels: ["Général", "vocal 2"].map((n) => ({ key: n, name: n, type: "voice" })) },
];
const AFTER = [
  { key: "1", name: "📌 Bienvenue", channels: [["👋・bienvenue", "text"], ["📜・règlement", "text"], ["📣・annonces", "announcement"], ["🎭・rôles", "text"]].map(([n, t]) => ({ key: n!, name: n!, type: t! })) },
  { key: "2", name: "💬 Discussions", channels: [["💬・général", "text"], ["📸・médias", "text"], ["🤝・entraide", "forum"]].map(([n, t]) => ({ key: n!, name: n!, type: t! })) },
  { key: "3", name: "🔊 Vocaux", channels: [["🛋️ Détente", "voice"], ["🎮 Session jeux", "voice"]].map(([n, t]) => ({ key: n!, name: n!, type: t! })) },
  { key: "4", name: "🛡️ Équipe", channels: [["🗂️・staff", "text"], ["📋・logs", "text"]].map(([n, t]) => ({ key: n!, name: n!, type: t!, private: true })) },
];

export default async function Home() {
  const templates = (await searchTemplates({ sort: "popular" }).catch(() => [])).slice(0, 8);
  return (
    <>
      <div className="blueprint-dark text-white">
        <SiteHeader dark />
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:pt-16" id="contenu">
          <div>
            <p className="eyebrow !text-light/70">Templates complets · éditeur visuel · bot d’installation</p>
            <h1 className="mt-4 text-[2.6rem] leading-[1.02] font-extrabold sm:text-6xl">
              Votre serveur Discord,
              <br />
              <span className="text-light">construit pour de vrai.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-light/80">
              Choisissez un template ou décrivez votre projet, ajustez salons, rôles et messages sur le site, puis laissez notre bot tout installer sur votre serveur. Sans rien casser de l’existant.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/templates" variant="light" size="lg">
                Choisir un template <IconArrowRight size={18} />
              </ButtonLink>
              <ButtonLink href="/fonctionnement" variant="ghost" size="lg" className="!text-light hover:!bg-white/10">
                Comment ça marche
              </ButtonLink>
            </div>
            <ul className="mt-8 grid gap-2 text-sm text-light/75 sm:grid-cols-2">
              {["Gratuit : templates complets et installation", "Sauvegarde de sécurité avant chaque modification", "Aucune suppression sans votre confirmation", "Suivi réel de chaque opération du bot"].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <IconCheck size={16} className="mt-0.5 shrink-0 text-light" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <BuildDemo />
        </section>
      </div>

      <main>
        {/* Étapes */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <p className="eyebrow">Le parcours</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-bold md:text-4xl">Du besoin au serveur installé, en quatre étapes.</h2>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-[18px] border-2 border-night bg-night md:grid-cols-4">
            {[
              ["Choisir", "Un template gratuit adapté à votre usage, ou une conception sur mesure par l’IA (Premium)."],
              ["Personnaliser", "Renommez, réorganisez, ajustez rôles, permissions, messages et fonctionnalités. Brouillon enregistré."],
              ["Inviter le bot", "Créez votre serveur dans Discord (ou choisissez-en un), puis invitez le bot en un clic."],
              ["Installer et suivre", "Analyse de l’existant, confirmation, puis installation suivie étape par étape."],
            ].map(([t, d], i) => (
              <li key={t} className="bg-white p-6">
                <span className="font-mono text-sm text-blue-strong">0{i + 1}</span>
                <h3 className="mt-2 text-xl font-bold">{t}</h3>
                <p className="mt-2 text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Templates */}
        {templates.length > 0 && (
          <section className="border-y-2 border-night bg-mist/60 py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">Bibliothèque gratuite</p>
                  <h2 className="mt-2 text-3xl font-bold md:text-4xl">Des serveurs complets, pas des squelettes.</h2>
                  <p className="mt-2 max-w-xl text-muted">Chaque template contient ses rôles, permissions, messages rédigés, règles AutoMod et parcours d’accueil.</p>
                </div>
                <ButtonLink href="/templates" variant="secondary">
                  Toute la bibliothèque <IconArrowRight size={16} />
                </ButtonLink>
              </div>
              <div className="mt-10 -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
                {templates.map((t) => (
                  <Link key={t.id} href={`/templates/${t.slug}`} className="brick group w-[280px] shrink-0 snap-start overflow-hidden transition-transform hover:-translate-y-1">
                    <div className="h-2" style={{ background: colorHex(t.accentColor) }} />
                    <div className="p-5">
                      <p className="eyebrow">{THEME_LABELS[t.theme as keyof typeof THEME_LABELS] ?? t.theme}</p>
                      <h3 className="mt-1 text-lg leading-tight font-bold">{t.name}</h3>
                      <p className="mt-2 line-clamp-2 text-sm text-muted">{t.tagline}</p>
                      <ul className="mt-4 space-y-1 text-[13px] text-ink">
                        {t.preview.categories.slice(0, 2).flatMap((c) => c.channels.slice(0, 2)).map((ch) => (
                          <li key={ch.name} className="flex items-center gap-1.5">
                            <ChannelIcon type={ch.type} size={14} className="text-muted" /> {ch.name}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-4 font-mono text-xs text-muted">
                        {t.stats.channels} salons · {t.stats.roles} rôles · {t.stats.messages} messages
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Voir comme ce rôle */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <p className="eyebrow">Prévisualisation interactive</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-bold md:text-4xl">Voyez votre serveur avec les yeux de chaque rôle.</h2>
          <p className="mt-3 max-w-2xl text-muted">Avant d’installer quoi que ce soit, vérifiez qui voit quoi et qui peut écrire où. Les permissions sont contrôlées pour éviter les fuites de salons privés.</p>
          <div className="mt-10">
            <RoleDemo />
          </div>
        </section>

        {/* Avant / après */}
        <section className="blueprint border-y-2 border-night py-20">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Tenir compte de l’existant</p>
              <h2 className="mt-2 text-3xl font-bold md:text-4xl">Un serveur en désordre ? On l’organise sans rien perdre.</h2>
              <ul className="mt-6 space-y-3 text-ink">
                <li className="flex gap-3"><IconShield className="mt-0.5 shrink-0 text-blue-strong" /> Par défaut, vos salons et rôles existants sont conservés. Les homonymes sont réutilisés plutôt que dupliqués.</li>
                <li className="flex gap-3"><IconShield className="mt-0.5 shrink-0 text-blue-strong" /> <span>Les anciens salons peuvent être <strong>archivés</strong> : déplacés et masqués, avec tout leur historique.</span></li>
                <li className="flex gap-3"><IconShield className="mt-0.5 shrink-0 text-blue-strong" /> Toute suppression est listée, expliquée et exige une confirmation écrite.</li>
                <li className="flex gap-3"><IconShield className="mt-0.5 shrink-0 text-blue-strong" /> Une sauvegarde de sécurité de la configuration est prise avant chaque installation, même en gratuit.</li>
              </ul>
            </div>
            <BeforeAfter before={BEFORE} after={AFTER} />
          </div>
        </section>

        {/* Suivi */}
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1fr]">
          <ProgressDemo />
          <div>
            <p className="eyebrow">Installation fiable</p>
            <h2 className="mt-2 text-3xl font-bold md:text-4xl">Chaque ligne est une vraie opération du bot.</h2>
            <p className="mt-4 text-muted">
              L’installation passe par une file de tâches persistante qui respecte les limites de l’API Discord. Si le bot redémarre, elle reprend là où elle s’était arrêtée, sans créer de doublon. Un échec partiel est affiché comme tel, jamais comme une réussite.
            </p>
          </div>
        </section>

        {/* Honnêteté */}
        <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6" id="qui-fait-quoi">
          <p className="eyebrow">Qui fait quoi</p>
          <h2 className="mt-2 text-3xl font-bold md:text-4xl">Ce qui est automatique, et ce qui ne l’est pas.</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Column icon={<IconBot />} title="Installé par notre bot (API Discord)" items={["Catégories, salons, forums, vocaux, positions", "Rôles, couleurs, hiérarchie, permissions", "Permissions particulières des salons privés", "Messages, embeds et épingles", "Réglages du serveur, AutoMod", "Communauté, onboarding, écran d’accueil"]} />
            <Column icon={<IconCheck />} title="Assuré par notre bot au quotidien" items={["Boutons de rôles et validation du règlement", "Tickets privés pour contacter l’équipe", "Boîte à suggestions avec votes", "Message de bienvenue et logs d’arrivées"]} />
            <Column icon={<IconHand />} title="À terminer vous-même (guidé)" items={["Guide du serveur (non disponible dans l’API publique) : contenu prêt à copier", "Activation de la Communauté si le bot n’est pas administrateur", "Création du serveur dans Discord (l’API ne le permet plus aux bots)"]} />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
          <div className="brick blueprint flex flex-col items-start justify-between gap-6 p-8 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-bold md:text-3xl">Prêt à construire le vôtre ?</h2>
              <p className="mt-1 text-muted">L’offre gratuite inclut les templates complets, l’éditeur, l’installation et la sauvegarde de sécurité.</p>
            </div>
            <ButtonLink href="/templates" size="lg">
              Commencer gratuitement <IconArrowRight size={18} />
            </ButtonLink>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Column({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2 font-display font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-night text-light">{icon}</span>
        {title}
      </div>
      <ul className="mt-4 space-y-2 text-sm text-ink">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-blue" /> {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
