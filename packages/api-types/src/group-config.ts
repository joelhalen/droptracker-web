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
  | "deaths"
  | "levels"
  | "pbs"
  | "cas"
  | "board"
  | "recaps"
  | "clan_log"
  | "integration";

export type ConfigFieldType =
  | "channel" // Discord channel id (stored as string)
  | "boolean"
  | "int"
  | "string"
  | "password" // string stored as-is; rendered as a masked input with a reveal toggle
  | "text" // multi-line
  | "csv" // comma-separated list
  | "bosslist" // comma-separated boss names, picked from GET /groups/{id}/pb-bosses
  | "boardstyle" // lootboards-table row id, picked from GET /lootboard-styles
  | "select"
  | "messagelist"; // JSON array of message templates ("" = unset), edited via a list widget

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
  /**
   * Presentational, for `int` fields holding a large game amount: the editor
   * renders a shorthand-accepting field ("1.5m") that spells the resolved
   * number back, instead of asking an admin to count zeros. The stored type is
   * still a plain int — this changes the input, not the contract.
   */
  unit?: "gp" | "xp";
  /** For text-ish fields: character cap, enforced on the input and in Zod. */
  maxLength?: number;
  /** Whether a `seasonal_`-prefixed mirror of this key exists (§11.1). */
  seasonalMirror?: boolean;
  /** Subscription entitlement required to edit this field (Task 15). */
  entitlement?: string;
  /**
   * Marks a setting whose supporting release hasn't shipped yet — usually a
   * RuneLite plugin update still awaiting Plugin Hub approval, occasionally a
   * backend rollout. The editor renders a "Coming soon" badge and this note.
   *
   * The field stays fully editable and saves normally: groups configure it
   * once, ahead of the release, and it starts working the moment support
   * lands. Purely presentational — it gates nothing in validation or in the
   * save path, so the backend registry needs no matching entry.
   *
   * Prefer a string stating the actual dependency ("Requires the next RuneLite
   * plugin update…"). `true` falls back to a generic note, which answers the
   * "why isn't this doing anything?" question far less well.
   *
   * Clear the flag when the release ships — nothing expires it automatically.
   */
  comingSoon?: boolean | string;
}

const COMING_SOON_GENERIC_NOTE =
  "This setting isn't live yet. You can configure it now — it takes effect once support ships.";

/**
 * User-facing note for a pending field, or null when the field is live.
 * Seasonal mirrors resolve to their base field, so they inherit the flag.
 */
export function comingSoonNote(field: ConfigField): string | null {
  if (!field.comingSoon) return null;
  return typeof field.comingSoon === "string" ? field.comingSoon : COMING_SOON_GENERIC_NOTE;
}

