import { Badge } from "../ui";

const MAP: Record<string, [string, "success" | "warning" | "danger" | "neutral" | "blue"]> = {
  planned: ["Analyse", "neutral"],
  queued: ["En file", "blue"],
  running: ["En cours", "blue"],
  succeeded: ["Réussie", "success"],
  partial: ["Partielle", "warning"],
  failed: ["Échouée", "danger"],
  cancelled: ["Annulée", "neutral"],
};

export function InstallStatusBadge({ status }: { status: string }) {
  const [label, tone] = MAP[status] ?? [status, "neutral"];
  return <Badge tone={tone}>{label}</Badge>;
}
