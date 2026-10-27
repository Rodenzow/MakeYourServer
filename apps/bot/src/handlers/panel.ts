import { ButtonBuilder, ButtonStyle, MessageFlags, type ButtonInteraction, type ChatInputCommandInteraction } from "discord.js";
import { brandEmbed, row, siteButton } from "../ui";

export function panelPayload() {
  const e = brandEmbed(
    "Panneau Make Your Server",
    [
      "Préparez votre serveur sur le site, puis laissez le bot l’installer ici.",
      "",
      "**Installer** — `/mys installer` : choisissez un projet, vérifiez l’analyse, lancez.",
      "**Sauvegarder** — `/mys sauvegarder` : capture la configuration actuelle.",
      "**Restaurer** — `/mys restaurer` : remet en place une sauvegarde, sans rien supprimer.",
      "**Suivre** — `/mys statut` · **Arrêter** — `/mys annuler`",
    ].join("\n"),
  );
  return {
    embeds: [e],
    components: [
      row(
        new ButtonBuilder().setCustomId("mys:panel:backup").setStyle(ButtonStyle.Primary).setLabel("Sauvegarder maintenant").setEmoji("💾"),
        new ButtonBuilder().setCustomId("mys:panel:status").setStyle(ButtonStyle.Secondary).setLabel("Dernière installation").setEmoji("📈"),
        siteButton("Mes projets", "/tableau-de-bord"),
        siteButton("Templates", "/templates"),
      ),
    ],
  };
}

export async function handlePanel(i: ChatInputCommandInteraction) {
  await i.reply({ ...panelPayload(), flags: MessageFlags.Ephemeral });
}

export async function handlePanelHint(i: ButtonInteraction, command: string) {
  await i.reply({ content: `Utilisez la commande \`/mys ${command}\` pour continuer.`, flags: MessageFlags.Ephemeral });
}
