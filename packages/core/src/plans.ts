/**
 * Offres et quotas. Les valeurs ci-dessous sont des valeurs PAR DÉFAUT, insérées
 * en base au premier lancement puis modifiables depuis l’administration.
 * Aucun prix n’est défini ici : le prix affiché est saisi par l’administrateur.
 */

export const PLAN_KEYS = ["free", "premium"] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

export interface PlanQuotas {
  /** Projets enregistrés (brouillons compris). */
  maxProjects: number;
  /** Générations IA complètes par mois. */
  aiGenerationsPerMonth: number;
  /** Modifications IA ciblées par mois. */
  aiEditsPerMonth: number;
  /** Plafond de coût IA par utilisateur et par mois (en micro-dollars). */
  aiCostCapMicrosPerMonth: number;
  /** Sauvegardes manuelles conservées par serveur (les sauvegardes de sécurité sont toujours créées). */
  backupsPerGuild: number;
  /** Sauvegardes de sécurité conservées par serveur. */
  safetyBackupsPerGuild: number;
  /** Sauvegardes programmées possibles. */
  scheduledBackups: number;
  /** Intervalle minimal entre deux sauvegardes programmées (heures). */
  scheduleMinIntervalHours: number;
  /** Nombre de salons dont les messages peuvent être exportés par sauvegarde. */
  messageBackupChannels: number;
  /** Nombre de messages exportés par salon. */
  messageBackupPerChannel: number;
  /** Restauration sélective (choisir les éléments). */
  selectiveRestore: boolean;
  /** Archivage des anciens salons lors d’une restauration. */
  archiveOnRestore: boolean;
  /** Durée de conservation des sauvegardes (jours, 0 = illimitée). */
  backupRetentionDays: number;
}

export const DEFAULT_QUOTAS: Record<PlanKey, PlanQuotas> = {
  free: {
    maxProjects: 5,
    aiGenerationsPerMonth: 0,
    aiEditsPerMonth: 0,
    aiCostCapMicrosPerMonth: 0,
    backupsPerGuild: 2,
    safetyBackupsPerGuild: 3,
    scheduledBackups: 0,
    scheduleMinIntervalHours: 24,
    messageBackupChannels: 0,
    messageBackupPerChannel: 0,
    selectiveRestore: false,
    archiveOnRestore: true,
    backupRetentionDays: 90,
  },
  premium: {
    maxProjects: 50,
    aiGenerationsPerMonth: 20,
    aiEditsPerMonth: 150,
    aiCostCapMicrosPerMonth: 5_000_000,
    backupsPerGuild: 25,
    safetyBackupsPerGuild: 10,
    scheduledBackups: 5,
    scheduleMinIntervalHours: 6,
    messageBackupChannels: 10,
    messageBackupPerChannel: 100,
    selectiveRestore: true,
    archiveOnRestore: true,
    backupRetentionDays: 0,
  },
};

export const QUOTA_LABELS: Record<keyof PlanQuotas, string> = {
  maxProjects: "Projets enregistrés",
  aiGenerationsPerMonth: "Conceptions IA par mois",
  aiEditsPerMonth: "Modifications IA par mois",
  aiCostCapMicrosPerMonth: "Plafond de coût IA mensuel (µ$)",
  backupsPerGuild: "Sauvegardes conservées par serveur",
  safetyBackupsPerGuild: "Sauvegardes de sécurité conservées par serveur",
  scheduledBackups: "Sauvegardes programmées",
  scheduleMinIntervalHours: "Intervalle minimal des sauvegardes programmées (h)",
  messageBackupChannels: "Salons dont les messages sont exportables",
  messageBackupPerChannel: "Messages exportés par salon",
  selectiveRestore: "Restauration sélective",
  archiveOnRestore: "Archivage des anciens salons",
  backupRetentionDays: "Conservation des sauvegardes (jours, 0 = illimitée)",
};
