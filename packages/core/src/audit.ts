import { backupToSpec } from "./backup-spec";
import { DISCORD_CHANNEL_TYPE, type GuildState, type StateChannel, type StateRole } from "./guild-state";
import { ALL_PERMISSIONS, fromBitfield, isDangerous, permissionBit, PERMISSIONS, type PermissionKey } from "./permissions";
import { DISCORD_LIMITS, EVERYONE, type AutoModRule, type Channel, type Overwrite, type ServerSpec } from "./schema";
import { everyoneAccess } from "./simulate";
import { allChannels, cloneSpec, uniqueId } from "./spec-utils";
import { validateSpec, type Issue } from "./validate";

/**
 * « Santé du serveur » : analyse gratuite de la configuration d’un serveur
 * (sécurité, modération, organisation, accueil) et correctifs automatiques.
 *
 * Le score part de 100 et chaque problème retire un nombre fixe de points
 * (`points`). Il est donc déterministe : un même état donne toujours le même
 * score. Un problème critique plafonne le score à 69 (appréciation « moyen »
 * au mieux) pour qu’un serveur exposé ne soit jamais jugé « bon ».
 */

export type AuditSeverity = "critical" | "warning" | "tip";
export type AuditCategory = "securite" | "moderation" | "organisation" | "accueil";
export type AuditGrade = "excellent" | "bon" | "moyen" | "fragile";

export const AUDIT_FIX_IDS = [
  "everyone-permissions",
  "verification",
  "content-filter",
  "notifications",
  "automod-basics",
  "automod-spam",
  "automod-mentions",
  "announcements-readonly",
] as const;
export type AuditFixId = (typeof AUDIT_FIX_IDS)[number];

export interface AuditIssue {
  id: string;
  severity: AuditSeverity;
  category: AuditCategory;
  title: string;
  /** Explication simple : ce qui se passe et pourquoi c’est important. */
  detail: string;
  /** Identifiant d’un correctif automatique, s’il existe. */
  fix?: AuditFixId;
  /** Points retirés au score. */
  points: number;
  /** Éléments concernés (noms de salons, de rôles, de permissions). */
  items?: string[];
  /** Que faire soi-même quand il n’existe pas de correctif automatique. */
  howTo?: string;
}

export interface AuditReport {
  version: 1;
  score: number;
  grade: AuditGrade;
  issues: AuditIssue[];
  strengths: string[];
  counts: Record<AuditSeverity, number>;
}

export const AUDIT_GRADE_LABELS: Record<AuditGrade, string> = {
  excellent: "Excellent",
  bon: "Bon",
  moyen: "Moyen",
  fragile: "Fragile",
};

export const AUDIT_SEVERITY_LABELS: Record<AuditSeverity, string> = {
  critical: "Critique",
  warning: "À corriger",
  tip: "Conseil",
};

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  securite: "Sécurité",
  moderation: "Modération",
  organisation: "Organisation",
  accueil: "Accueil",
};

export const AUDIT_FIXES: Record<AuditFixId, { label: string; description: string }> = {
  "everyone-permissions": {
    label: "Retirer les permissions sensibles de @everyone",
    description: "Les permissions d’administration, de modération et la mention de tous les membres sont retirées au rôle @everyone. Vos rôles d’équipe gardent leurs droits.",
  },
  verification: {
    label: "Passer le niveau de vérification à « Moyen »",
    description: "Les nouveaux comptes doivent avoir un e-mail vérifié et exister depuis plus de 5 minutes pour écrire.",
  },
  "content-filter": {
    label: "Analyser les médias de tous les membres",
    description: "Discord bloque automatiquement les images explicites envoyées par n’importe quel membre.",
  },
  notifications: {
    label: "Notifications par défaut : mentions uniquement",
    description: "Les membres ne reçoivent une notification que lorsqu’on les mentionne. Chacun peut changer ce réglage pour lui-même.",
  },
  "automod-basics": {
    label: "Activer les protections AutoMod de base",
    description: "Blocage du spam, des mentions de masse et des insultes graves grâce à l’AutoMod intégré à Discord.",
  },
  "automod-spam": {
    label: "Bloquer les messages de spam (AutoMod)",
    description: "Discord détecte et bloque les messages considérés comme du spam.",
  },
  "automod-mentions": {
    label: "Bloquer les mentions de masse (AutoMod)",
    description: "Un message qui mentionne plus de 6 personnes ou rôles est bloqué, avec la protection contre les raids.",
  },
  "announcements-readonly": {
    label: "Passer les salons d’annonces en lecture seule",
    description: "@everyone ne peut plus écrire dans les salons d’annonces. Les rôles d’équipe qui gèrent le serveur ou les messages gardent le droit d’écrire.",
  },
};

