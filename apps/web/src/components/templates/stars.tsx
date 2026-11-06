import type { SVGProps } from "react";
import { formatRating } from "@/lib/community-rules";
import { cx } from "../ui";

const STAR_PATH = "M12 2.6l2.82 5.72 6.31.92-4.57 4.45 1.08 6.29L12 17.01l-5.64 2.97 1.08-6.29L2.87 9.24l6.31-.92L12 2.6z";

export function StarIcon({ size = 16, filled = true, ...p }: SVGProps<SVGSVGElement> & { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...p}>
      <path d={STAR_PATH} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.6} strokeLinejoin="round" />
    </svg>
  );
}

/** Étoiles en lecture seule, remplies au dixième près (4,6 → 4 étoiles et 60 % de la cinquième). */
export function Stars({ value, size = 16, className }: { value: number; size?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span role="img" aria-label={`Note : ${formatRating(value)} sur 5`} className={cx("relative inline-flex shrink-0 align-middle", className)}>
      <span className="flex text-edge">
        {[0, 1, 2, 3, 4].map((i) => (
          <StarIcon key={i} size={size} />
        ))}
      </span>
      <span className="absolute inset-y-0 left-0 flex overflow-hidden text-warning" style={{ width: `${pct}%` }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <StarIcon key={i} size={size} className="shrink-0" />
        ))}
      </span>
    </span>
  );
}

/** Format compact pour les cartes : ★ 4,6 (12) */
export function RatingPill({ average, count, className }: { average: number; count: number; className?: string }) {
  return (
    <span className={cx("inline-flex shrink-0 items-center gap-0.5 font-mono text-xs", className)} title={`${formatRating(average)} sur 5 · ${count} avis`}>
      <StarIcon size={12} className="text-warning" />
      <span className="sr-only">Note moyenne :</span>
      <span className="font-semibold text-fg">{formatRating(average)}</span>
      <span className="text-muted">
        ({count}
        <span className="sr-only"> avis</span>)
      </span>
    </span>
  );
}
