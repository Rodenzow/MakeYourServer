import { MessageFlags, type ButtonInteraction, type ChatInputCommandInteraction } from "discord.js";
import { assertGuildAccess, BACKUP_SCOPE_NOTE, createBackup, listBackups, type GuildGateway } from "@mys/engine";
import { LOGIN_REQUIRED, brandEmbed, errorEmbed, row, siteButton, COLORS } from "../ui";
import { explainError, findUser } from "./install";

export async function handleBackup(i: ChatInputCommandInteraction | ButtonInteraction, gateway: GuildGateway) {
  // Accusé de réception immédiat, travail en arrière-plan.
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const user = await findUser(i.user.id);
  if (!user) return i.editReply({ embeds: [errorEmbed(LOGIN_REQUIRED)], components: [row(siteButton("Se connecter", "/connexion"))] });
  try {
    await assertGuildAccess(gateway, i.guildId!, user.discordId, "manage");
    const label = i.isChatInputCommand() ? (i.options.getString("libelle") ?? undefined) : undefined;
    const b = await createBackup(gateway, { userId: user.id, guildId: i.guildId!, kind: "manual", label });
    const s = b.summary;
    await i.editReply({
      embeds: [
        brandEmbed(`Sauvegarde n°${b.version} enregistrée`, `${s.categories ?? 0} catégories · ${s.channels ?? 0} salons · ${s.roles ?? 0} rôles · ${s.automod ?? 0} règles AutoMod`, COLORS.success).addFields({
          name: "Ce qui est sauvegardé",
          value: BACKUP_SCOPE_NOTE.slice(0, 1024),
        }),
      ],
      components: [row(siteButton("Voir mes sauvegardes", `/sauvegardes/${b.id}`))],
    });
  } catch (e) {
    await i.editReply({ embeds: [errorEmbed(explainError(e))] });
  }
}

export async function handleBackupList(i: ChatInputCommandInteraction) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const user = await findUser(i.user.id);
  if (!user) return i.editReply({ embeds: [errorEmbed(LOGIN_REQUIRED)] });
  const list = (await listBackups(user.id, i.guildId!)).slice(0, 10);
  const kind = { safety: "🛟 sécurité", manual: "💾 manuelle", scheduled: "⏰ programmée" } as Record<string, string>;
  const e = brandEmbed("Vos sauvegardes de ce serveur", list.length ? undefined : "Aucune sauvegarde pour l’instant. Utilisez `/mys sauvegarder`.");
  for (const b of list) {
    const date = b.createdAt.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });
    e.addFields({ name: `n°${b.version} — ${kind[b.kind] ?? b.kind}`, value: `${b.label ?? ""}\n${date} · ${b.summary.channels ?? 0} salons, ${b.summary.roles ?? 0} rôles${b.messageCount ? `, ${b.messageCount} messages` : ""}` });
  }
  e.addFields({ name: "Confidentialité", value: "Vos sauvegardes sont privées : elles ne sont visibles que par vous et ne sont jamais publiées ni envoyées à l’IA." });
  await i.editReply({ embeds: [e], components: [row(siteButton("Gérer sur le site", "/sauvegardes"))] });
}