/* -------------------------------------------------------------------------- */
/*                                  Utilitaires                                */
/* -------------------------------------------------------------------------- */

const ADMIN = permissionBit("ADMINISTRATOR");
const has = (perms: bigint, key: PermissionKey) => (perms & ADMIN) !== 0n || (perms & permissionBit(key)) !== 0n;

/** Nom simplifié (sans accents, émojis ni séparateurs) pour reconnaître le rôle d’un salon. */
export function plainName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const RULES_RE = /\b(regles?|reglement|rules|charte)\b/;
const LOGS_RE = /\b(logs?|moderation|modo|modos|mods?|staff|admins?|administration|equipe|sanctions?)\b/;
const ANNOUNCE_RE = /\b(annonces?|announcements?|news|nouveautes?|actus?|actualites?)\b/;

/** Permissions de @everyone dans un salon (surcharges du salon appliquées). */
function everyoneChannelPerms(state: GuildState, base: bigint, ch: StateChannel): bigint {
  if (base & ADMIN) return ALL_PERMISSIONS;
  const ow = ch.permissionOverwrites.find((o) => o.type === 0 && o.id === state.id);
  if (!ow) return base;
  return (base & ~BigInt(ow.deny)) | BigInt(ow.allow);
}

const isStaffPerms = (perms: bigint) =>
  (perms & ADMIN) !== 0n ||
  (["MANAGE_GUILD", "MANAGE_CHANNELS", "MANAGE_ROLES", "MANAGE_MESSAGES", "KICK_MEMBERS", "BAN_MEMBERS", "MODERATE_MEMBERS"] as const).some((k) => (perms & permissionBit(k)) !== 0n);

function isAnnouncementLike(type: number | Channel["type"], name: string) {
  if (type === DISCORD_CHANNEL_TYPE.announcement || type === "announcement") return true;
  return (type === DISCORD_CHANNEL_TYPE.text || type === "text") && ANNOUNCE_RE.test(plainName(name));
}

const list = (xs: string[], max = 4) => (xs.length <= max ? xs.join(", ") : `${xs.slice(0, max).join(", ")} et ${xs.length - max} autre(s)`);

/* -------------------------------------------------------------------------- */
/*                                    Analyse                                  */
/* -------------------------------------------------------------------------- */

