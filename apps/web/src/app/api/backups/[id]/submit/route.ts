import { backupToSpec } from "@mys/core";
import { getOwnedBackup } from "@mys/engine";
import { HttpError, json, parseBody, withUser } from "@/lib/api";
import { SubmissionBody, submitPublication } from "@/lib/publications";

/**
 * Proposer la STRUCTURE d’une sauvegarde comme template public (salons, rôles,
 * permissions, AutoMod, onboarding). Les messages exportés ne sont jamais publiés
 * et les identifiants Discord du serveur d’origine sont retirés.
 */
export const POST = withUser<{ id: string }>(async (req, user, { id }) => {
  const body = await parseBody(req, SubmissionBody);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Sauvegarde introuvable.");
  const b = await getOwnedBackup(user.id, id);
  if (!b) throw new HttpError(404, "Sauvegarde introuvable.");
  const { spec } = backupToSpec(b.snapshot);
  const t = await submitPublication(user, { spec, backupId: b.id }, body);
  return json({ submitted: true, id: t.id }, 201);
});