export const CONFIG_CATEGORIES: { id: ConfigCategory; label: string }[] = [
  { id: "channels", label: "Channels" },
  { id: "drops", label: "Drop notifications" },
  { id: "deaths", label: "Deaths" },
  { id: "levels", label: "Level notifications" },
  { id: "pbs", label: "Personal best" },
  { id: "cas", label: "Combat achievements" },
  { id: "board", label: "Lootboard" },
  { id: "recaps", label: "Monthly recaps" },
  { id: "clan_log", label: "Clan Log" },
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
  { key: "channel_id_to_post_diaries", label: "Diaries channel", category: "channels", type: "channel", help: "Channel for achievement-diary notifications. Falls back to the drops channel when unset.", default: null },
  { key: "announcements_channel_id", label: "Announcements channel", category: "channels", type: "channel", help: "Channel where published announcements are syndicated (FRONTEND_PLAN.md §10).", default: null },
  { key: "activity_launch_channel", label: "Activity launcher channel", category: "channels", type: "channel", help: "Post an “Open DropTracker” card in this channel with a button that opens the in-Discord app. The bot keeps one card here and moves or removes it when you change this.", default: null },

  // --- Drop notifications -------------------------------------------------
  // Defaults must match the backend processors' runtime fallbacks
  // (data/submissions/drop.py) so the editor never shows one behavior while
  // the bot does another.
  { key: "minimum_value_to_notify", label: "Minimum value to notify", category: "drops", type: "int", help: "Suppress drop notifications below this GP value.", default: 2500000, min: 0, unit: "gp" },
  { key: "only_include_items_over_minimum", label: "Only items over minimum", category: "drops", type: "boolean", help: "On stacked/multi-item drops, only include items above the minimum value.", default: false, seasonalMirror: true },
  { key: "only_send_messages_with_images", label: "Only send with images", category: "drops", type: "boolean", help: "Require a screenshot before posting a drop.", default: false, seasonalMirror: true },
  { key: "send_stacks_of_items", label: "Announce item stacks", category: "drops", type: "boolean", help: "Announce drops of stackable items (e.g. rune/coin stacks) when their total value passes the minimum.", default: false, seasonalMirror: true },
  { key: "notify_clogs", label: "Notify collection logs", category: "drops", type: "boolean", help: "Post a notification on new collection-log slots.", default: true, seasonalMirror: true },
  { key: "notify_cas", label: "Notify combat achievements", category: "drops", type: "boolean", help: "Post a notification on combat-achievement completions.", default: true, seasonalMirror: true },
  { key: "notify_pets", label: "Notify pets", category: "drops", type: "boolean", help: "Post a notification on pet drops.", default: true, seasonalMirror: true },
  { key: "notify_quests", label: "Notify quests", category: "drops", type: "boolean", help: "Post a notification on quest completions.", default: false, seasonalMirror: true },
  { key: "notify_special_quests", label: "Notify special quests", category: "drops", type: "boolean", help: "Notify on milestone/special quests even when general quest notifications are off.", default: true, seasonalMirror: true },
  { key: "notify_diaries", label: "Notify achievement diaries", category: "drops", type: "boolean", help: "Post a notification on achievement-diary completions.", default: false, seasonalMirror: true },

  // --- Deaths ---------------------------------------------------------------
  // Death notifications get their own section: toggle, channel and the custom
  // message variants (suggestion: randomized clan-broadcast-style death lines).
  // death_message_variants is a JSON string array; it lives in LONG_VALUE_KEYS
  // on the backend so lists past 255 chars spill into long_value.
  { key: "notify_deaths", label: "Notify deaths", category: "deaths", type: "boolean", help: "Post a notification when a member dies.", default: false, seasonalMirror: true },
  { key: "channel_id_to_post_deaths", label: "Deaths channel", category: "deaths", type: "channel", help: "Channel for player-death notifications. Falls back to the drops channel when unset.", default: null },
  { key: "death_message_variants", label: "Death messages", category: "deaths", type: "messagelist", help: "Custom death messages, one picked at random per death — like the in-game clan broadcasts. Placeholders like {player_name} and {source} are filled in. Leave empty for the default message. Groups using a Components layout for deaths keep their layout; these messages don't apply there.", default: "" },
  { key: "death_message_as_embed_description", label: "Show message inside the embed", category: "deaths", type: "boolean", help: "On: the picked message replaces the embed description (including a custom embed's). Off: it's sent as the plain message text above the embed.", default: false },

  // --- Level notifications ------------------------------------------------
  { key: "notify_levels", label: "Notify levels", category: "levels", type: "boolean", help: "Master toggle for level-up, total-level milestone, and post-99 XP milestone notifications.", default: false, seasonalMirror: true },
  { key: "level_minimum_for_notifications", label: "Minimum level", category: "levels", type: "int", help: "Only notify for skill levels at or above this value. Set to 99 (with the toggles below off) to only announce 99s.", default: 1, min: 1, max: 99 },
  { key: "level_increment", label: "Level increment", category: "levels", type: "int", help: "Notify every N skill levels (1 = every level). Level 99 always notifies. In a multi-level jump, every crossed level is checked.", default: 1, min: 1, max: 99 },
  { key: "notify_virtual_levels", label: "Virtual levels (100+)", category: "levels", type: "boolean", help: "Also notify for virtual level-ups above 99 (levels 100–126). Off = level 99 is the final level-up notification for a skill.", default: false },
  { key: "notify_combat_levels", label: "Combat level-ups", category: "levels", type: "boolean", help: "Notify when a member's combat level increases. Combat levels ignore the minimum/increment filters above.", default: false },
  { key: "level_milestones", label: "Total level milestones", category: "levels", type: "csv", help: "Comma-separated TOTAL levels that always notify (e.g. 1500,2000,2277).", default: "" },
  { key: "post99_xp_interval", label: "Post-99 XP interval", category: "levels", type: "int", help: "After a skill reaches 99, notify every N XP (e.g. 25m = every 25M). Multiples of 1M; 0 disables.", default: 25000000, min: 0, unit: "xp" },

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

  // --- Achievement diaries -------------------------------------------------
  {
    key: "min_diary_tier_to_notify",
    label: "Minimum diary tier",
    category: "drops",
    type: "select",
    help: "Lowest achievement-diary tier that triggers a notification.",
    default: "EASY",
    options: ["EASY", "MEDIUM", "HARD", "ELITE"].map((t) => ({
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
  // Not a setting of its own — this is the group's actual name (backend column
  // `groups.group_name`, VARCHAR(30)). Saving it renames the group everywhere:
  // profile, leaderboards, search, Discord embeds, pretty URL.
  { key: "group_name", label: "Group name", category: "integration", type: "string", help: "Display name of the group. Renaming updates it everywhere — group page, leaderboards, search and Discord messages.", default: "", maxLength: 30 },
  { key: "group_description", label: "Description", category: "integration", type: "text", help: "Short description shown on the public group page.", default: "" },
  { key: "clan_chat_name", label: "Clan chat name", category: "integration", type: "string", help: "Your in-game clan chat channel name, exactly as it appears in game. Required for clan broadcast tracking: relayed broadcasts only bind to this group when the relayer's clan matches this name.", default: "" },
  // Clan broadcast tracking and the chat bridge both depend on the plugin
  // relaying in-game chat. That shipped in plugin v6.0, published on the Plugin
  // Hub 2026-08-24, so the `comingSoon` flags these five keys carried are gone.
  // Members still need to be on v6.0 and to switch the relay on themselves.
  { key: "clan_broadcast_tracking", label: "Clan broadcast tracking", category: "integration", type: "boolean", help: "Track drops, pets and collection log slots for members who don't run the plugin, parsed from in-game clan broadcast messages relayed by clanmates who do. Requires the clan chat name to be set. Chat-tracked entries are unverified, carry no screenshots, and never count toward events, points or splits.", default: false },
  { key: "clan_broadcast_min_value", label: "Clan broadcast minimum value", category: "integration", type: "int", help: "Extra GP floor for chat-relayed drops: broadcasts below this are not recorded for this group at all. 0 records everything the clan's in-game broadcast threshold lets through.", default: 0, min: 0, unit: "gp" },
  { key: "clan_broadcast_notify_without_images", label: "Notify clan broadcasts without screenshots", category: "integration", type: "boolean", help: "Relayed clan broadcasts never carry a screenshot, so leave this on if you use \"Only send messages with images\" — otherwise chat-tracked drops, personal bests, pets and collection log slots are recorded but never announced. Turn it off to keep those announcements out of your channels entirely.", default: true },
  { key: "clan_chat_bridge_enabled", label: "Clan chat bridge", category: "integration", type: "boolean", help: "Two-way sync between your in-game clan chat and the bridge channel: game chat is mirrored into the channel, and channel messages appear in game for members running the plugin with the bridge enabled. Requires the clan chat name and a bridge channel.", default: false },
  { key: "channel_id_clan_chat_bridge", label: "Clan chat bridge channel", category: "integration", type: "channel", help: "The Discord channel your in-game clan chat is mirrored to, and whose messages are relayed into the game. Anyone who can type in this channel can speak to the clan — restrict it accordingly.", default: null },
  { key: "discord_url", label: "Discord invite URL", category: "integration", type: "string", help: "Public Discord invite shown on the group page.", default: "" },
  { key: "auto_provision_members", label: "Auto-add WiseOldMan members", category: "integration", type: "boolean", help: "Creates DropTracker profiles ahead of time for everyone in this group's linked WiseOldMan group, so members join this group automatically the moment they install the plugin — instead of waiting up to an hour for the next member sync.", default: false },
  { key: "export_api_key", label: "Export API key", category: "integration", type: "string", help: "Per-group key used for on-demand WOM sync. Treat as a secret.", default: null },
  { key: "event_wom_reconciliation", label: "Event WiseOldMan tracking", category: "integration", type: "boolean", help: "During events, top up XP and boss KC task progress from WiseOldMan hiscores so members without the plugin still count. Never double-counts progress the plugin already tracked.", default: true },
  { key: "wom_verification_code", label: "WiseOldMan verification code", category: "integration", type: "password", help: "Your WiseOldMan group's verification code. Optional — lets DropTracker queue a group-wide WOM update when events start and end, keeping hiscores-based event progress fresh. Treat as a secret.", default: null },

  { key: "recaps_enabled", label: "Post monthly recaps", category: "recaps", type: "boolean", help: "Post your clan's recap card on the 1st of each month, covering the month just ended. Every clan receives one card to begin with; turn this on to keep receiving them, or off to stop.", default: false },
  { key: "channel_id_to_post_recaps", label: "Recap channel", category: "recaps", type: "channel", help: "Where the monthly recap card is posted. Leave empty to use your lootboard channel.", default: null },
  { key: "recap_post_hour", label: "Post at (hour)", category: "recaps", type: "int", help: "Hour of the 1st, in the timezone below, to post the card. Defaults to 12 (midday) — the month closes at 00:00 UTC, which is the middle of the night for most people. A card can't exist before that close, so clans far enough ahead of UTC receive theirs at the first moment after it.", default: 12, min: 0, max: 23 },
  { key: "recap_timezone", label: "Timezone", category: "recaps", type: "string", help: "IANA timezone name, e.g. Europe/London. Set automatically from your browser the first time an admin opens this page; empty means UTC.", default: null },

  { key: "clan_log_enabled", label: "Post a live Clan Log board", category: "clan_log", type: "boolean", help: "Keep a standing message in your Discord showing how far through every boss's uniques your clan is, edited automatically as members pull things. Your board is always on the website and available through /clan-log — this is only the Discord message.", default: false },
  { key: "clan_log_channel_id", label: "Clan Log channel", category: "clan_log", type: "channel", help: "Where the standing Clan Log message lives. Pick a channel of its own: the bot edits this message continuously, so it will bury conversation in a busy channel.", default: null },
  { key: "clan_log_message_id", label: "Clan Log message id", category: "clan_log", type: "string", help: "Message the bot edits when updating the board. Managed automatically.", default: null },
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

// Limits for `messagelist` fields, shared by the editor widget and the Zod
// schema below; the backend registry's coerce_to_storage enforces the same.
export const MESSAGE_LIST_MAX_ENTRIES = 30;
export const MESSAGE_LIST_MAX_ENTRY_LENGTH = 200;
export const MESSAGE_LIST_MAX_RAW_LENGTH = 8000;
// Message content pings for real (embed text doesn't), so mention syntax is
// rejected outright rather than relying on the placement checkbox's state.
export const MESSAGE_LIST_MENTION_RE = /@everyone|@here|<@[&!]?\d+>/;

/**
 * Validation errors for a `messagelist` raw value, or null when valid.
 * "" (unset) is valid; otherwise the value must be a JSON array of
 * non-blank strings within the entry count/length limits, with no
 * Discord mention syntax.
 */
export function messageListIssue(raw: string): string | null {
  if (raw === "") return null;
  if (raw.length > MESSAGE_LIST_MAX_RAW_LENGTH) return "Message list is too large.";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "Message list must be a JSON array of strings.";
  }
  if (!Array.isArray(parsed) || parsed.some((e) => typeof e !== "string")) {
    return "Message list must be a JSON array of strings.";
  }
  if (parsed.length > MESSAGE_LIST_MAX_ENTRIES) {
    return `At most ${MESSAGE_LIST_MAX_ENTRIES} messages.`;
  }
  for (const entry of parsed as string[]) {
    if (entry.trim().length === 0) return "Messages can't be blank.";
    if (entry.length > MESSAGE_LIST_MAX_ENTRY_LENGTH) {
      return `Each message must be at most ${MESSAGE_LIST_MAX_ENTRY_LENGTH} characters.`;
    }
    if (MESSAGE_LIST_MENTION_RE.test(entry)) {
      return "Messages can't contain @everyone, @here or Discord mentions.";
    }
  }
  return null;
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
    case "boardstyle": {
      // A declared maxLength means "trimmed, bounded string" — matches the
      // backend registry's coerce_to_storage.
      if (f.maxLength != null) return z.string().trim().max(f.maxLength);
      return z.string();
    }
    case "messagelist":
      return z.string().max(MESSAGE_LIST_MAX_RAW_LENGTH).superRefine((raw, ctx) => {
        const issue = messageListIssue(raw);
        if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue });
      });
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
