import { z } from "zod";
import { aiGenerations, eq, getDb } from "@mys/db";
import { validateSpec } from "@mys/core";
import { HttpError, json, parseBody, withUser } from "@/lib/api";
import { createProject } from "@/lib/data";
import { getOwnedGeneration } from "@/lib/ai/service";

const Body = z.object({ name: z.string().trim().min(2).max(100).optional() });

/** Transforme une conception IA validée en projet personnel (brouillon modifiable dans l’éditeur). */
export const POST = withUser<{ id: string }>(async (req, user, { id }) => {
  const body = await parseBody(req, Body);
  const gen = await getOwnedGeneration(user.id, id);
  if (!gen || gen.kind !== "create" || !gen.resultSpec) throw new HttpError(404, "Conception introuvable.");
  if (gen.projectId) return json({ projectId: gen.projectId });
  if (!validateSpec(gen.resultSpec).ok) throw new HttpError(422, "Cette conception ne passe plus la validation : relancez une génération.");
  const name = body.name ?? gen.resultSpec.meta.name;
  const project = await createProject(user.id, { name, spec: gen.resultSpec, sourceType: "ai" });
  await getDb().update(aiGenerations).set({ projectId: project.id, status: "applied" }).where(eq(aiGenerations.id, gen.id));
  return json({ projectId: project.id });
});
