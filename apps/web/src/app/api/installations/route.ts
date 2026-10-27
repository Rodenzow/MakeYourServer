import { z } from "zod";
import { cancelInstallation, listInstallations, prepareInstallation } from "@mys/engine";
import { json, parseBody, withUser } from "@/lib/api";
import { getGateway } from "@/lib/gateway";

export const GET = withUser(async (_req, user) => json({ installations: await listInstallations(user.id) }));

const Prepare = z.object({
  guildId: z.string().regex(/^\d{17,20}$/),
  projectId: z.string().uuid().optional(),
  backupId: z.string().uuid().optional(),
  dryRun: z.boolean().default(false),
  options: z.object({
    mode: z.enum(["empty", "merge", "targeted"]),
    selected: z.array(z.string().max(80)).max(1000).optional(),
    existingChannels: z.enum(["keep", "archive", "delete"]).optional(),
    existingRoles: z.enum(["keep", "delete"]).optional(),
    resolutions: z.record(z.string(), z.enum(["reuse", "update", "create"])).optional(),
    includeMessages: z.boolean().optional(),
    excluded: z.array(z.string()).max(500).optional(),
    republishChannelIds: z.array(z.string().regex(/^\d{17,20}$/)).max(50).optional(),
  }),
  /** Analyse précédente à remplacer (nouvelle analyse avec d’autres options). */
  replaces: z.string().uuid().optional(),
});

/** Analyse : vérifie les droits et l’existant, calcule le plan. Ne modifie rien sur Discord. */
export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, Prepare);
  if (!body.projectId === !body.backupId) return json({ error: "Indiquez un projet ou une sauvegarde." }, 400);
  if (body.replaces) await cancelInstallation(body.replaces, user.id).catch(() => {});
  const { installation, plan } = await prepareInstallation(getGateway(user.discordId), {
    userId: user.id,
    guildId: body.guildId,
    source: body.projectId ? { projectId: body.projectId } : { backupId: body.backupId! },
    options: body.options,
    dryRun: body.dryRun,
    origin: "web",
  });
  return json({ installationId: installation.id, plan });
});
