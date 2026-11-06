import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { AUDIT_GRADE_LABELS, AUDIT_SEVERITY_LABELS, type AuditGrade } from "@mys/core";
import { GatewayError, runServerAudit, type GuildGateway } from "@mys/engine";
import { COLORS, LOGIN_REQUIRED, brandEmbed, errorEmbed, row, siteButton } from "../ui";
import { explainError, findUser } from "./install";

const GRADE_COLOR: Record<AuditGrade, number> = {
  excellent: COLORS.success,
  bon: COLORS.blue,
  moyen: COLORS.warning,
  fragile: COLORS.danger,
};

const SEVERITY_ICON = { critical: "🔴", warning: "🟠", tip: "🔵" } as const;

/**
 * `/mys sante` : analyse la configuration du serveur (lecture seule) et répond
 * en privé (éphémère). Les droits « Gérer le serveur » sont revérifiés par le moteur.
 */
export async function handleHealth(i: ChatInputCommandInteraction, gateway: GuildGateway) {
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const user = await findUser(i.user.id);
  if (!user) return i.editReply({ embeds: [errorEmbed(LOGIN_REQUIRED)], components: [row(siteButton("Se connecter", "/connexion"))] });
  try {
    const { report } = await runServerAudit(gateway, { userId: user.id, guildId: i.guildId! });
    const bar = "█".repeat(Math.round(report.score / 10)) + "░".repeat(10 - Math.round(report.score / 10));
    const e = brandEmbed(
      `Santé du serveur : ${report.score}/100 — ${AUDIT_GRADE_LABELS[report.grade]}`,
      `\`${bar}\`\n${report.counts.critical} critique(s) · ${report.counts.warning} à corriger · ${report.counts.tip} conseil(s)`,
      GRADE_COLOR[report.grade],
    );
    const top = report.issues.slice(0, 5);
    if (top.length) {
      e.addFields({
        name: "Problèmes principaux",
        value: top
          .map((x) => `${SEVERITY_ICON[x.severity]} **${x.title}** (${AUDIT_SEVERITY_LABELS[x.severity].toLowerCase()})${x.fix ? " · correction automatique possible" : ""}`)
          .join("\n")
          .slice(0, 1024),
      });
    } else {
      e.addFields({ name: "Aucun problème détecté", value: "Votre configuration suit toutes les bonnes pratiques vérifiées. Bravo !" });
    }
    if (report.strengths.length) e.addFields({ name: "Points forts", value: report.strengths.slice(0, 4).map((s) => `✅ ${s}`).join("\n").slice(0, 1024) });
    e.addFields({ name: "Et ensuite ?", value: "Le détail, les explications et les corrections en un clic sont sur le site. L’analyse n’a rien modifié sur le serveur." });
    await i.editReply({ embeds: [e], components: [row(siteButton("Voir le rapport complet", `/serveurs/${i.guildId}/sante`))] });
  } catch (err) {
    const message = err instanceof GatewayError ? err.message : explainError(err);
    await i.editReply({ embeds: [errorEmbed(message)] });
  }
}
