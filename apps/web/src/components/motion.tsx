"use client";

import { animate, motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform, type HTMLMotionProps } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const EASE = [0.2, 0.9, 0.25, 1] as const;

/** Apparition au défilement (une seule fois), désactivée si l’utilisateur réduit les animations. */
export function Reveal({ children, delay = 0, y = 18, className, ...rest }: { children: ReactNode; delay?: number; y?: number; className?: string } & Omit<HTMLMotionProps<"div">, "children">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Conteneur qui fait apparaître ses enfants (StaggerItem) les uns après les autres. */
export function Stagger({ children, className, gap = 0.07, as = "div" }: { children: ReactNode; className?: string; gap?: number; as?: "div" | "ul" | "ol" }) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={reduce ? undefined : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </Comp>
  );
}

export function StaggerItem({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "li" }) {
  const Comp = motion[as];
  return (
    <Comp className={className} variants={{ hidden: { opacity: 0, y: 16, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: EASE } } }}>
      {children}
    </Comp>
  );
}

/** Titre révélé mot par mot. */
export function SplitText({ text, className, delay = 0, highlight }: { text: string; className?: string; delay?: number; highlight?: string }) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  const hl = new Set((highlight ?? "").split(" ").filter(Boolean));
  return (
    <span className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span
            className={`inline-block ${hl.has(w) ? "text-gradient" : ""}`}
            initial={reduce ? false : { y: "105%", rotate: 4 }}
            animate={{ y: "0%", rotate: 0 }}
            transition={{ duration: 0.75, delay: delay + i * 0.06, ease: EASE }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Nombre qui s’incrémente quand il entre à l’écran. */
export function AnimatedNumber({ value, className, duration = 1.1 }: { value: number; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  useEffect(() => {
    if (!inView || reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, { duration, ease: EASE, onUpdate: (v) => setDisplay(Math.round(v)) });
    return () => controls.stop();
  }, [inView, value, reduce, duration]);
  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}

/** Carte qui s’incline légèrement sous le pointeur (souris uniquement). */
export function Tilt({ children, className, max = 5 }: { children: ReactNode; className?: string; max?: number }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rx = useSpring(useTransform(y, [0, 1], [max, -max]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(x, [0, 1], [-max, max]), { stiffness: 200, damping: 20 });
  const glowX = useTransform(x, (v) => `${v * 100}%`);
  const glowY = useTransform(y, (v) => `${v * 100}%`);
  const glow = useTransform([glowX, glowY], ([gx, gy]) => `radial-gradient(260px circle at ${gx} ${gy}, rgb(184 215 255 / 0.10), transparent 60%)`);
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={`relative [transform-style:preserve-3d] ${className ?? ""}`}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left) / r.width);
        y.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => {
        x.set(0.5);
        y.set(0.5);
      }}
    >
      {children}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 [.group:hover_&]:opacity-100"
        style={{ background: glow }}
      />
    </motion.div>
  );
}

/** Défilement continu horizontal (pause au survol), dupliqué pour boucler sans couture. */
export function Marquee({ children, speed = 40 }: { children: ReactNode; speed?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className="flex gap-5 overflow-x-auto pb-4">{children}</div>;
  return (
    <div className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
      <div className="flex w-max gap-5 py-2 [animation:marquee_var(--d)_linear_infinite] group-hover:[animation-play-state:paused]" style={{ ["--d" as string]: `${speed}s` }}>
        {children}
        <div aria-hidden inert className="contents">
          {children}
        </div>
      </div>
      <style>{`@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </div>
  );
}