export function auditGuild(state: GuildState): AuditReport {
  const issues: AuditIssue[] = [];
  const strengths: string[] = [];
  const add = (issue: AuditIssue) => issues.push(issue);

  const everyoneRole = state.roles.find((r) => r.id === state.id);
  const everyone = everyoneRole ? BigInt(everyoneRole.permissions) : 0n;
  const community = state.features.includes("COMMUNITY");
  const channels = state.channels.filter((c) => c.type !== DISCORD_CHANNEL_TYPE.category);
  const categories = state.channels.filter((c) => c.type === DISCORD_CHANNEL_TYPE.category);
  const ownBotRoles = new Set(state.bot?.roleIds ?? []);
  const rolePerms = (r: StateRole) => BigInt(r.permissions);

  /* ------------------------------ Sécurité ------------------------------ */
  const everyoneDangerous = fromBitfield(everyone).filter(isDangerous);
  if (everyone & ADMIN) {
    add({
      id: "everyone-admin",
      severity: "critical",
      category: "securite",
      title: "Tout le monde est administrateur",
      detail:
        "Le rôle @everyone possède la permission Administrateur : n’importe quel membre, même arrivé il y a une minute, peut supprimer des salons, bannir des membres ou détruire le serveur.",
      fix: "everyone-permissions",
      points: 35,
      items: everyoneDangerous.map((k) => PERMISSIONS[k].label),
    });
  } else {
    const moderation = everyoneDangerous.filter((k) => k !== "MENTION_EVERYONE");
    if (moderation.length) {
      add({
        id: "everyone-dangerous",
        severity: "critical",
        category: "securite",
        title: "@everyone a des permissions de modération ou de gestion",
        detail:
          "Ces permissions sont données à tous les membres, y compris les nouveaux venus. Une seule personne malveillante pourrait expulser des membres, supprimer des messages ou modifier le serveur.",
        fix: "everyone-permissions",
        points: 20,
        items: moderation.map((k) => PERMISSIONS[k].label),
      });
    }
    if (everyone & permissionBit("MENTION_EVERYONE")) {
      add({
        id: "everyone-mention",
        severity: "critical",
        category: "securite",
        title: "Tout le monde peut mentionner @everyone",
        detail:
          "N’importe quel membre peut envoyer une notification à tout le serveur en écrivant @everyone ou @here. C’est la porte ouverte au spam et aux raids : réservez ce droit à l’équipe.",
        fix: "everyone-permissions",
        points: 12,
      });
    }
    if (!everyoneDangerous.length) strengths.push("@everyone n’a aucune permission sensible.");
  }

  const adminRoles = state.roles.filter((r) => r.id !== state.id && !r.managed && (rolePerms(r) & ADMIN) !== 0n);
  if (adminRoles.length > 3) {
    add({
      id: "too-many-admins",
      severity: "warning",
      category: "securite",
      title: `${adminRoles.length} rôles ont la permission Administrateur`,
      detail:
        "Chaque rôle administrateur est une clé qui ouvre tout le serveur. Plus il y en a, plus le risque d’erreur ou de compte piraté est grand. Gardez-en un ou deux et donnez aux autres uniquement les permissions utiles.",
      points: 6,
      items: adminRoles.map((r) => r.name),
      howTo: "Paramètres du serveur → Rôles : retirez « Administrateur » des rôles qui n’en ont pas besoin.",
    });
  } else if (adminRoles.length > 0) {
    strengths.push(`Peu de rôles administrateurs (${adminRoles.length}).`);
  }

  const adminApps = state.roles.filter((r) => r.managed && !ownBotRoles.has(r.id) && r.tags?.botId !== state.bot?.userId && !!r.tags?.botId && (rolePerms(r) & ADMIN) !== 0n);
  if (adminApps.length) {
    add({
      id: "apps-admin",
      severity: "warning",
      category: "securite",
      title: "Des applications ont la permission Administrateur",
      detail:
        "Une application administratrice peut tout faire sur le serveur. Si elle est compromise ou mal configurée, les dégâts sont immédiats. La plupart des bots n’ont besoin que de quelques permissions précises.",
      points: 4,
      items: adminApps.map((r) => r.name),
      howTo: "Paramètres du serveur → Rôles → rôle de l’application : retirez « Administrateur » et gardez les permissions qu’elle demande.",
    });
  }

  if (state.verificationLevel === 0) {
    add({
      id: "verification-none",
      severity: "warning",
      category: "securite",
      title: "Aucune vérification des nouveaux comptes",
      detail:
        "Un compte créé il y a quelques secondes peut écrire immédiatement. C’est ce qu’utilisent les robots de spam et les raids. Le niveau « Moyen » exige un e-mail vérifié et un compte de plus de 5 minutes.",
      fix: "verification",
      points: 10,
    });
  } else {
    strengths.push("Les nouveaux comptes sont vérifiés avant de pouvoir écrire.");
  }

  if (community && !state.safetyAlertsChannelId) {
    add({
      id: "safety-alerts-missing",
      severity: "tip",
      category: "securite",
      title: "Pas de salon pour les alertes de sécurité",
      detail: "Discord peut prévenir votre équipe en cas d’activité inhabituelle (raid, pic d’arrivées). Sans salon dédié, ces alertes ne sont reçues par personne.",
      points: 2,
      howTo: "Paramètres du serveur → Communauté → Vue d’ensemble : choisissez un salon réservé à l’équipe pour les alertes de sécurité.",
    });
  }

  /* ----------------------------- Modération ----------------------------- */
  if (state.explicitContentFilter === 0) {
    add({
      id: "content-filter-off",
      severity: "warning",
      category: "moderation",
      title: "Le filtre de contenu explicite est désactivé",
      detail: "Les images choquantes ou pornographiques ne sont pas bloquées automatiquement. Activez l’analyse des médias de tous les membres pour protéger votre communauté.",
      fix: "content-filter",
      points: 10,
    });
  } else if (state.explicitContentFilter === 1) {
    add({
      id: "content-filter-partial",
      severity: "tip",
      category: "moderation",
      title: "Le filtre de contenu ne concerne que les membres sans rôle",
      detail: "Dès qu’un membre reçoit un rôle, ses images ne sont plus analysées. Analyser les médias de tous les membres est plus sûr.",
      fix: "content-filter",
      points: 3,
    });
  } else {
    strengths.push("Les médias explicites sont filtrés pour tous les membres.");
  }

  const rules = state.automodRules ?? [];
  const enabledRules = rules.filter((r) => r.enabled);
  if (enabledRules.length === 0) {
    add({
      id: "automod-none",
      severity: "warning",
      category: "moderation",
      title: "Aucune règle AutoMod active",
      detail:
        "L’AutoMod est le modérateur automatique intégré à Discord : il bloque le spam, les mentions de masse et les insultes avant même qu’ils soient publiés, 24 h/24. C’est gratuit et ça soulage votre équipe.",
      fix: "automod-basics",
      points: 10,
    });
  } else {
    strengths.push(`AutoMod actif (${enabledRules.length} règle${enabledRules.length > 1 ? "s" : ""}).`);
    if (!enabledRules.some((r) => r.triggerType === 3)) {
      add({
        id: "automod-spam-missing",
        severity: "tip",
        category: "moderation",
        title: "L’AutoMod ne bloque pas le spam",
        detail: "Ajoutez la règle anti-spam de Discord : elle repère automatiquement les messages indésirables (publicités, arnaques, liens suspects).",
        fix: "automod-spam",
        points: 3,
      });
    }
    if (!enabledRules.some((r) => r.triggerType === 5)) {
      add({
        id: "automod-mentions-missing",
        severity: "tip",
        category: "moderation",
        title: "L’AutoMod ne bloque pas les mentions de masse",
        detail: "Un message qui mentionne des dizaines de personnes est typique des raids. La règle « spam de mentions » le bloque et active la protection contre les raids.",
        fix: "automod-mentions",
        points: 3,
      });
    }
  }

  const base = everyone;
  const openAnnouncements = channels.filter((c) => {
    if (!isAnnouncementLike(c.type, c.name)) return false;
    const p = everyoneChannelPerms(state, base, c);
    return has(p, "VIEW_CHANNEL") && has(p, "SEND_MESSAGES");
  });
  if (openAnnouncements.length && !(everyone & ADMIN)) {
    add({
      id: "announcement-open",
      severity: "warning",
      category: "moderation",
      title: "Tout le monde peut écrire dans les annonces",
      detail: "Les annonces importantes risquent d’être noyées sous les réponses ou détournées. Un salon d’annonces doit être en lecture seule pour les membres.",
      fix: "announcements-readonly",
      points: 6,
      items: openAnnouncements.map((c) => `#${c.name}`),
    });
  }

  const staffLike = channels.filter((c) => LOGS_RE.test(plainName(c.name)) && c.type !== DISCORD_CHANNEL_TYPE.voice && c.type !== DISCORD_CHANNEL_TYPE.stage);
  const privateStaff = staffLike.filter((c) => !has(everyoneChannelPerms(state, base, c), "VIEW_CHANNEL"));
  const publicLogs = staffLike.filter((c) => has(everyoneChannelPerms(state, base, c), "VIEW_CHANNEL") && /\b(logs?|sanctions?)\b/.test(plainName(c.name)));
  if (publicLogs.length) {
    add({
      id: "logs-public",
      severity: "warning",
      category: "moderation",
      title: "Des salons de logs sont visibles par tous",
      detail: "Les logs contiennent des informations de modération (sanctions, messages supprimés). Ils doivent être réservés à l’équipe.",
      points: 5,
      items: publicLogs.map((c) => `#${c.name}`),
      howTo: "Modifier le salon → Permissions : refusez « Voir le salon » à @everyone et autorisez-le pour votre rôle d’équipe.",
    });
  }
  if (!privateStaff.length) {
    add({
      id: "no-staff-channel",
      severity: "tip",
      category: "moderation",
      title: "Pas de salon privé pour l’équipe",
      detail: "Un salon réservé aux modérateurs (logs, discussions d’équipe) permet de se coordonner sans exposer les décisions à tout le serveur.",
      points: 3,
      howTo: "Créez une catégorie « Équipe » visible uniquement par vos rôles de modération, avec un salon de discussion et un salon de logs.",
    });
  } else {
    strengths.push("Un espace privé est réservé à l’équipe.");
  }

  const mentionableStaff = state.roles.filter((r) => r.id !== state.id && !r.managed && r.mentionable && isStaffPerms(rolePerms(r)));
  if (mentionableStaff.length) {
    add({
      id: "mentionable-staff",
      severity: "tip",
      category: "moderation",
      title: "Des rôles d’équipe sont mentionnables par tous",
      detail: "N’importe quel membre peut notifier toute l’équipe d’un coup. Si c’est voulu (appel à l’aide), pensez à un système de tickets ; sinon, désactivez la mention.",
      points: 2,
      items: mentionableStaff.map((r) => r.name),
      howTo: "Paramètres du serveur → Rôles → rôle concerné : désactivez « Permettre à tout le monde de @mentionner ce rôle ».",
    });
  }

  /* ---------------------------- Organisation ---------------------------- */
  if (state.defaultMessageNotifications === 0) {
    add({
      id: "notifications-all",
      severity: "warning",
      category: "organisation",
      title: "Notifications par défaut : tous les messages",
      detail: "Chaque nouveau membre reçoit une notification pour chaque message. C’est vite épuisant et beaucoup finissent par quitter le serveur. « Mentions uniquement » est recommandé.",
      fix: "notifications",
      points: 4,
    });
  } else {
    strengths.push("Notifications par défaut sur « mentions uniquement ».");
  }

  const uncategorized = channels.filter((c) => !c.parentId);
  if (uncategorized.length > 5) {
    add({
      id: "uncategorized-many",
      severity: "tip",
      category: "organisation",
      title: `${uncategorized.length} salons ne sont rangés dans aucune catégorie`,
      detail: "Des salons en vrac rendent le serveur difficile à parcourir. Regroupez-les par thème (Informations, Discussions, Vocal…).",
      points: 3,
      items: uncategorized.map((c) => c.name),
      howTo: "Faites glisser les salons dans des catégories, ou réorganisez le serveur depuis l’éditeur Make Your Server.",
    });
  } else if (channels.length > 0) {
    strengths.push("Les salons sont bien rangés dans des catégories.");
  }

  const emptyCats = categories.filter((cat) => !channels.some((c) => c.parentId === cat.id));
  if (emptyCats.length) {
    add({
      id: "empty-categories",
      severity: "tip",
      category: "organisation",
      title: emptyCats.length > 1 ? `${emptyCats.length} catégories sont vides` : "Une catégorie est vide",
      detail: "Une catégorie sans salon encombre la liste pour rien. Supprimez-la ou ajoutez-y des salons.",
      points: 2,
      items: emptyCats.map((c) => c.name),
    });
  }

  /* ------------------------------- Accueil ------------------------------ */
  const rulesChannel = state.rulesChannelId ? channels.find((c) => c.id === state.rulesChannelId) : channels.find((c) => RULES_RE.test(plainName(c.name)));
  if (!rulesChannel) {
    add({
      id: "no-rules",
      severity: "warning",
      category: "accueil",
      title: "Pas de salon de règlement",
      detail: "Sans règles écrites, difficile de modérer de façon juste : les membres ne savent pas ce qui est attendu et l’équipe ne peut s’appuyer sur rien.",
      points: 6,
      howTo: "Créez un salon « règlement » en lecture seule et publiez-y vos règles. Les templates Make Your Server en proposent un prêt à l’emploi.",
    });
  } else {
    strengths.push(`Un salon de règlement existe (#${rulesChannel.name}).`);
  }

  if (!community) {
    add({
      id: "community-off",
      severity: "tip",
      category: "accueil",
      title: "La Communauté Discord n’est pas activée",
      detail: "La Communauté débloque l’intégration des nouveaux membres (onboarding), les salons d’annonces, l’écran d’accueil et les statistiques. Elle est gratuite.",
      points: 2,
      howTo: "Paramètres du serveur → Activer la Communauté, puis suivez les étapes proposées par Discord.",
    });
  } else {
    strengths.push("La Communauté Discord est activée.");
    if (!state.onboarding?.enabled) {
      add({
        id: "onboarding-missing",
        severity: "warning",
        category: "accueil",
        title: "L’intégration des nouveaux membres (onboarding) est désactivée",
        detail: "L’onboarding pose quelques questions aux arrivants pour leur montrer les bons salons et leur donner des rôles. Les nouveaux membres se sentent guidés au lieu d’être perdus.",
        points: 4,
        howTo: "Paramètres du serveur → Intégration : configurez les salons par défaut et quelques questions.",
      });
    } else {
      strengths.push("L’onboarding guide les nouveaux membres.");
    }
    const welcomeOn = state.welcomeScreen ? (state.welcomeScreen.enabled ?? state.features.includes("WELCOME_SCREEN_ENABLED")) : false;
    if (!welcomeOn) {
      add({
        id: "welcome-screen-missing",
        severity: "tip",
        category: "accueil",
        title: "Pas d’écran d’accueil",
        detail: "L’écran d’accueil présente le serveur et met en avant jusqu’à 5 salons dès l’arrivée d’un membre.",
        points: 1,
        howTo: "Paramètres du serveur → Intégration → Écran d’accueil.",
      });
    }
  }

  if (!state.systemChannelId) {
    add({
      id: "system-channel-missing",
      severity: "tip",
      category: "accueil",
      title: "Pas de salon pour les messages système",
      detail: "Discord n’affiche ni l’arrivée des nouveaux membres ni les boosts. Choisir un salon permet de souhaiter la bienvenue et de remercier les boosters.",
      points: 2,
      howTo: "Paramètres du serveur → Vue d’ensemble → Salon des messages système.",
    });
  }

  /* -------------------------------- Score ------------------------------- */
  const order: Record<AuditSeverity, number> = { critical: 0, warning: 1, tip: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity] || b.points - a.points || a.id.localeCompare(b.id));
  let score = Math.max(0, 100 - issues.reduce((n, i) => n + i.points, 0));
  if (issues.some((i) => i.severity === "critical")) score = Math.min(score, 69);
  const counts: Record<AuditSeverity, number> = { critical: 0, warning: 0, tip: 0 };
  issues.forEach((i) => counts[i.severity]++);
  return { version: 1, score, grade: gradeFor(score), issues, strengths, counts };
}

