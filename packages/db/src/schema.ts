import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { ChangeSet, GuildState, Plan, PlanOptions, PlanQuotas, ServerSpec } from "@mys/core";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

/* ---------------------------------------------------------------------------
 * Comptes
 * ------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  globalName: text("global_name"),
  avatar: text("avatar"),
  createdAt: createdAt(),
  lastLoginAt: ts("last_login_at"),
  suspendedAt: ts("suspended_at"),
  suspensionReason: text("suspension_reason"),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** SHA-256 du jeton de session (le jeton lui-même n’est jamais stocké). */
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Jetons OAuth Discord chiffrés (AES-256-GCM) : utilisés pour lister les serveurs de l’utilisateur. */
export const oauthTokens = pgTable("oauth_tokens", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  scope: text("scope").notNull(),
  expiresAt: ts("expires_at").notNull(),
  updatedAt: updatedAt(),
});

/* ---------------------------------------------------------------------------
 * Templates, projets, IA
 * ------------------------------------------------------------------------- */

export const templates = pgTable(
  "templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    tagline: text("tagline").notNull().default(""),
    description: text("description").notNull().default(""),
    audience: text("audience").notNull().default(""),
    highlights: jsonb("highlights").$type<string[]>().notNull().default([]),
    theme: text("theme").notNull(),
    size: text("size").notNull(),
    features: jsonb("features").$type<string[]>().notNull().default([]),
    spec: jsonb("spec").$type<ServerSpec>().notNull(),
    /** draft | pending_review | published | rejected | archived */
    status: text("status").notNull().default("draft"),
    official: boolean("official").notNull().default(false),
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    /** Projet d’origine d’une proposition communautaire. */
    sourceProjectId: uuid("source_project_id"),
    popularity: integer("popularity").notNull().default(0),
    installCount: integer("install_count").notNull().default(0),
    reviewNote: text("review_note"),
    publishedAt: ts("published_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("templates_status_idx").on(t.status), index("templates_theme_idx").on(t.theme)],
);

/** Templates mis de côté par un utilisateur (favoris). */
export const savedTemplates = pgTable(
  "saved_templates",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").notNull().references(() => templates.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.templateId] })],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** template | ai | backup | blank */
    sourceType: text("source_type").notNull(),
    sourceTemplateId: uuid("source_template_id").references(() => templates.id, { onDelete: "set null" }),
    sourceBackupId: uuid("source_backup_id"),
    spec: jsonb("spec").$type<ServerSpec>().notNull(),
    /** Incrémenté à chaque enregistrement : protège contre les écrasements concurrents. */
    revision: integer("revision").notNull().default(1),
    /** draft | ready */
    status: text("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("projects_user_idx").on(t.userId)],
);

export const projectRevisions = pgTable(
  "project_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    spec: jsonb("spec").$type<ServerSpec>().notNull(),
    /** user | ai | restore */
    author: text("author").notNull().default("user"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("project_revisions_project_idx").on(t.projectId, t.revision)],
);

export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    /** create | edit */
    kind: text("kind").notNull(),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<Record<string, unknown>>().notNull().default({}),
    /** pending | running | succeeded | failed | applied | rejected */
    status: text("status").notNull().default("pending"),
    model: text("model"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
    resultSpec: jsonb("result_spec").$type<ServerSpec>(),
    changeSet: jsonb("change_set").$type<ChangeSet>(),
    acceptedChanges: jsonb("accepted_changes").$type<number[]>(),
    error: text("error"),
    createdAt: createdAt(),
    finishedAt: ts("finished_at"),
  },
  (t) => [index("ai_generations_user_idx").on(t.userId, t.createdAt)],
);

/* ---------------------------------------------------------------------------
 * Serveurs, sauvegardes, installations
 * ------------------------------------------------------------------------- */

/** Serveurs où le bot est présent (tenu à jour par le bot via la passerelle). */
export const botGuilds = pgTable("bot_guilds", {
  guildId: text("guild_id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  ownerId: text("owner_id"),
  joinedAt: ts("joined_at").notNull().defaultNow(),
  leftAt: ts("left_at"),
  updatedAt: updatedAt(),
});

export const backups = pgTable(
  "backups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    guildId: text("guild_id").notNull(),
    guildName: text("guild_name").notNull(),
    /** safety | manual | scheduled */
    kind: text("kind").notNull(),
    label: text("label"),
    /** Numéro de version par serveur et par utilisateur. */
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").$type<GuildState>().notNull(),
    /** Messages exportés (Premium), stockés à part dans backup_messages. */
    messageCount: integer("message_count").notNull().default(0),
    sizeBytes: integer("size_bytes").notNull().default(0),
    /** Résumé lisible : nombre de salons, rôles… */
    summary: jsonb("summary").$type<Record<string, number>>().notNull().default({}),
    /** Installation à l’origine d’une sauvegarde de sécurité. */
    installationId: uuid("installation_id"),
    expiresAt: ts("expires_at"),
    createdAt: createdAt(),
  },
  (t) => [index("backups_user_guild_idx").on(t.userId, t.guildId, t.createdAt)],
);

export const backupMessages = pgTable(
  "backup_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    backupId: uuid("backup_id").notNull().references(() => backups.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull(),
    messageId: text("message_id").notNull(),
    authorName: text("author_name").notNull(),
    authorAvatar: text("author_avatar"),
    content: text("content").notNull().default(""),
    embeds: jsonb("embeds").$type<unknown[]>().notNull().default([]),
    attachments: jsonb("attachments").$type<Array<{ name: string; url: string }>>().notNull().default([]),
    sentAt: ts("sent_at").notNull(),
  },
  (t) => [index("backup_messages_backup_idx").on(t.backupId, t.channelId)],
);

