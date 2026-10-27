import Image from "next/image";
import Link from "next/link";
import { cx } from "./ui";

export function Logo({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5" aria-label="Make Your Server — accueil">
      <Image src="/brand/logo-64.png" alt="" width={34} height={34} className="rounded-[9px] ring-2 ring-night transition-transform duration-300 group-hover:-rotate-6" priority />
      {!compact && (
        <span className={cx("font-display text-[1.05rem] font-bold leading-none tracking-tight", dark ? "text-white" : "text-night")}>
          Make Your <span className={dark ? "text-light" : "text-blue-strong"}>Server</span>
        </span>
      )}
    </Link>
  );
}
