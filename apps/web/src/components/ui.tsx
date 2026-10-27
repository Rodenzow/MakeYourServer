import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light";
const VARIANTS: Record<Variant, string> = {
  // Bouton principal : bleu clair du logo, bloc extrudé qui s’enfonce au clic.
  primary:
    "bg-accent text-on-accent border border-light shadow-[3px_3px_0_0_rgb(131_168_243/0.45)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_0_rgb(131_168_243/0.55)] hover:bg-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
  secondary:
    "bg-surface text-fg border border-edge shadow-[3px_3px_0_0_rgb(131_168_243/0.18)] hover:-translate-x-px hover:-translate-y-px hover:border-blue hover:shadow-[5px_5px_0_0_rgb(131_168_243/0.3)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
  light: "bg-accent text-on-accent border border-light hover:bg-white",
  ghost: "text-ink hover:text-fg hover:bg-mist border border-transparent",
  danger: "bg-danger/15 text-danger border border-danger/50 hover:bg-danger/25",
};
const SIZES = { sm: "h-8 px-3 text-sm gap-1.5", md: "h-10 px-4 text-[0.95rem] gap-2", lg: "h-12 px-6 text-base gap-2.5" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof SIZES = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center rounded-[11px] font-semibold whitespace-nowrap transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-[var(--ease-snap)] disabled:opacity-45 disabled:pointer-events-none select-none",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ href, variant = "primary", size = "md", className, children, ...rest }: { href: string; variant?: Variant; size?: keyof typeof SIZES; className?: string; children: ReactNode; target?: string; rel?: string; prefetch?: boolean }) {
  const external = href.startsWith("http");
  if (external)
    return (
      <a href={href} className={buttonClass(variant, size, className)} {...rest}>
        {children}
      </a>
    );
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

type Tone = "neutral" | "blue" | "success" | "warning" | "danger" | "night";
const TONES: Record<Tone, string> = {
  neutral: "bg-mist text-ink",
  blue: "bg-blue/15 text-blue-strong",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  night: "bg-accent text-on-accent",
};
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold", TONES[tone], className)}>{children}</span>;
}

export function Notice({ tone = "blue", title, children, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const accent = { neutral: "border-line", blue: "border-blue", success: "border-success", warning: "border-warning", danger: "border-danger", night: "border-edge" }[tone];
  const bg = { neutral: "bg-surface", blue: "bg-blue/[0.07]", success: "bg-success-soft/60", warning: "bg-warning-soft/60", danger: "bg-danger-soft/60", night: "bg-surface" }[tone];
  return (
    <div className={cx("rounded-xl border border-l-4 border-line px-4 py-3 text-sm", accent, bg, className)} role={tone === "danger" ? "alert" : undefined}>
      {title && <p className="font-semibold text-fg">{title}</p>}
      {children && <div className={cx("text-ink", !!title && "mt-1")}>{children}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
        {children && <div className="mt-2 text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel blueprint flex flex-col items-center px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="panel px-4 py-3">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="font-display text-2xl font-bold">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export const colorHex = (n: number | undefined | null) => (n ? `#${n.toString(16).padStart(6, "0")}` : "#99aab5");

export function formatDate(d: Date | string | null | undefined, withTime = true) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", withTime ? { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" } : { dateStyle: "medium", timeZone: "Europe/Paris" });
}