export const backupSchedules = pgTable(
  "backup_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    guildId: text("guild_id").notNull(),
    guildName: text("guild_name").notNull(),
    intervalHours: integer("interval_hours").notNull(),
    /** Salons dont les messages sont exportés à chaque sauvegarde. */
    messageChannelIds: jsonb("message_channel_ids").$type<string[]>().notNull().default([]),
    enabled: boolean("enabled").notNull().default(true),
    nextRunAt: ts("next_run_at").notNull(),
    lastRunAt: ts("last_run_at"),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("backup_schedules_user_guild_uq").on(t.userId, t.guildId)],
);

export const installations = pgTable(
  "installations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    guildId: text("guild_id").notNull(),
    guildName: text("guild_name").notNull(),
    /** install | restore */
    kind: text("kind").notNull().default("install"),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    backupId: uuid("backup_id").references(() => backups.id, { onDelete: "set null" }),
    /** Portée des correspondances localId → Discord (projet ou sauvegarde). */
    scopeId: text("scope_id").notNull(),
    /** Copie figée du projet au moment de la confirmation. */
    spec: jsonb("spec").$type<ServerSpec>().notNull(),
    options: jsonb("options").$type<PlanOptions>().notNull(),
    plan: jsonb("plan").$type<Plan>().notNull(),
    /** planned | queued | running | succeeded | partial | failed | cancelled */
    status: text("status").notNull().default("planned"),
    dryRun: boolean("dry_run").notNull().default(false),
    confirmedDestructive: boolean("confirmed_destructive").notNull().default(false),
    safetyBackupId: uuid("safety_backup_id"),
    /** Origine : web | discord */
    origin: text("origin").notNull().default("web"),
    /** Message de suivi côté Discord (jeton d’interaction, valable 15 minutes). */
    discordFollowup: jsonb("discord_followup").$type<{ applicationId: string; token: string; expiresAt: string } | null>(),
    cancelRequested: boolean("cancel_requested").notNull().default(false),
    error: text("error"),
    createdAt: createdAt(),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
  },
  (t) => [index("installations_user_idx").on(t.userId, t.createdAt), index("installations_guild_idx").on(t.guildId)],
);

export const installationSteps = pgTable(
  "installation_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    installationId: uuid("installation_id").notNull().references(() => installations.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    key: text("key").notNull(),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    localId: text("local_id"),
    targetId: text("target_id"),
    destructive: boolean("destructive").notNull().default(false),
    /** pending | running | succeeded | skipped | failed | cancelled */
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    /** Résultat lisible (« déjà présent », identifiant créé…). */
    detail: text("detail"),
    error: text("error"),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
  },
  (t) => [uniqueIndex("installation_steps_key_uq").on(t.installationId, t.key), index("installation_steps_seq_idx").on(t.installationId, t.seq)],
);

