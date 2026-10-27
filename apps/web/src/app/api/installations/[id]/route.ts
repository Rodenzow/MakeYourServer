import { getInstallationWithSteps } from "@mys/engine";
import { HttpError, json, withUser } from "@/lib/api";

/** Suivi : statut réel de chaque étape exécutée par le bot. */
export const GET = withUser<{ id: string }>(async (_req, user, { id }) => {
  const data = await getInstallationWithSteps(id, user.id);
  if (!data) throw new HttpError(404, "Installation introuvable.");
  const { installation: i, steps } = data;
  return json({
    installation: {
      id: i.id,
      guildId: i.guildId,
      guildName: i.guildName,
      kind: i.kind,
      status: i.status,
      dryRun: i.dryRun,
      error: i.error,
      createdAt: i.createdAt,
      startedAt: i.startedAt,
      finishedAt: i.finishedAt,
      safetyBackupId: i.safetyBackupId,
      projectId: i.projectId,
      backupId: i.backupId,
      manualSteps: i.plan.manualSteps,
      mode: i.plan.mode,
      cancelRequested: i.cancelRequested,
    },
    steps: steps.map((s) => ({ id: s.id, key: s.key, kind: s.kind, label: s.label, status: s.status, detail: s.detail, error: s.error, destructive: s.destructive, attempts: s.attempts })),
  });
});
