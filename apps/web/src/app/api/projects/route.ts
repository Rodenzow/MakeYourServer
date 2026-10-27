import { z } from "zod";
import { ServerSpecSchema, backupToSpec } from "@mys/core";
import { audit } from "@mys/db";
import { getOwnedBackup } from "@mys/engine";
import { HttpError, json, parseBody, withUser } from "@/lib/api";
import { createProject, getPublishedTemplate, listProjects } from "@/lib/data";

export const GET = withUser(async (_req, user) => json({ projects: await listProjects(user.id) }));

const Body = z.discriminatedUnion("source", [
  z.object({ source: z.literal("template"), slug: z.string().min(1), name: z.string().min(2).max(100).optional() }),
  z.object({ source: z.literal("blank"), name: z.string().min(2).max(100) }),
  /** Créer un projet à partir d’une sauvegarde : action volontaire, le projet reste privé. */
  z.object({ source: z.literal("backup"), backupId: z.string().uuid(), name: z.string().min(2).max(100).optional() }),
]);

const BLANK = {
  version: 1,
  meta: { name: "Nouveau serveur", theme: "autre", size: "medium" },
  everyone: { permissions: ["VIEW_CHANNEL", "SEND_MESSAGES", "READ_MESSAGE_HISTORY", "ADD_REACTIONS", "EMBED_LINKS", "ATTACH_FILES", "CONNECT", "SPEAK", "USE_VAD", "CHANGE_NICKNAME", "USE_APPLICATION_COMMANDS", "CREATE_PUBLIC_THREADS", "SEND_MESSAGES_IN_THREADS"] },
  roles: [{ id: "moderation", name: "Modération", color: 0x83a8f3, hoist: true, staff: true, permissions: ["KICK_MEMBERS", "MODERATE_MEMBERS", "MANAGE_MESSAGES"] }],
  categories: [
    { id: "accueil", name: "Accueil", overwrites: [], channels: [{ id: "bienvenue", name: "bienvenue", type: "text", purpose: "welcome" }, { id: "reglement", name: "règlement", type: "text", purpose: "rules" }] },
    { id: "discussions", name: "Discussions", overwrites: [], channels: [{ id: "general", name: "général", type: "text", purpose: "general" }, { id: "vocal", name: "Vocal", type: "voice" }] },
  ],
};

export const POST = withUser(async (req, user) => {
  const body = await parseBody(req, Body);
  let project;
  if (body.source === "template") {
    const t = await getPublishedTemplate(body.slug);
    if (!t) throw new HttpError(404, "Ce template n’existe pas ou n’est plus publié.");
    project = await createProject(user.id, { name: body.name ?? t.name, spec: t.spec, sourceType: "template", sourceTemplateId: t.id });
  } else if (body.source === "blank") {
    project = await createProject(user.id, { name: body.name, spec: ServerSpecSchema.parse(BLANK), sourceType: "blank" });
  } else {
    const b = await getOwnedBackup(user.id, body.backupId);
    if (!b) throw new HttpError(404, "Sauvegarde introuvable.");
    const { spec } = backupToSpec(b.snapshot);
    project = await createProject(user.id, { name: body.name ?? `Copie de ${b.guildName}`.slice(0, 100), spec, sourceType: "backup", sourceBackupId: b.id });
  }
  await audit({ actorUserId: user.id, actorType: "user", action: "project.create", targetType: "project", targetId: project.id, metadata: { source: body.source } });
  return json({ project: { id: project.id } }, 201);
});
