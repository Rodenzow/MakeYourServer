import { IconCheck, IconX } from "./icons";

export function StepIcon({ status }: { status: string }) {
  if (status === "succeeded") return <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-white"><IconCheck size={13} /></span>;
  if (status === "skipped") return <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-mist text-[10px] font-bold text-ink" title="Déjà fait">=</span>;
  if (status === "failed") return <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-danger text-white"><IconX size={13} /></span>;
  if (status === "cancelled") return <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-mist text-[10px] text-muted">—</span>;
  if (status === "running")
    return (
      <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-blue/50" />
        <span className="size-3 rounded-full bg-blue-strong" />
      </span>
    );
  return <span className="mt-0.5 size-5 shrink-0 rounded-full border-2 border-line" />;
}