/** Correspondances entre éléments du projet et identifiants Discord réellement créés. */
export const resourceMappings = pgTable(
  "resource_mappings",
  {
    guildId: text("guild_id").notNull(),
    scopeId: text("scope_id").notNull(),
    localId: text("local_id").notNull(),
    discordId: text("discord_id").notNull(),
    kind: text("kind").notNull(),
    /** created | adopted */
    origin: text("origin").notNull().default("created"),
    installationId: uuid("installation_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.scopeId, t.localId] }), index("resource_mappings_discord_idx").on(t.guildId, t.discordId)],
);

/**
 * Éléments interactifs installés (boutons) : le bot n’agit que sur les rôles
 * enregistrés ici, pour ce serveur.
 */
export const guildFeatures = pgTable("guild_features", {
  guildId: text("guild_id").primaryKey(),
  /** Configuration résolue en identifiants Discord. */
  config: jsonb("config")
    .$type<{
      welcome?: { channelId: string; message: string };
      joinLogs?: { channelId: string };
      tickets?: { channelId: string; staffRoleIds: string[]; intro: string };
      suggestions?: { channelId: string };
      selfRoleIds?: string[];
      rulesRoleIds?: string[];
      /** Correspondances localId → identifiant Discord pour les jetons {#salon} {@role}. */
      tokens?: Record<string, string>;
    }>()
    .notNull()
    .default({}),
  installationId: uuid("installation_id"),
  updatedAt: updatedAt(),
});

/* ---------------------------------------------------------------------------
 * File de tâches persistante
 * ------------------------------------------------------------------------- */

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    /** queued | running | succeeded | failed | cancelled */
    status: text("status").notNull().default("queued"),
    runAt: ts("run_at").notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    lockedBy: text("locked_by"),
    lockedUntil: ts("locked_until"),
    lastError: text("last_error"),
    /** Empêche de mettre deux fois en file la même tâche. */
    dedupeKey: text("dedupe_key"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    finishedAt: ts("finished_at"),
  },
  (t) => [
    index("jobs_ready_idx").on(t.status, t.runAt),
    uniqueIndex("jobs_dedupe_uq").on(t.dedupeKey).where(sql`${t.dedupeKey} is not null and ${t.status} in ('queued','running')`),
  ],
);

export const workerHeartbeats = pgTable("worker_heartbeats", {
  instanceId: text("instance_id").primaryKey(),
  kind: text("kind").notNull(),
  startedAt: ts("started_at").notNull(),
  lastSeenAt: ts("last_seen_at").notNull(),
  guildCount: integer("guild_count").notNull().default(0),
  version: text("version"),
  gatewayStatus: text("gateway_status"),
});

/* ---------------------------------------------------------------------------
 * Offres, abonnements, quotas, paiements
 * ------------------------------------------------------------------------- */

export const plans = pgTable("plans", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  /** Texte libre saisi par l’administrateur (aucun prix codé en dur). */
  priceLabel: text("price_label"),
  description: text("description").notNull().default(""),
  quotas: jsonb("quotas").$type<PlanQuotas>().notNull(),
  stripePriceId: text("stripe_price_id"),
  discordSkuId: text("discord_sku_id"),
  /** Offre proposée à l’achat. */
  purchasable: boolean("purchasable").notNull().default(false),
  updatedAt: updatedAt(),
});

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    planKey: text("plan_key").notNull(),
    /** stripe | discord | manual */
    provider: text("provider").notNull(),
    /** Identifiant chez le fournisseur (abonnement Stripe, entitlement Discord…). */
    providerRef: text("provider_ref").notNull(),
    providerCustomerId: text("provider_customer_id"),
    /** active | trialing | past_due | canceled | expired */
    status: text("status").notNull(),
    currentPeriodEnd: ts("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("subscriptions_provider_ref_uq").on(t.provider, t.providerRef), index("subscriptions_user_idx").on(t.userId)],
);

export const usageCounters = pgTable(
  "usage_counters",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** AAAA-MM */
    period: text("period").notNull(),
    metric: text("metric").notNull(),
    value: bigint("value", { mode: "number" }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.period, t.metric] })],
);

/** Événements de paiement reçus (Stripe, Discord) : garantit un traitement unique. */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    type: text("type").notNull(),
    receivedAt: createdAt(),
    processedAt: ts("processed_at"),
    error: text("error"),
  },
  (t) => [uniqueIndex("webhook_events_uq").on(t.provider, t.eventId)],
);

/* ---------------------------------------------------------------------------
 * Administration & journalisation
 * ------------------------------------------------------------------------- */

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: updatedAt(),
  updatedBy: uuid("updated_by"),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id"),
    /** user | admin | system | bot */
    actorType: text("actor_type").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    guildId: text("guild_id"),
    /** Métadonnées nettoyées (jamais de jetons ni de contenu privé). */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt), index("audit_logs_action_idx").on(t.action)],
);

export const errorLogs = pgTable(
  "error_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** web | bot | worker */
    source: text("source").notNull(),
    level: text("level").notNull().default("error"),
    message: text("message").notNull(),
    context: jsonb("context").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("error_logs_created_idx").on(t.createdAt)],
);
