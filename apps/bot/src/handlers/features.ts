import {
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  ThreadAutoArchiveDuration,
  type ButtonInteraction,
  type GuildMember,
  type ModalSubmitInteraction,
  type PartialGuildMember,
  type TextChannel,
} from "discord.js";
import { isDangerous, fromBitfield, renderTokens, type PermissionKey } from "@mys/core";
import { eq, getDb, guildFeatures, logError } from "@mys/db";
import { COLORS, brandEmbed, row } from "../ui";

/**
 * Comportements réels des boutons installés par Make Your Server.
 * Le bot n’agit que sur les rôles enregistrés lors de l’installation pour CE serveur.
 */

async function loadConfig(guildId: string) {
  const [row] = await getDb().select().from(guildFeatures).where(eq(guildFeatures.guildId, guildId));
  return row?.config ?? null;
}

const ephemeral = (content: string) => ({ content, flags: MessageFlags.Ephemeral as const });

async function toggleRole(i: ButtonInteraction, roleId: string, mode: "toggle" | "add") {
  if (!i.inCachedGuild()) return i.reply(ephemeral("Action disponible uniquement sur un serveur."));
  const cfg = await loadConfig(i.guildId);
  const allowed = mode === "toggle" ? cfg?.selfRoleIds : cfg?.rulesRoleIds;
  if (!allowed?.includes(roleId)) return i.reply(ephemeral("Ce bouton n’est plus actif : le rôle n’est pas géré par Make Your Server sur ce serveur."));
  const role = i.guild.roles.cache.get(roleId) ?? (await i.guild.roles.fetch(roleId).catch(() => null));
  if (!role) return i.reply(ephemeral("Ce rôle n’existe plus. Prévenez l’équipe du serveur."));
  // Garde-fou : jamais de rôle sensible via un bouton.
  const dangerous = fromBitfield(role.permissions.bitfield).filter((p) => isDangerous(p as PermissionKey));
  if (dangerous.length) return i.reply(ephemeral("Ce rôle possède des permissions sensibles : il ne peut pas être attribué par un bouton."));
  const me = i.guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles) || me.roles.highest.comparePositionTo(role) <= 0) {
    return i.reply(ephemeral("Je ne peux pas attribuer ce rôle : mon rôle doit être placé au-dessus de lui avec la permission « Gérer les rôles »."));
  }
  const has = i.member.roles.cache.has(roleId);
  try {
    if (mode === "add") {
      if (has) return i.reply(ephemeral(`Vous avez déjà accepté le règlement : le rôle **${role.name}** vous est attribué.`));
      await i.member.roles.add(role, "Make Your Server : règlement accepté");
      return i.reply(ephemeral(`Merci ! Le rôle **${role.name}** vous a été attribué : vous avez maintenant accès au serveur.`));
    }
    if (has) {
      await i.member.roles.remove(role, "Make Your Server : rôle retiré par le membre");
      return i.reply(ephemeral(`Rôle **${role.name}** retiré.`));
    }
    await i.member.roles.add(role, "Make Your Server : rôle choisi par le membre");
    return i.reply(ephemeral(`Rôle **${role.name}** ajouté.`));
  } catch (e) {
    await logError("bot", "Attribution de rôle impossible", { guildId: i.guildId, roleId, error: e });
    return i.reply(ephemeral("Impossible de modifier vos rôles pour le moment. Réessayez ou contactez l’équipe."));
  }
}

export const handleRoleToggle = (i: ButtonInteraction, roleId: string) => toggleRole(i, roleId, "toggle");
export const handleRulesAccept = (i: ButtonInteraction, roleId: string) => toggleRole(i, roleId, "add");

/* --------------------------------- Tickets --------------------------------- */

export async function handleTicketOpen(i: ButtonInteraction) {
  if (!i.inCachedGuild()) return;
  const cfg = await loadConfig(i.guildId);
  const t = cfg?.tickets;
  if (!t) return i.reply(ephemeral("Les tickets ne sont pas activés sur ce serveur."));
  const channel = i.guild.channels.cache.get(t.channelId) as TextChannel | undefined;
  if (!channel || channel.type !== ChannelType.GuildText) return i.reply(ephemeral("Le salon des tickets est introuvable. Prévenez l’équipe."));
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const existing = channel.threads.cache.find((th) => !th.archived && th.name.endsWith(`· ${i.user.id.slice(-4)}`) && th.ownerId === i.client.user.id);
  if (existing) return i.editReply(`Vous avez déjà un ticket ouvert : ${existing.toString()}`);
  try {
    const thread = await channel.threads.create({
      name: `ticket-${i.user.username}`.slice(0, 80) + ` · ${i.user.id.slice(-4)}`,
      type: ChannelType.PrivateThread,
      invitable: false,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      reason: `Ticket ouvert par ${i.user.tag}`,
    });
    await thread.members.add(i.user.id);
    const staffMentions = t.staffRoleIds.map((r) => `<@&${r}>`).join(" ");
    await thread.send({
      content: `${i.user} ${staffMentions}`,
      embeds: [brandEmbed("🎫 Ticket ouvert", t.intro)],
      components: [row(new ButtonBuilder().setCustomId("mys:tk:close").setStyle(ButtonStyle.Secondary).setLabel("Fermer le ticket").setEmoji("🔒"))],
      allowedMentions: { users: [i.user.id], roles: t.staffRoleIds },
    });
    await i.editReply(`Votre ticket privé est ouvert : ${thread.toString()}`);
  } catch (e) {
    await logError("bot", "Ouverture de ticket impossible", { guildId: i.guildId, error: e });
    await i.editReply("Impossible d’ouvrir un ticket : le bot a besoin des permissions « Créer des fils privés » et « Gérer les fils » dans ce salon.");
  }
}

