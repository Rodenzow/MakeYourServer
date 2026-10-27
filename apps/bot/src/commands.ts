import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const mysCommand = new SlashCommandBuilder()
  .setName("mys")
  .setDescription("Make Your Server : installer, sauvegarder et restaurer votre serveur")
  .setContexts(InteractionContextType.Guild)
  // Visible par défaut pour les gestionnaires ; les droits sont de toute façon revérifiés à chaque action.
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) => s.setName("panneau").setDescription("Ouvrir le panneau de contrôle Make Your Server"))
  .addSubcommand((s) =>
    s
      .setName("installer")
      .setDescription("Installer un de vos projets sur ce serveur")
      .addStringOption((o) => o.setName("projet").setDescription("Projet à installer").setRequired(true).setAutocomplete(true))
      .addStringOption((o) =>
        o
          .setName("mode")
          .setDescription("Comment traiter l’existant")
          .addChoices(
            { name: "Ajouter au serveur existant (rien n’est supprimé)", value: "merge" },
            { name: "Serveur vide (réutilise et configure les éléments homonymes)", value: "empty" },
          ),
      )
      .addBooleanOption((o) => o.setName("simulation").setDescription("Simuler sans rien modifier sur Discord")),
  )
  .addSubcommand((s) =>
    s
      .setName("sauvegarder")
      .setDescription("Sauvegarder la configuration actuelle de ce serveur")
      .addStringOption((o) => o.setName("libelle").setDescription("Nom de la sauvegarde").setMaxLength(80)),
  )
  .addSubcommand((s) => s.setName("sauvegardes").setDescription("Lister vos sauvegardes de ce serveur"))
  .addSubcommand((s) =>
    s
      .setName("restaurer")
      .setDescription("Restaurer une sauvegarde sur ce serveur")
      .addStringOption((o) => o.setName("sauvegarde").setDescription("Sauvegarde à restaurer").setRequired(true).setAutocomplete(true)),
  )
  .addSubcommand((s) => s.setName("statut").setDescription("Suivre la dernière installation sur ce serveur"))
  .addSubcommand((s) => s.setName("annuler").setDescription("Annuler l’installation en cours sur ce serveur"));

export const commands = [mysCommand.toJSON()];
