import Link from "next/link";
import { TemplateTile } from "@/components/templates/template-tile";
import { THEME_LABELS } from "@mys/core";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BuildDemo } from "@/components/landing/build-demo";
import { RoleDemo } from "@/components/landing/role-demo";
import { BeforeAfter } from "@/components/landing/before-after";
import { ProgressDemo } from "@/components/landing/progress-demo";
import { StepsTimeline } from "@/components/landing/steps-timeline";
import { CubeMark } from "@/components/cube-mark";
import { AnimatedNumber, Marquee, Reveal, SplitText, Stagger, StaggerItem, Tilt } from "@/components/motion";
import { ButtonLink, colorHex } from "@/components/ui";
import { ChannelIcon, IconArrowRight, IconBot, IconCheck, IconHand, IconSave, IconShield, IconSparkle, IconCube } from "@/components/icons";
import { searchTemplates } from "@/lib/data";

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
  const totalChannels = templates.reduce((n, t) => n + t.stats.channels, 0);
  return (
    <>
      <SiteHeader />
      <main id="contenu">
        {/* ------------------------------ Héros ------------------------------ */}
        <section className="relative overflow-hidden">
          <div className="blueprint blueprint-fade pointer-events-none absolute inset-0" aria-hidden />
          <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-blue/10 blur-3xl" aria-hidden />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pt-14 pb-24 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:pt-20">
            <div>
              <Reveal y={10}>
                <div className="inline-flex items-center gap-3 rounded-full border border-line bg-surface/70 py-1 pr-4 pl-1.5 text-sm text-ink">
                  <CubeMark size={30} />
                  Templates complets · éditeur visuel · bot d’installation
                </div>
              </Reveal>
              <h1 className="mt-6 text-[2.7rem] leading-[1.02] font-extrabold sm:text-6xl lg:text-[4.2rem]">
                <SplitText text="Votre serveur Discord, construit pour de vrai." highlight="construit pour de vrai." delay={0.1} />
              </h1>
              <Reveal delay={0.5}>
                <p className="mt-6 max-w-xl text-lg text-ink">
                  Choisissez un modèle, ajustez-le en quelques clics, puis laissez notre bot tout installer : salons, rôles, permissions, messages, modération et accueil. Sans rien casser de l’existant.
                </p>
              </Reveal>
              <Reveal delay={0.65}>
                <div className="mt-8 flex flex-wrap gap-3">
                  <ButtonLink href="/templates" size="lg">
                    Créer mon serveur <IconArrowRight size={18} />
                  </ButtonLink>
                  <ButtonLink href="/fonctionnement" variant="secondary" size="lg">
                    Comment ça marche
                  </ButtonLink>
                </div>
              </Reveal>
              <Reveal delay={0.8}>
                <ul className="mt-8 grid gap-2 text-sm text-ink sm:grid-cols-2">
                  {["Gratuit : templates complets et installation", "Sauvegarde avant chaque modification", "Aucune suppression sans votre accord", "Chaque opération du bot suivie en direct"].map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                        <IconCheck size={11} />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
            <Reveal delay={0.3} y={30}>
              <Tilt max={3} className="group">
                <div className="rounded-[22px] border border-edge bg-night/80 p-2 shadow-[8px_8px_0_0_rgb(131_168_243/0.18)]">
                  <div className="flex items-center gap-1.5 px-3 pt-1.5 pb-2.5" aria-hidden>
                    <span className="size-2.5 rounded-full bg-danger/70" />
                    <span className="size-2.5 rounded-full bg-warning/70" />
                    <span className="size-2.5 rounded-full bg-success/70" />
                    <span className="ml-3 font-mono text-[11px] text-muted">installation en direct</span>
                  </div>
                  <BuildDemo />
                </div>
              </Tilt>
            </Reveal>
          </div>
        </section>

        {/* ---------------------------- Chiffres ----------------------------- */}
        <section className="border-y border-line bg-night/50">
          <Stagger className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 sm:px-6 md:grid-cols-4">
            {[
              [templates.length || 8, "templates complets et gratuits"],
              [totalChannels || 200, "salons déjà rédigés et organisés"],
              [0, "doublon en cas de relance"],
              [100, "% des opérations visibles en direct"],
            ].map(([n, label]) => (
              <StaggerItem key={label as string} className="px-2 py-7 text-center md:text-left">
                <p className="font-display text-4xl font-extrabold text-light">
                  <AnimatedNumber value={n as number} />
                </p>
                <p className="mt-1 text-sm text-muted">{label}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* ------------------------- Par où commencer ------------------------ */}
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <Reveal>
            <p className="eyebrow">Par où commencer ?</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-bold md:text-5xl">Trois façons de démarrer. Toutes simples.</h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { href: "/templates", icon: <IconCube size={22} />, title: "Partir d’un template", text: "Choisissez parmi des serveurs complets selon votre usage, puis personnalisez-les.", tag: "Gratuit" },
              { href: "/ia", icon: <IconSparkle size={22} />, title: "Décrire mon projet à l’IA", text: "Expliquez votre besoin en une phrase : l’IA conçoit un serveur sur mesure.", tag: "Premium" },
              { href: "/sauvegardes", icon: <IconSave size={22} />, title: "Protéger mon serveur", text: "Sauvegardez la configuration d’un serveur existant et restaurez-la au besoin.", tag: "Gratuit" },
            ].map((c) => (
              <StaggerItem key={c.href}>
                <Tilt className="group h-full">
                  <Link href={c.href} className="brick flex h-full flex-col p-6 transition-colors hover:border-blue">
                    <div className="flex items-center justify-between">
                      <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-on-accent transition-transform duration-500 ease-[var(--ease-snap)] group-hover:-rotate-6 group-hover:scale-110">{c.icon}</span>
                      <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-semibold text-ink">{c.tag}</span>
                    </div>
                    <h3 className="mt-6 text-2xl font-bold">{c.title}</h3>
                    <p className="mt-2 flex-1 text-ink">{c.text}</p>
                    <span className="mt-6 inline-flex items-center gap-1.5 font-semibold text-light">
                      Commencer <IconArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </Link>
                </Tilt>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* ------------------------------ Parcours ---------------------------- */}
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
          <Reveal>
            <p className="eyebrow">Le parcours</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-bold md:text-5xl">Du besoin au serveur installé.</h2>
          </Reveal>
          <div className="mt-14">
            <StepsTimeline />
          </div>
        </section>

        {/* ------------------------------ Templates --------------------------- */}
        {templates.length > 0 && (
          <section className="border-y border-line bg-night/40 py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <Reveal className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">Bibliothèque gratuite</p>
                  <h2 className="mt-3 text-3xl font-bold md:text-5xl">Des serveurs complets, pas des squelettes.</h2>
                  <p className="mt-3 max-w-xl text-ink">Rôles, permissions, messages rédigés, modération et accueil : tout est prêt.</p>
                </div>
                <ButtonLink href="/templates" variant="secondary">
                  Voir tous les templates <IconArrowRight size={16} />
                </ButtonLink>
              </Reveal>
            </div>
            <div className="mt-12">
              <Marquee speed={55}>
                {templates.map((t) => (
                  <TemplateTile key={t.id} t={t} className="w-[300px] shrink-0" />
                ))}
              </Marquee>
            </div>
          </section>
        )}

        {/* --------------------------- Voir comme ---------------------------- */}
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <Reveal>
            <p className="eyebrow">Aperçu interactif</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-bold md:text-5xl">Voyez votre serveur avec les yeux de chaque rôle.</h2>
            <p className="mt-4 max-w-2xl text-ink">Avant d’installer quoi que ce soit, vérifiez qui voit quoi et qui peut écrire où.</p>
          </Reveal>
          <Reveal className="mt-12" delay={0.1}>
            <RoleDemo />
          </Reveal>
        </section>

        {/* ---------------------------- Avant / après -------------------------- */}
        <section className="border-y border-line bg-night/40 py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
            <Reveal>
              <p className="eyebrow">Tenir compte de l’existant</p>
              <h2 className="mt-3 text-3xl font-bold md:text-5xl">Un serveur en désordre ? On l’organise sans rien perdre.</h2>
              <Stagger as="ul" className="mt-8 space-y-4 text-ink">
                {[
                  "Vos salons et rôles existants sont conservés par défaut, et les doublons évités.",
                  "Les anciens salons peuvent être archivés : masqués, avec tout leur historique.",
                  "Toute suppression est listée et exige une confirmation écrite.",
                  "Une sauvegarde de sécurité est prise avant chaque installation, même en gratuit.",
                ].map((t) => (
                  <StaggerItem as="li" key={t} className="flex gap-3">
                    <IconShield className="mt-0.5 shrink-0 text-light" />
                    <span>{t}</span>
                  </StaggerItem>
                ))}
              </Stagger>
            </Reveal>
            <Reveal delay={0.15}>
              <BeforeAfter before={BEFORE} after={AFTER} />
            </Reveal>
          </div>
        </section>

        {/* ------------------------------- Suivi ------------------------------ */}
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2">
          <Reveal>
            <ProgressDemo />
          </Reveal>
          <Reveal delay={0.1}>
            <p className="eyebrow">Installation fiable</p>
            <h2 className="mt-3 text-3xl font-bold md:text-5xl">Chaque ligne est une vraie opération du bot.</h2>
            <p className="mt-5 text-ink">
              Si le bot redémarre, l’installation reprend là où elle s’était arrêtée, sans créer de doublon. Un échec partiel est affiché comme tel : vous corrigez, vous relancez, seules les étapes manquantes sont rejouées.
            </p>
          </Reveal>
        </section>

        {/* ----------------------------- Qui fait quoi ------------------------- */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6" id="qui-fait-quoi">
          <Reveal>
            <p className="eyebrow">En toute transparence</p>
            <h2 className="mt-3 text-3xl font-bold md:text-5xl">Ce qui est automatique, et ce qui ne l’est pas.</h2>
          </Reveal>
          <Stagger className="mt-12 grid gap-5 md:grid-cols-3">
            <Column icon={<IconBot />} title="Installé par notre bot" items={["Catégories, salons, forums, vocaux", "Rôles, couleurs, hiérarchie, permissions", "Espaces privés du staff", "Messages, embeds et épingles", "Réglages, AutoMod, Communauté", "Onboarding et écran d’accueil"]} />
            <Column icon={<IconCheck />} title="Assuré au quotidien par le bot" items={["Rôles à choisir par boutons", "Validation du règlement", "Tickets privés vers l’équipe", "Suggestions avec votes", "Bienvenue et logs d’arrivées"]} />
            <Column icon={<IconHand />} title="À terminer vous-même, guidé" items={["Guide du serveur (absent de l’API Discord) : contenu prêt à copier", "Communauté si le bot n’est pas administrateur", "Création du serveur dans Discord"]} />
          </Stagger>
        </section>

        {/* ------------------------------- Appel ------------------------------- */}
        <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
          <Reveal>
            <div className="halo relative overflow-hidden rounded-[28px] border border-edge bg-surface px-8 py-14 text-center md:px-16">
              <div className="blueprint blueprint-fade pointer-events-none absolute inset-0" aria-hidden />
              <div className="relative flex flex-col items-center">
                <CubeMark size={96} />
                <h2 className="mt-6 text-3xl font-bold md:text-5xl">Prêt à construire le vôtre ?</h2>
                <p className="mt-3 max-w-xl text-ink">Templates complets, éditeur, installation et sauvegarde de sécurité : tout cela est gratuit.</p>
                <ButtonLink href="/templates" size="lg" className="mt-8">
                  Créer mon serveur gratuitement <IconArrowRight size={18} />
                </ButtonLink>
              </div>
            </div>
          </Reveal>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Column({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <StaggerItem className="panel h-full p-6">
      <div className="flex items-center gap-3 font-display text-lg font-semibold">
        <span className="flex size-10 items-center justify-center rounded-xl bg-mist text-light">{icon}</span>
        {title}
      </div>
      <ul className="mt-5 space-y-2.5 text-sm text-ink">
        {items.map((i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-blue" /> {i}
          </li>
        ))}
      </ul>
    </StaggerItem>
  );
}
