import Link from "next/link";
import { notFound } from "next/navigation";
import { MODE_LABELS } from "@mys/core";
import { eq, getDb, users } from "@mys/db";
import { getInstallationWithSteps } from "@mys/engine";
import { ActionButton } from "@/components/admin/action-button";
import { StepIcon } from "@/components/step-icon";
import { Badge, Notice, PageHeader, Stat, formatDate } from "@/components/ui";
import { INSTALL_STATUS_LABELS, INSTALL_STATUS_TONE } from "@/lib/admin";

export const metadata = { title: "Installation" };

export default async function AdminInstallation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getInstallationWithSteps(id);
  if (!data) notFound();
  const { installation: i, steps } = data;
  const [owner] = await getDb().select({ id: users.id, username: users.username }).from(users).where(eq(users.id, i.userId));
  const count = (s: string) => steps.filter((x) => x.status === s).length;
  return (
    <>
      <PageHeader
        eyebrow={i.kind === "restore" ? "Restauration" : "Installation"}
        title={i.guildName}
        actions={
          ["partial", "failed"].includes(i.status) ? (
            <ActionButton url={`/api/admin/installations/${i.id}`} label="Relancer les étapes en échec" variant="primary" confirm="Relancer cette installation au nom de son propriétaire ? Seules les étapes en échec seront rejouées." />
          ) : undefined
        }
      >
        <Badge tone={INSTALL_STATUS_TONE[i.status]}>{INSTALL_STATUS_LABELS[i.status] ?? i.status}</Badge> {i.dryRun && <Badge>simulation</Badge>}
        <p className="mt-1 text-xs">
          Serveur <span className="font-mono">{i.guildId}</span> · par{" "}
          <Link href={`/admin/utilisateurs/${i.userId}`} className="underline">{owner?.username ?? i.userId}</Link> · mode {MODE_LABELS[i.plan.mode] ?? i.plan.mode} · via {i.origin === "discord" ? "Discord" : "le site"}
        </p>
        <Link href="/admin/installations" className="mt-1 inline-block text-sm text-muted hover:text-night">← Toutes les installations</Link>
      </PageHeader>

      {i.error && <Notice tone={i.status === "partial" ? "warning" : "danger"} className="mb-4">{i.error}</Notice>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Étapes" value={steps.length} />
        <Stat label="Réussies" value={count("succeeded")} />
        <Stat label="Déjà faites" value={count("skipped")} />
        <Stat label="En échec" value={count("failed")} />
        <Stat label="Annulées" value={count("cancelled")} />
      </div>
      <p className="mt-3 text-xs text-muted">
        Créée {formatDate(i.createdAt)} · démarrée {formatDate(i.startedAt)} · terminée {formatDate(i.finishedAt)}
        {i.confirmedDestructive && " · opérations destructives confirmées par l’utilisateur"}
        {i.safetyBackupId && " · sauvegarde de sécurité prise"}
      </p>

      <ol className="panel mt-6 divide-y divide-line/70">
        {steps.map((s) => (
          <li key={s.id} className="flex gap-3 px-4 py-2.5 text-sm">
            <StepIcon status={s.status} />
            <div className="min-w-0 flex-1">
              <p className={s.destructive ? "font-semibold text-danger" : undefined}>{s.label}</p>
              <p className="font-mono text-[11px] text-muted">{s.key} · {s.attempts} tentative(s)</p>
              {s.detail && <p className="text-xs text-muted">{s.detail}</p>}
              {s.error && <p className="text-xs text-danger">{s.error}</p>}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