export function gradeFor(score: number): AuditGrade {
  if (score >= 85) return "excellent";
  if (score >= 70) return "bon";
  if (score >= 50) return "moyen";
  return "fragile";
}

/* -------------------------------------------------------------------------- */
/*                                  Correctifs                                 */
/* -------------------------------------------------------------------------- */

export function isAuditFixId(v: string): v is AuditFixId {
  return (AUDIT_FIX_IDS as readonly string[]).includes(v);
}

const BLOCK_MESSAGE = "Message bloqué par la modération automatique du serveur.";

/**
 * Applique des correctifs à une spécification issue de `backupToSpec(state).spec`.
 * Ne retire rien d’autre que ce qui est demandé et respecte les limites Discord
 * (une seule règle AutoMod par type « spam », « mentions », « listes prédéfinies »).
 */
export function applyAuditFixes(input: ServerSpec, fixIds: readonly string[]): ServerSpec {
  const spec = cloneSpec(input);
  const fixes = new Set(fixIds.filter(isAuditFixId));

  if (fixes.has("everyone-permissions")) {
    spec.everyone.permissions = spec.everyone.permissions.filter((p) => !isDangerous(p as PermissionKey));
  }
  if (fixes.has("verification") && (spec.settings.verificationLevel === "none" || spec.settings.verificationLevel === "low")) {
    spec.settings.verificationLevel = "medium";
  }
  if (fixes.has("content-filter")) spec.settings.explicitContentFilter = "all_members";
  if (fixes.has("notifications")) spec.settings.defaultNotifications = "only_mentions";

  const wantSpam = fixes.has("automod-basics") || fixes.has("automod-spam");
  const wantMentions = fixes.has("automod-basics") || fixes.has("automod-mentions");
  const wantPresets = fixes.has("automod-basics");
  if (wantSpam || wantMentions || wantPresets) {
    // Les rôles d’équipe ne sont pas concernés par les règles ajoutées.
    const staff = spec.roles
      .filter((r) => r.permissions.some((p) => ["ADMINISTRATOR", "MANAGE_GUILD", "MANAGE_MESSAGES", "MODERATE_MEMBERS"].includes(p)))
      .slice(0, 20)
      .map((r) => r.id);
    const ensure = (type: AutoModRule["trigger"]["type"], make: () => Omit<AutoModRule, "id">, base: string) => {
      const existing = spec.automod.filter((r) => r.trigger.type === type);
      if (existing.length) {
        existing.forEach((r) => (r.enabled = true));
        return;
      }
      const limit = type === "spam" ? DISCORD_LIMITS.maxAutomodSpamRules : type === "mention_spam" ? DISCORD_LIMITS.maxAutomodMentionRules : DISCORD_LIMITS.maxAutomodPresetRules;
      if (existing.length >= limit) return;
      spec.automod.push({ id: uniqueId(spec, base), ...make() });
    };
    if (wantSpam)
      ensure("spam", () => ({ name: "Anti-spam", enabled: true, trigger: { type: "spam" }, actions: [{ type: "block", customMessage: BLOCK_MESSAGE }], exemptRoles: staff, exemptChannels: [] }), "mys-anti-spam");
    if (wantMentions)
      ensure(
        "mention_spam",
        () => ({
          name: "Anti-mentions de masse",
          enabled: true,
          trigger: { type: "mention_spam", mentionLimit: 6, raidProtection: true },
          actions: [{ type: "block", customMessage: BLOCK_MESSAGE }],
          exemptRoles: staff,
          exemptChannels: [],
        }),
        "mys-anti-mentions",
      );
    if (wantPresets)
      ensure(
        "keyword_preset",
        () => ({
          name: "Insultes graves et contenu sexuel",
          enabled: true,
          trigger: { type: "keyword_preset", presets: ["slurs", "sexual_content"], allowList: [] },
          actions: [{ type: "block", customMessage: BLOCK_MESSAGE }],
          exemptRoles: staff,
          exemptChannels: [],
        }),
        "mys-filtre-langage",
      );
  }

  if (fixes.has("announcements-readonly") && !spec.everyone.permissions.includes("ADMINISTRATOR")) {
    // Rôles d’équipe non administrateurs : ils doivent pouvoir continuer à publier.
    const staff = spec.roles
      .filter((r) => !r.permissions.includes("ADMINISTRATOR") && r.permissions.some((p) => ["MANAGE_GUILD", "MANAGE_CHANNELS", "MANAGE_MESSAGES"].includes(p)))
      .slice(0, 10)
      .map((r) => r.id);
    for (const { channel, category } of allChannels(spec)) {
      if (!isAnnouncementLike(channel.type, channel.name)) continue;
      const access = everyoneAccess(spec, channel.id);
      if (!access?.canView || !access.canSend) continue;
      if (channel.syncPermissions && category) {
        channel.overwrites = cloneSpec(category.overwrites);
        channel.syncPermissions = false;
      }
      const ows = channel.overwrites;
      const upsert = (target: string): Overwrite => {
        let o = ows.find((x) => x.target === target);
        if (!o) {
          o = { target, allow: [], deny: [] };
          ows.push(o);
        }
        return o;
      };
      const ev = upsert(EVERYONE);
      ev.allow = ev.allow.filter((p) => p !== "SEND_MESSAGES");
      if (!ev.deny.includes("SEND_MESSAGES")) ev.deny.push("SEND_MESSAGES");
      for (const roleId of staff) {
        const o = upsert(roleId);
        o.deny = o.deny.filter((p) => p !== "SEND_MESSAGES");
        if (!o.allow.includes("SEND_MESSAGES")) o.allow.push("SEND_MESSAGES");
      }
    }
  }
  return spec;
}