export async function handleTicketClose(i: ButtonInteraction) {
  if (!i.inCachedGuild() || !i.channel?.isThread()) return;
  const cfg = await loadConfig(i.guildId);
  const isStaff = cfg?.tickets?.staffRoleIds.some((r) => i.member.roles.cache.has(r)) || i.member.permissions.has(PermissionFlagsBits.ManageThreads);
  const isAuthor = i.channel.name.endsWith(`· ${i.user.id.slice(-4)}`);
  if (!isStaff && !isAuthor) return i.reply(ephemeral("Seuls l’auteur du ticket et l’équipe peuvent le fermer."));
  await i.reply({ embeds: [brandEmbed("🔒 Ticket fermé", `Fermé par ${i.user}. Le fil est archivé et verrouillé.`, COLORS.night)] });
  await i.channel.setLocked(true, "Ticket fermé").catch(() => {});
  await i.channel.setArchived(true, "Ticket fermé").catch(() => {});
}

/* -------------------------------- Suggestions ------------------------------ */

export async function handleSuggestionOpen(i: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("mys:sg:submit")
    .setTitle("Proposer une idée")
    .addLabelComponents(
      new LabelBuilder().setLabel("Titre").setTextInputComponent(new TextInputBuilder().setCustomId("title").setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)),
      new LabelBuilder()
        .setLabel("Votre idée")
        .setDescription("Expliquez ce que vous proposez et pourquoi.")
        .setTextInputComponent(new TextInputBuilder().setCustomId("body").setStyle(TextInputStyle.Paragraph).setMaxLength(1500).setRequired(true)),
    );
  await i.showModal(modal);
}

export async function handleSuggestionSubmit(i: ModalSubmitInteraction) {
  if (!i.inCachedGuild()) return;
  const cfg = await loadConfig(i.guildId);
  const channelId = cfg?.suggestions?.channelId;
  const channel = channelId ? (i.guild.channels.cache.get(channelId) as TextChannel | undefined) : undefined;
  if (!channel?.isTextBased()) return i.reply(ephemeral("Le salon des suggestions est introuvable."));
  const title = i.fields.getTextInputValue("title");
  const body = i.fields.getTextInputValue("body");
  try {
    const msg = await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.periwinkle)
          .setAuthor({ name: i.user.displayName, iconURL: i.user.displayAvatarURL() })
          .setTitle(`💡 ${title}`)
          .setDescription(body)
          .setFooter({ text: "Votez avec 👍 / 👎 · Discutez dans le fil" })
          .setTimestamp(),
      ],
      allowedMentions: { parse: [] },
    });
    await msg.react("👍").catch(() => {});
    await msg.react("👎").catch(() => {});
    if ("threads" in channel) await msg.startThread({ name: title.slice(0, 90), reason: "Discussion de la suggestion" }).catch(() => {});
    await i.reply(ephemeral(`Merci ! Votre idée est publiée : ${msg.url}`));
  } catch (e) {
    await logError("bot", "Publication de suggestion impossible", { guildId: i.guildId, error: e });
    await i.reply(ephemeral("Impossible de publier la suggestion : vérifiez que le bot peut écrire dans le salon des suggestions."));
  }
}

/* ------------------------- Bienvenue & logs d’arrivées ------------------------- */

export async function onMemberAdd(member: GuildMember) {
  const cfg = await loadConfig(member.guild.id);
  if (!cfg) return;
  const tokens = cfg.tokens ?? {};
  if (cfg.welcome) {
    const ch = member.guild.channels.cache.get(cfg.welcome.channelId);
    if (ch?.isTextBased()) {
      const text = renderTokens(cfg.welcome.message, {
        channel: (id) => (tokens[id] ? `<#${tokens[id]}>` : null),
        role: (id) => (tokens[id] ? `<@&${tokens[id]}>` : null),
        server: member.guild.name,
      })
        .replace(/\{user\}/g, member.toString())
        .replace(/\{memberCount\}/g, String(member.guild.memberCount));
      await ch.send({ content: text, allowedMentions: { users: [member.id] } }).catch((e) => logError("bot", "Message de bienvenue impossible", { guildId: member.guild.id, error: e }));
    }
  }
  if (cfg.joinLogs) await logMember(member, cfg.joinLogs.channelId, true);
}

export async function onMemberRemove(member: GuildMember | PartialGuildMember) {
  const cfg = await loadConfig(member.guild.id);
  if (cfg?.joinLogs) await logMember(member, cfg.joinLogs.channelId, false);
}

async function logMember(member: GuildMember | PartialGuildMember, channelId: string, joined: boolean) {
  const ch = member.guild.channels.cache.get(channelId);
  if (!ch?.isTextBased()) return;
  const created = Math.floor(member.user.createdTimestamp / 1000);
  const e = new EmbedBuilder()
    .setColor(joined ? COLORS.success : COLORS.danger)
    .setAuthor({ name: member.user.tag ?? member.id, iconURL: member.user.displayAvatarURL() })
    .setDescription(`${joined ? "📥 Arrivée" : "📤 Départ"} de ${member.toString()}\nCompte créé <t:${created}:R>`)
    .setFooter({ text: `ID : ${member.id}` })
    .setTimestamp();
  await ch.send({ embeds: [e], allowedMentions: { parse: [] } }).catch(() => {});
}
