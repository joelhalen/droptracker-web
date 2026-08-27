/**
 * Hand-authored response types and local Zod schemas for the BFF client that
 * are not (yet) part of `@droptracker/api-types`. Split out of the old
 * `lib/api.ts` so every domain module can import them.
 */
import { z } from "zod";
import type { GroupSubscription } from "@droptracker/api-types";

/**
 * One entry of `/feed/recent` (Redis history behind the live ticker). Unlike
 * live SSE frames (`RealtimeEventSchema`) the history entries carry `ts`
 * inside `data` and no top-level timestamp, so they get their own shape here.
 */
export const FeedEventSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});
export type FeedEvent = z.infer<typeof FeedEventSchema>;

/* -------------------------------------------------------------------------- */
/* Superadmin dashboard contract (site-superadmin dashboard).                 */
/* These shapes are hand-declared here until they land in @droptracker/api-    */
/* types (backend agent owns that package). Keep them in sync with the         */
/* backend contract; this file is the front-end's single import surface.       */
/* -------------------------------------------------------------------------- */

/** A single KPI on the admin overview dashboard. */
export interface AdminOverviewStat {
  key: string;
  label: string;
  value: string | number;
  hint?: string;
}

/** GET /admin/overview */
export interface AdminOverview {
  stats: AdminOverviewStat[];
  /** Unix seconds or ISO timestamp of when the snapshot was computed. */
  generated_at: number | string;
}

/** Whitelisted, safe-to-browse entities for the data viewer/editor. */
export const ADMIN_DATA_ENTITIES = [
  "players",
  "groups",
  "users",
  "group_configurations",
  "subscription_tiers",
  "group_subscriptions",
  "user_subscriptions",
  "audit_log",
  "announcements",
  "notification_queue",
  "discord_outbox",
] as const;
export type AdminDataEntity = (typeof ADMIN_DATA_ENTITIES)[number];

export type AdminDataRow = Record<string, unknown>;

/** GET /admin/data/{entity} */
export interface AdminDataList {
  entity: string;
  columns: string[];
  rows: AdminDataRow[];
  editable: string[];
  meta: { page: number; limit: number; total: number };
}

/** GET /admin/data/{entity}/{id} */
export interface AdminDataRecord {
  entity: string;
  id: string | number;
  record: AdminDataRow;
  editable: string[];
}

/** GET /admin/logs */
export interface AdminLogEntry {
  ts: number;
  level: string;
  source: string;
  message: string;
}
export interface AdminLogs {
  entries: AdminLogEntry[];
  sources: string[];
}

/** GET /admin/groups/{groupId}/overview */
export interface AdminGroupOverview {
  group: {
    id: number;
    name: string;
    member_count: number;
    guild_id: string | null;
    wom_id: number | null;
  };
  subscription: GroupSubscription | null;
  config_summary: Record<string, unknown>;
  activity_7d: { date: string; submissions: number }[];
  last_submission_ts: number | null;
  warnings: string[];
}

/** GET /admin/audit */
export interface AdminAuditActor {
  user_id: number;
  discord_id: string | null;
  username: string | null;
}
export interface AdminAuditEntry {
  id: number;
  actor: AdminAuditActor | null;
  group_id: number | null;
  action: string;
  target: string | null;
  before: string | null;
  after: string | null;
  /** True when the viewer is a developer and this action's payload is
   *  withheld (the row metadata is still shown). Absent on old backends. */
  redacted?: boolean;
  created_at: number | null;
}
export interface AdminAuditLog {
  entries: AdminAuditEntry[];
  meta: { page: number; limit: number; total: number };
}

/** GET /admin/users/{id}/overview */
export interface AdminUserOverview {
  user: {
    user_id: number;
    discord_id: string | null;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_superadmin: boolean;
    is_developer: boolean;
    public: boolean;
    hidden: boolean;
    date_added: number | null;
  };
  players: { id: number; name: string; wom_id: number | null; hidden: boolean }[];
  groups: { id: number; name: string; role: string }[];
  recent_audit: AdminAuditEntry[];
}

/* -------------------------------------------------------------------------- */
/* Group config: Discord channel picker (typed config editor "channel" fields). */
/* -------------------------------------------------------------------------- */

/** GET /groups/{id}/discord-channels */
export interface DiscordChannel {
  id: string;
  name: string;
  position: number;
  /** "text" (also the implied default for pre-migration cache entries),
   * "forum" (not directly messageable — only its threads are), "thread"
   * (a forum post / channel thread; sendable exactly like a channel),
   * "category" (a channel group — not messageable; a container target for
   * per-team channels), or "voice" (offered for the `vc_to_display_*` stat
   * displays, which rename the channel rather than post in it).
   *
   * This list is the guild's channel INVENTORY, not a list of places the bot
   * can post — a picker choosing a notification destination has to select for
   * messageable kinds itself. */
  type?: "text" | "forum" | "thread" | "category" | "voice";
  /** Threads only: id of the parent forum/text channel. */
  parent_id?: string;
}
export interface DiscordChannelList {
  channels: DiscordChannel[];
  /** False when the bot hasn't cached this guild's channels yet (or is down) —
   * the frontend must still allow typing a raw channel id in that case. */
  cached: boolean;
}

/** GET /groups/{id}/pb-bosses — boss names with at least one stored PB,
 * i.e. the valid values for `personal_best_embed_boss_list`. */
