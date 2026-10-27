import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { config } from "./config";

/** Couleurs de la marque Make Your Server. */
export const COLORS = {
  lightBlue: 0xb8d7ff,
  blue: 0x83a8f3,
  periwinkle: 0xa7bdff,
  night: 0x07142d,
  success: 0x5fc48a,
  warning: 0xf2c14e,
  danger: 0xe5534b,
} as const;

export const LOGO_URL = `${config.appUrl}/brand/logo-192.png`;

export function brandEmbed(title: string, description?: string, color: number = COLORS.blue) {
  const e = new EmbedBuilder().setColor(color).setTitle(title).setFooter({ text: "Make Your Server", iconURL: LOGO_URL });
  if (description) e.setDescription(description);
  return e;
}

export function errorEmbed(message: string) {
  return brandEmbed("Impossible de continuer", message, COLORS.danger);
}

export function siteButton(label: string, path: string) {
  return new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(`${config.appUrl}${path}`);
}

export function row(...buttons: ButtonBuilder[]) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}

export function progressBar(done: number, total: number, width = 18) {
  if (total === 0) return "░".repeat(width);
  const filled = Math.round((done / total) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export const LOGIN_REQUIRED = `Votre compte Discord n’est pas encore relié à Make Your Server. Connectez-vous une fois sur le site, puis relancez la commande.`;