export interface AuditFixProject {
  /** Projet prêt à installer en mode fusion : seuls les éléments utiles sont conservés. */
  spec: ServerSpec;
  /** Correspondances localId → identifiant Discord, pour mettre à jour les éléments existants (sans doublon). */
  mapping: Record<string, string>;
  /** Erreurs de validation du projet obtenu (l’installation les refuserait). */
  errors: Issue[];
  /** Correctifs effectivement appliqués. */
  applied: AuditFixId[];
}

/**
 * Construit le projet « Correctifs » à partir de l’état actuel du serveur.
 * Les règles AutoMod inchangées, l’onboarding et l’écran d’accueil sont retirés
 * pour que l’installation ne touche qu’à ce qui est corrigé.
 */
export function buildAuditFixProject(state: GuildState, fixIds: readonly string[]): AuditFixProject {
  const conv = backupToSpec(state);
  const applied = [...new Set(fixIds.filter(isAuditFixId))];
  const fixed = applyAuditFixes(conv.spec, applied);
  const original = new Map(conv.spec.automod.map((r) => [r.id, JSON.stringify(r)]));
  fixed.automod = fixed.automod.filter((r) => original.get(r.id) !== JSON.stringify(r));
  delete fixed.onboarding;
  delete fixed.welcomeScreen;
  fixed.meta.description = `Correctifs proposés par l’analyse « Santé du serveur » de « ${state.name} ».`.slice(0, 500);
  const keptAutomod = new Set(fixed.automod.map((r) => r.id));
  const mapping = Object.fromEntries(Object.entries(conv.mapping).filter(([k]) => !k.startsWith("__") && (!k.startsWith("a-") || keptAutomod.has(k))));
  return { spec: fixed, mapping, errors: validateSpec(fixed).errors, applied };
}
