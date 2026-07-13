/**
 * Typed group-configuration registry (FRONTEND_PLAN.md §11.1).
 *
 * Single source of truth for the 55+ `group_configurations` keys that the PHP
 * `Groups::actionConfig()` handler exposed. Both the admin config editor (this
 * repo) and the backend's typed `GET/PATCH /api/v1/groups/{id}/config` endpoint
 * validate against this registry, so the two never drift.
 *
 * Each field declares its category, input type, default, help text, and
 * validation hints. A Zod schema is derived from the registry at the bottom.
 */
import { z } from "zod";

export type ConfigCategory =
  | "channels"
  | "drops"
  | "levels"
  | "pbs"
  | "cas"
  | "board"
  | "integration";

export type ConfigFieldType =
  | "channel" // Discord channel id (stored as string)
  | "boolean"
  | "int"
  | "string"
  | "text" // multi-line
  | "csv" // comma-separated list
  | "bosslist" // comma-separated boss names, picked from GET /groups/{id}/pb-bosses
  | "boardstyle" // lootboards-table row id, picked from GET /lootboard-styles
  | "select";

export interface ConfigField {
  key: string;
  label: string;
  category: ConfigCategory;
  type: ConfigFieldType;
  help: string;
  default: string | number | boolean | null;
  /** For `select` fields. */
  options?: { value: string; label: string }[];
  /** For `int` fields. */
  min?: number;
  max?: number;
  /** Whether a `seasonal_`-prefixed mirror of this key exists (§11.1). */
  seasonalMirror?: boolean;
  /** Subscription entitlement required to edit this field (Task 15). */
  entitlement?: string;
}

export const CONFIG_CATEGORIES: { id: ConfigCategory; label: string }[] = [
  { id: "channels", label: "Channels" },
  { id: "drops", label: "Drop notifications" },
  { id: "levels", label: "Level notifications" },
  { id: "pbs", label: "Personal best" },
  { id: "cas", label: "Combat achievements" },
  { id: "board", label: "Lootboard" },
  { id: "integration", label: "Integration & info" },
];