export interface PbBossList {
  bosses: string[];
  cached: boolean;
}

/** GET /lootboard-styles — the selectable lootboard style catalog
 * (backs the `loot_board_type` preview picker in the config editor). */
export const LootboardStyleSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  preview_url: z.string(),
});
export const LootboardStyleListSchema = z.object({ styles: z.array(LootboardStyleSchema) });
export type LootboardStyle = z.infer<typeof LootboardStyleSchema>;
export type LootboardStyleList = z.infer<typeof LootboardStyleListSchema>;

/* -------------------------------------------------------------------------- */
/* Event Discord config (Task 19): guilds/channels from the bot's Redis caches. */
/* -------------------------------------------------------------------------- */

/** GET /events/discord/guilds — every guild the bot is a member of. */
export interface EventDiscordGuild {
  id: string;
  name: string;
  icon?: string | null;
}
export interface EventDiscordGuildList {
  guilds: EventDiscordGuild[];
  /** True when the bot hasn't refreshed `bot:guilds` yet (or is down) —
   * the UI falls back to manual guild-id entry. */
  stale: boolean;
}

/** GET /events/discord/guilds/{guildId}/channels */
export interface EventDiscordChannelList {
  channels: DiscordChannel[];
  /** True on a cold cache; the request also asks the bot to warm it, so a
   * retry usually succeeds within seconds. Manual-id entry stays available. */
  stale: boolean;
}

/* -------------------------------------------------------------------------- */
/* Completion history + manager audit log (web57a).                            */
/* -------------------------------------------------------------------------- */

/** GET /events/{id}/completions/history — public completion timeline. Hidden
 * players are masked to "Hidden player" for non-admin viewers server-side. */
export const CompletionHistoryEntrySchema = z.object({
  completion_id: z.number(),
  task_id: z.number(),
  task_label: z.string().nullable(),
  task_type: z.string().nullable(),
  task_points: z.number(),
  team_id: z.number().nullable(),
  team_name: z.string().nullable(),
  player_id: z.number().nullable(),
  player_name: z.string().nullable(),
  hidden: z.boolean(),
  matched_target: z.string().nullable(),
  quantity: z.number(),
  points: z.number(),
  source_type: z.string().nullable(),
  status: z.string(),
  proof_url: z.string().nullable(),
  /** Organizer's reason on a manual award. */
  note: z.string().nullable().optional(),
  created_at: z.number().nullable(),
  /** Progress ticks the backend folded into this row ("advanced N times") —
   * absent on a plain single row. Only set when progress rows are shown. */
  collapsed: z.number().optional(),
  /** `created_at` of the oldest tick folded in, when `collapsed` is set. */
  collapsed_since: z.number().nullable().optional(),
});
export const CompletionHistorySchema = z.object({
  event_id: z.number(),
  kind: z.string(),
  is_admin: z.boolean(),
  entries: z.array(CompletionHistoryEntrySchema),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    /** Bucket sizes for the current filters *before* `mode` narrows, so the
     * "show progress updates" toggle can be labelled without a 2nd request.
     * Optional: an older backend deployment doesn't send them. */
    mode: z.string().optional(),
    completions_total: z.number().optional(),
    progress_total: z.number().optional(),
  }),
});
export type CompletionHistory = z.infer<typeof CompletionHistorySchema>;
export type CompletionHistoryEntry = z.infer<typeof CompletionHistoryEntrySchema>;
/** Which ledger rows the timeline shows — see `api.eventCompletionHistory`. */
export const COMPLETION_HISTORY_MODES = ["completions", "all", "progress"] as const;
export type CompletionHistoryMode = (typeof COMPLETION_HISTORY_MODES)[number];

/** GET /events/{id}/audit — event-scoped manager audit timeline (admin only). */
export const AuditActorSchema = z.object({
  user_id: z.number(),
  discord_id: z.string().nullable(),
  username: z.string().nullable(),
});
export const AuditEntrySchema = z.object({
  id: z.string(),
  source: z.enum(["ledger", "audit"]),
  category: z.string(),
  action: z.string(),
  completion_id: z.number().nullable(),
  created_at: z.number().nullable(),
  actor: AuditActorSchema.nullable(),
  task_id: z.number().nullable(),
  task_label: z.string().nullable(),
  team_id: z.number().nullable(),
  team_name: z.string().nullable(),
  player_id: z.number().nullable(),
  player_name: z.string().nullable(),
  matched_target: z.string().nullable(),
  quantity: z.number().nullable(),
  source_type: z.string().nullable(),
  status: z.string().nullable(),
  proof_url: z.string().nullable(),
  note: z.string().nullable(),
  before: z.string().nullable(),
  after: z.string().nullable(),
  target: z.string().nullable(),
  summary: z.string(),
});
export const EventAuditSchema = z.object({
  event_id: z.number(),
  entries: z.array(AuditEntrySchema),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    capped: z.boolean(),
  }),
});
export type EventAudit = z.infer<typeof EventAuditSchema>;
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export interface EventAuditParams {
  page?: number;
  limit?: number;
  category?: string[];
  actorUserId?: number;
  playerId?: number;
  teamId?: number;
  taskId?: number;
  sourceType?: string;
  hasProof?: boolean;
  from?: number;
  to?: number;
  q?: string;
}
