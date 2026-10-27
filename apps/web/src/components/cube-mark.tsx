"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Le cube du logo, en trois faces qui viennent s’assembler, puis le curseur « clique ».
 * Animation signature : un serveur qui se construit.
 */
export function CubeMark({ size = 120, loop = false, className }: { size?: number; loop?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const spring = { type: "spring" as const, stiffness: 120, damping: 14 };
  const repeat = loop && !reduce ? { repeat: Infinity, repeatDelay: 2.4, repeatType: "reverse" as const } : {};
  const face = (from: { x?: number; y?: number; rotate?: number }, delay: number) =>
    reduce ? {} : { initial: { opacity: 0, ...from }, animate: { opacity: 1, x: 0, y: 0, rotate: 0 }, transition: { ...spring, delay, ...repeat } };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="Logo Make Your Server">
      <defs>
        <linearGradient id="cm-right" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9ecff" />
          <stop offset="1" stopColor="#83a8f3" />
        </linearGradient>
        <linearGradient id="cm-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1d3d78" />
          <stop offset="1" stopColor="#0f2350" />
        </linearGradient>
      </defs>
      {/* Face supérieure */}
      <motion.path d="M50 12 L83 30.5 L50 49 L17 30.5 Z" fill="url(#cm-top)" stroke="#2f5196" strokeWidth="0.8" strokeLinejoin="round" {...face({ y: -26, rotate: -8 }, 0.05)} />
      {/* Face gauche */}
      <motion.path d="M15 34 L48 52.5 L48 89 L15 70.5 Z" fill="#0b1c42" stroke="#2f5196" strokeWidth="0.8" strokeLinejoin="round" {...face({ x: -24, y: 8, rotate: 6 }, 0.18)} />
      {/* Face droite (claire, comme sur le logo) */}
      <motion.path d="M85 34 L85 70.5 L52 89 L52 52.5 Z" fill="url(#cm-right)" strokeLinejoin="round" {...face({ x: 24, y: 8, rotate: -6 }, 0.31)} />
      {/* Curseur */}
      <motion.path
        d="M47 40 L47 60 L52 55.5 L56 63 L59.5 61.2 L55.6 54 L62 53.4 Z"
        fill="#eef3ff"
        stroke="#07142d"
        strokeWidth="1.4"
        strokeLinejoin="round"
        {...(reduce ? {} : { initial: { opacity: 0, scale: 0.4, x: 10, y: 10 }, animate: { opacity: 1, scale: [0.4, 1.12, 0.94, 1], x: 0, y: 0 }, transition: { delay: 0.75, duration: 0.6, ...repeat } })}
        style={{ transformOrigin: "52px 52px" }}
      />
    </svg>
  );
}
