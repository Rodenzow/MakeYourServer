"use client";

import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";

/** Fine barre de progression de lecture, sous l’en-tête. */
export function ScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.3 });
  if (reduce) return null;
  return <motion.div aria-hidden style={{ scaleX }} className="absolute inset-x-0 bottom-[-1px] h-[2px] origin-left bg-[linear-gradient(90deg,var(--color-blue),var(--color-light),var(--color-peri))]" />;
}
