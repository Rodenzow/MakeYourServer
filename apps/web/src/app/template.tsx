"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Transition entre les pages : fondu (sans transformation, pour ne pas perturber
 * les éléments fixes comme les panneaux latéraux et les fenêtres).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