export const GROUP_CONFIG_FIELDS: ConfigField[] = [
  // --- Channels ----------------------------------------------------------
  // Notification routing reads the channel_id_to_post_* keys (backend
  // services/notification_service.py). Earlier *_channel_id names were dead
  // keys nothing consumed; backend migration web20a moved saved values over.
  { key: "channel_id_to_post_loot", label: "Drops channel", category: "channels", type: "channel", help: "Channel where drop notifications are posted.", default: null },
  { key: "lootboard_channel_id", label: "Lootboard channel", category: "channels", type: "channel", help: "Channel where the lootboard image is posted/updated.", default: null },
  { key: "lootboard_message_id", label: "Lootboard message id", category: "channels", type: "string", help: "Message the bot edits when reposting the board. Managed automatically.", default: null },
  { key: "channel_id_to_post_levels", label: "Levels channel", category: "channels", type: "channel", help: "Channel for level-up notifications. Falls back to the drops channel when unset.", default: null },
  { key: "channel_id_to_post_pb", label: "Personal best channel", category: "channels", type: "channel", help: "Channel for personal-best notifications. Falls back to the drops channel when unset.", default: null },
  { key: "channel_id_to_post_ca", label: "Combat achievements channel", category: "channels", type: "channel", help: "Channel for combat-achievement notifications. Falls back to the drops channel when unset.", default: null },
  { key: "channel_id_to_post_pets", label: "Pets channel", category: "channels", type: "channel", help: "Channel for pet notifications. Falls back to the drops channel when unset.", default: null },
  { key: "channel_id_to_post_quests", label: "Quests channel", category: "channels", type: "channel", help: "Channel for quest-completion notifications. Falls back to the drops channel when unset.", default: null },
  { key: "channel_id_to_post_clog", label: "Collection log channel", category: "channels", type: "channel", help: "Channel for collection-log notifications. Falls back to the drops channel when unset.", default: null },
  { key: "channel_id_to_post_deaths", label: "Deaths channel", category: "channels", type: "channel", help: "Channel for player-death notifications. Falls back to the drops channel when unset.", default: null },
  { key: "channel_id_to_post_diaries", label: "Diaries channel", category: "channels", type: "channel", help: "Channel for achievement-diary notifications. Falls back to the drops channel when unset.", default: null },
  { key: "announcements_channel_id", label: "Announcements channel", category: "channels", type: "channel", help: "Channel where published announcements are syndicated (FRONTEND_PLAN.md §10).", default: null },

  // --- Drop notifications -------------------------------------------------
  // Defaults must match the backend processors' runtime fallbacks
  // (data/submissions/drop.py) so the editor never shows one behavior while
  // the bot does another.
  { key: "minimum_value_to_notify", label: "Minimum value to notify", category: "drops", type: "int", help: "Suppress drop notifications below this GP value.", default: 2500000, min: 0 },
  { key: "only_include_items_over_minimum", label: "Only items over minimum", category: "drops", type: "boolean", help: "On stacked/multi-item drops, only include items above the minimum value.", default: false, seasonalMirror: true },
  { key: "only_send_messages_with_images", label: "Only send with images", category: "drops", type: "boolean", help: "Require a screenshot before posting a drop.", default: false, seasonalMirror: true },
  { key: "send_stacks_of_items", label: "Announce item stacks", category: "drops", type: "boolean", help: "Announce drops of stackable items (e.g. rune/coin stacks) when their total value passes the minimum.", default: false, seasonalMirror: true },
  { key: "notify_clogs", label: "Notify collection logs", category: "drops", type: "boolean", help: "Post a notification on new collection-log slots.", default: true, seasonalMirror: true },
  { key: "notify_cas", label: "Notify combat achievements", category: "drops", type: "boolean", help: "Post a notification on combat-achievement completions.", default: true, seasonalMirror: true },
  { key: "notify_pets", label: "Notify pets", category: "drops", type: "boolean", help: "Post a notification on pet drops.", default: true, seasonalMirror: true },
  { key: "notify_quests", label: "Notify quests", category: "drops", type: "boolean", help: "Post a notification on quest completions.", default: false, seasonalMirror: true },
  { key: "notify_special_quests", label: "Notify special quests", category: "drops", type: "boolean", help: "Notify on milestone/special quests even when general quest notifications are off.", default: true, seasonalMirror: true },
  { key: "notify_deaths", label: "Notify deaths", category: "drops", type: "boolean", help: "Post a notification when a member dies.", default: false, seasonalMirror: true },
  { key: "notify_diaries", label: "Notify achievement diaries", category: "drops", type: "boolean", help: "Post a notification on achievement-diary completions.", default: false, seasonalMirror: true },

  // --- Level notifications ------------------------------------------------
  { key: "notify_levels", label: "Notify levels", category: "levels", type: "boolean", help: "Master toggle for level-up, total-level milestone, and post-99 XP milestone notifications.", default: false, seasonalMirror: true },
  { key: "level_minimum_for_notifications", label: "Minimum level", category: "levels", type: "int", help: "Only notify for levels at or above this value.", default: 1, min: 1, max: 99 },
  { key: "level_increment", label: "Level increment", category: "levels", type: "int", help: "Notify every N levels (1 = every level). Level 99 always notifies.", default: 1, min: 1, max: 99 },
  { key: "level_milestones", label: "Total level milestones", category: "levels", type: "csv", help: "Comma-separated TOTAL levels that always notify (e.g. 1500,2000,2277).", default: "" },
  { key: "post99_xp_interval", label: "Post-99 XP interval", category: "levels", type: "int", help: "After a skill reaches 99, notify every N XP (e.g. 25000000 = every 25M). Multiples of 1M; 0 disables.", default: 25000000, min: 0 },

  // --- Personal best ------------------------------------------------------
  // notify_pbs (PB notifications) is available to every group. The Hall of
  // Fame fields below are premium (entitlement: "hall_of_fame");
  // create_pb_embeds is the master switch the HOF bot keys off of.
  { key: "notify_pbs", label: "Notify personal bests", category: "pbs", type: "boolean", help: "Post personal-best notifications in Discord. Available to all groups.", default: true, seasonalMirror: true },
  { key: "create_pb_embeds", label: "Enable Hall of Fame", category: "pbs", type: "boolean", help: "Post and keep updated the Hall of Fame personal-best leaderboards in Discord. Turn this on, then choose the bosses and channel below.", default: false, entitlement: "hall_of_fame" },
  { key: "personal_best_embed_boss_list", label: "Hall of Fame bosses", category: "pbs", type: "bosslist", help: "Bosses featured in the Hall of Fame. Empty = no bosses shown.", default: "", entitlement: "hall_of_fame" },
  { key: "number_of_pbs_to_display", label: "PBs to display", category: "pbs", type: "int", help: "Top PB entries shown per team-size bracket in Hall of Fame messages.", default: 5, min: 1, max: 10, entitlement: "hall_of_fame" },
  { key: "channel_id_to_send_pb_embeds", label: "Hall of Fame channel", category: "pbs", type: "channel", help: "Channel where the Hall of Fame leaderboards are posted.", default: null, entitlement: "hall_of_fame" },
  { key: "hof_individual_boss_messages", label: "Individual Hall of Fame messages", category: "pbs", type: "boolean", help: "Post one Hall of Fame message per boss. When off, only the directory message is posted and members use its drop-down to view each boss's leaderboard.", default: false, entitlement: "hall_of_fame" },

  // --- Combat achievements ------------------------------------------------
  {
    key: "min_ca_tier_to_notify",
    label: "Minimum CA tier",
    category: "cas",
    type: "select",
    help: "Lowest combat-achievement tier that triggers a notification.",
    default: "EASY",
    options: ["EASY", "MEDIUM", "HARD", "ELITE", "MASTER", "GRANDMASTER"].map((t) => ({
      value: t,
      label: t.charAt(0) + t.slice(1).toLowerCase(),
    })),
    seasonalMirror: true,
  },

  // --- Board settings -----------------------------------------------------
  // boardstyle: the full ~87-style catalog (GET /lootboard-styles) chosen via
  // the preview picker modal; the backend PATCH validates the id exists.
  {
    key: "loot_board_type",
    label: "Lootboard style",
    category: "board",
    type: "boardstyle",
    help: "Visual style of the generated lootboard. Browse the catalog with live previews.",
    default: "1",
  },
  { key: "use_dynamic_colors", label: "Dynamic colors", category: "board", type: "boolean", help: "Color item tiles by relative value.", default: true },
  { key: "use_gp_colors", label: "GP colors", category: "board", type: "boolean", help: "Use GP-value color thresholds on the board.", default: true },
  { key: "repost_lootboard", label: "Repost lootboard", category: "board", type: "boolean", help: "Repost (vs. edit) the board on each update.", default: false },
  { key: "seasonal_boards", label: "Seasonal boards", category: "board", type: "boolean", help: "When enabled, automatically use themed boards for holidays/seasons when made available globally.", default: false },

  // --- Split tracking -------------------------------------------------------
  // GP splits only. Point splitting is a separate setting managed on the
  // Points page (`point_sharing` / `point_sharing_method`, points routes).
  { key: "split_gp_tracking", label: "Split GP tracking", category: "drops", type: "boolean", help: "Track raid loot splits: members receive their share of a split drop's GP value instead of the receiver keeping the full amount. Point splitting is configured separately on the Points tab.", default: false },

  // --- Manual submissions (suggestion #45) ----------------------------------
  {
    key: "manual_submission_policy",
    label: "Manual submissions",
    category: "drops",
    type: "select",
    help: "How drops submitted manually on the website count for this group. They always count globally and for the player's other groups — this only controls this group's boards and notifications.",
    default: "allow",
    options: [
      { value: "allow", label: "Allow (count immediately)" },
      { value: "confirm", label: "Hold for admin approval" },
      { value: "authorized_only", label: "Authorized members only" },
      { value: "block", label: "Never count for this group" },
    ],
  },
  {
    key: "channel_id_to_post_manual_review",
    label: "Manual review channel",
    category: "channels",
    type: "channel",
    help: "Optional. Where to ping when a manual submission is held for approval (the \"Hold for admin approval\" policy). Leave unset to review only on the website.",
    default: null,
  },

  // --- Member activity log + voice-channel stat displays -------------------
  { key: "channel_id_to_send_logs", label: "Member log channel", category: "channels", type: "channel", help: "Channel where member join/leave log messages are posted. Leave unset to disable.", default: null },
  { key: "vc_to_display_monthly_loot", label: "Monthly loot voice channel", category: "integration", type: "channel", help: "Voice channel renamed every 10 minutes to show the group's monthly loot total. Voice channels aren't listed in the picker — use manual ID entry.", default: null },
  { key: "vc_to_display_monthly_loot_text", label: "Monthly loot channel text", category: "integration", type: "string", help: "Template for the loot voice channel name. Placeholders: {month}, {gp_amount}.", default: "{month}: {gp_amount} gp" },
  { key: "vc_to_display_droptracker_users", label: "Member count voice channel", category: "integration", type: "channel", help: "Voice channel renamed every 10 minutes to show the group's tracked member count. Voice channels aren't listed in the picker — use manual ID entry.", default: null },
  { key: "vc_to_display_droptracker_users_text", label: "Member count channel text", category: "integration", type: "string", help: "Template for the member-count voice channel name. Placeholder: {member_count}.", default: "{member_count} members" },

  // --- Misc / integration -------------------------------------------------
  { key: "group_name", label: "Group name", category: "integration", type: "string", help: "Display name of the group.", default: "" },
  { key: "group_description", label: "Description", category: "integration", type: "text", help: "Short description shown on the public group page.", default: "" },
  { key: "clan_chat_name", label: "Clan chat name", category: "integration", type: "string", help: "In-game clan chat name used for auto-provisioning.", default: "" },
  { key: "discord_url", label: "Discord invite URL", category: "integration", type: "string", help: "Public Discord invite shown on the group page.", default: "" },
  { key: "auto_provision_members", label: "Auto-add WiseOldMan members", category: "integration", type: "boolean", help: "Creates DropTracker profiles ahead of time for everyone in this group's linked WiseOldMan group, so members join this group automatically the moment they install the plugin — instead of waiting up to an hour for the next member sync.", default: false },
  { key: "export_api_key", label: "Export API key", category: "integration", type: "string", help: "Per-group key used for on-demand WOM sync. Treat as a secret.", default: null },
];

