"use client";

import { motion, useReducedMotion } from "motion/react";
import { CubeMark } from "../cube-mark";
import { ButtonLink } from "../ui";
import { IconArrowRight } from "../icons";

const PIECES = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  const dist = 110 + (i % 3) * 40;
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist * 0.7, rotate: (i * 47) % 360, color: ["#b8d7ff", "#83a8f3", "#a7bdff", "#5fd39a"][i % 4]! };
});

/** Célébration de fin d’installation : le cube s’assemble et des blocs s’en échappent. */
export function SuccessBurst({ guildId, dryRun, projectId, kind }: { guildId: string; dryRun: boolean; projectId: string | null; kind: string }) {
  const reduce = useReducedMotion();
  return (
    <section className="halo relative overflow-hidden rounded-[24px] border border-edge bg-surface px-6 py-10 text-center">
      <div className="blueprint blueprint-fade pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto flex w-fit items-center justify-center">
        {!reduce &&
          PIECES.map((p, i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute size-2.5 rounded-[3px]"
              style={{ background: p.color }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
              animate={{ x: p.x, y: p.y, opacity: [0, 1, 0], scale: 1, rotate: p.rotate }}
              transition={{ duration: 1.4, delay: 0.55 + (i % 6) * 0.03, ease: [0.2, 0.9, 0.25, 1] }}
            />
          ))}
        <CubeMark size={110} />
      </div>
      <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }} className="relative">
        <h2 className="mt-6 text-3xl font-bold">{dryRun ? "Simulation réussie" : kind === "restore" ? "Restauration terminée" : "Votre serveur est prêt !"}</h2>
        <p className="mx-auto mt-2 max-w-lg text-ink">
          {dryRun ? "Toutes les étapes passeraient sans erreur. Vous pouvez maintenant lancer l’installation pour de vrai." : "Toutes les étapes ont réussi. Allez voir le résultat dans Discord, puis terminez les éventuelles étapes guidées ci-dessous."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {dryRun ? (
            projectId && (
              <ButtonLink href={`/projets/${projectId}/installer`} size="lg">
                Installer pour de vrai <IconArrowRight size={18} />
              </ButtonLink>
            )
          ) : (
            <ButtonLink href={`https://discord.com/channels/${guildId}`} size="lg" target="_blank" rel="noreferrer">
              Ouvrir le serveur dans Discord <IconArrowRight size={18} />
            </ButtonLink>
          )}
          <ButtonLink href="/sauvegardes" variant="secondary" size="lg">
            Voir mes sauvegardes
          </ButtonLink>
        </div>
      </motion.div>
    </section>
  );
}
