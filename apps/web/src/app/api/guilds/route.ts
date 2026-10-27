import { json, withUser } from "@/lib/api";
import { inviteUrl, listManageableGuilds } from "@/lib/guilds";

/** Serveurs que l’utilisateur peut gérer, avec présence du bot et liens d’invitation. */
export const GET = withUser(async (req, user) => {
  const force = req.nextUrl.searchParams.get("rafraichir") === "1";
  const { guilds, needsReauth } = await listManageableGuilds(user.id, force);
  return json({
    needsReauth,
    guilds: guilds.map((g) => ({ ...g, inviteUrl: g.sandbox ? null : inviteUrl(g.id), inviteUrlMinimal: g.sandbox ? null : inviteUrl(g.id, "minimal") })),
  });
});
