import Image from "next/image";
import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean; dark?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5" aria-label="Make Your Server — accueil">
      <Image src="/brand/logo-64.png" alt="" width={34} height={34} className="rounded-[10px] ring-1 ring-edge transition-transform duration-500 ease-[var(--ease-snap)] group-hover:-rotate-12 group-hover:scale-110" priority />
      {!compact && (
        <span className="font-display text-[1.05rem] font-bold leading-none tracking-tight text-fg">
          Make Your <span className="text-gradient">Server</span>
        </span>
      )}
    </Link>
  );
}