export const SEASONAL_PREFIX = "seasonal_";

/** All effective keys, including seasonal mirrors. */
export function allConfigKeys(): string[] {
  const keys = GROUP_CONFIG_FIELDS.map((f) => f.key);
  const seasonal = GROUP_CONFIG_FIELDS.filter((f) => f.seasonalMirror).map(
    (f) => `${SEASONAL_PREFIX}${f.key}`,
  );
  return [...keys, ...seasonal];
}

export function getConfigField(key: string): ConfigField | undefined {
  // Exact match first: some real keys (e.g. `seasonal_boards`) legitimately
  // start with the seasonal prefix and must not be treated as a mirror.
  const exact = GROUP_CONFIG_FIELDS.find((f) => f.key === key);
  if (exact) return exact;
  if (key.startsWith(SEASONAL_PREFIX)) {
    const base = key.slice(SEASONAL_PREFIX.length);
    return GROUP_CONFIG_FIELDS.find((f) => f.key === base);
  }
  return undefined;
}

/** Per-field Zod validator derived from the registry. */
function fieldSchema(f: ConfigField): z.ZodTypeAny {
  switch (f.type) {
    case "boolean":
      return z.boolean();
    case "int": {
      let s = z.number().int();
      if (f.min != null) s = s.min(f.min);
      if (f.max != null) s = s.max(f.max);
      return s;
    }
    case "select":
      return z.enum((f.options ?? []).map((o) => o.value) as [string, ...string[]]);
    case "channel":
    case "string":
    case "text":
    case "csv":
    case "bosslist":
    case "boardstyle":
      return z.string();
    default:
      return z.string();
  }
}

/**
 * Partial Zod schema for a config PATCH: every key optional and nullable, so the
 * editor can send only changed fields. Seasonal mirrors reuse their base
 * validator.
 */
export const GroupConfigPatchSchema: z.ZodTypeAny = z.object(
  Object.fromEntries(
    allConfigKeys().map((key) => {
      const field = getConfigField(key)!;
      return [key, fieldSchema(field).nullable().optional()];
    }),
  ),
);

export type GroupConfigPatch = Record<string, string | number | boolean | null | undefined>;
