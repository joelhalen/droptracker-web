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
  | "profile"
  | "channels"
  | "drops"
  | "achievements"
  | "deaths"
  | "pvp"
  | "levels"
  | "milestones"
  | "pbs"
  | "board"
  | "recaps"
  | "clan_log"
  | "bank"
  | "clan_chat"
  | "voice"
  | "integration";

export type ConfigFieldType =
  | "channel" // Discord channel id (stored as string)
  | "role" // Discord role id (stored as string), picked from the group's guild roles
  | "boolean"
  | "int"
  | "string"
  | "password" // string stored as-is; rendered as a masked input with a reveal toggle
  | "text" // multi-line
  | "csv" // comma-separated list
  | "bosslist" // comma-separated boss names, picked from GET /groups/{id}/pb-bosses
  | "boardstyle" // lootboards-table row id, picked from GET /lootboard-styles
  | "select"
  | "multiselect" // comma-separated `options` values, in option order ("" = none chosen)
  | "messagelist" // JSON array of message templates ("" = unset), edited via a list widget
  | "petlist"; // JSON array of canonical pet names ("" = none), picked from the events pet catalog

export interface ConfigField {
  key: string;
  label: string;
  category: ConfigCategory;
  type: ConfigFieldType;
  help: string;
  default: string | number | boolean | null;
  /** For `select` and `multiselect` fields. */
  options?: { value: string; label: string }[];
  /**
   * For `channel` fields: which kind of channel this setting wants. Defaults
   * to "sendable" (text channels and threads — somewhere the bot can post).
   * "voice" is for the `vc_to_display_*` stat displays, which rename a voice
   * channel every 10 minutes rather than write to it. Presentational only:
   * every channel field still stores a plain channel id.
   */
  channelKind?: "sendable" | "voice";
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
  /**
   * For string fields holding a *name template* — today the two
   * `vc_to_display_*_text` counters, whose value the bot writes into a voice
   * channel's name every 10 minutes. Lists the tokens the backend substitutes,
   * each with a sample so the editor can show the rendered result live.
   *
   * `required: true` marks the token carrying the number the setting exists to
   * display. A template that omits it renders as a static label that the bot
   * then rewrites identically forever — indistinguishable from a dead updater
   * from the outside, which is exactly how it was reported (group 30). The
   * backend appends the value in that case rather than dropping it; the editor
   * says so, so nobody has to discover it by waiting ten minutes.
   */
  templateTokens?: { token: string; sample: string; required?: boolean }[];
  /** For text-ish fields: character cap, enforced on the input and in Zod. */
  maxLength?: number;
  /** Whether a `seasonal_`-prefixed mirror of this key exists (§11.1). */
  seasonalMirror?: boolean;
  /** Subscription entitlement required to edit this field (Task 15). */
  entitlement?: string;
  /**
   * Written by the bot itself: the id of a standing message it edits in place.
   * Never rendered by the editor and never accepted in a save
   * (GroupConfigPatchSchema drops it, and the backend refuses it). Admins
   * who pasted an id here pointed the bot at a message it couldn't edit, and
   * their board stopped updating. The settings page offers Re-post board
   * instead (POST /groups/{id}/boards/{board}/repost).
   */
  managed?: boolean;
  /**
   * Sub-heading the settings page groups this field under, within its
   * category ("Hall of Fame", "Chat bridge"). Presentational only: the web
   * editor renders one block per group in registry order, and a block whose
   * first field is a toggle leads with its toggles. Ungrouped fields form the
   * category's opening block, so declare them before any grouped field. The
   * backend registry mirrors label/category/help, not this.
   */
  group?: string;
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
  { id: "profile", label: "Group profile" },
  { id: "channels", label: "Discord channels" },
  { id: "drops", label: "Drop notifications" },
  { id: "achievements", label: "Achievement notifications" },
  { id: "deaths", label: "Deaths" },
  { id: "pvp", label: "PvP" },
  { id: "levels", label: "Level notifications" },
  { id: "milestones", label: "Milestones" },
  { id: "pbs", label: "Personal bests & Hall of Fame" },
  { id: "board", label: "Lootboard" },
  { id: "recaps", label: "Monthly recaps" },
  { id: "clan_log", label: "Clan Log" },
  { id: "bank", label: "Clan bank" },
  { id: "clan_chat", label: "Clan chat" },
  { id: "voice", label: "Voice channel counters" },
  { id: "integration", label: "WiseOldMan & API" },
];

/**
 * Slayer masters by the game's SLAYER_MASTER id, each with the alternates who
 * stand in for them. Mirrors the backend's `utils/slayer_masters.py`
 * (`SLAYER_MASTERS`, `SlayerMaster.label`); tests/unit/test_group_config_registry.py
 * there holds the two lists together.
 */
export const SLAYER_MASTER_OPTIONS: { value: string; label: string }[] = [
  { value: "1", label: "Turael / Aya" },
  { value: "2", label: "Mazchna / Achtryn" },
  { value: "3", label: "Vannaka" },
  { value: "4", label: "Chaeldar" },
  { value: "5", label: "Duradel / Kuradal" },
  { value: "6", label: "Nieve / Steve" },
  { value: "7", label: "Krystilia" },
  { value: "8", label: "Konar" },
  { value: "9", label: "Spria" },
  { value: "10", label: "Mortimer" },
];

export const GROUP_CONFIG_FIELDS: ConfigField[] = [
  // --- Group profile ------------------------------------------------------
  // `group_name` is not a setting of its own — it is the group's actual name
  // (backend column `groups.group_name`, VARCHAR(30)). Saving it renames the
  // group everywhere: profile, leaderboards, search, Discord embeds, pretty URL.
  { key: "group_name", label: "Group name", category: "profile", type: "string", help: "Display name of the group. Renaming updates it everywhere — group page, leaderboards, search and Discord messages.", default: "", maxLength: 30 },
  { key: "group_description", label: "Description", category: "profile", type: "text", help: "Short description shown on the public group page.", default: "" },
  { key: "discord_url", label: "Discord invite URL", category: "profile", type: "string", help: "Public Discord invite shown on the group page.", default: "" },

  // --- Discord channels ---------------------------------------------------
  // Notification routing reads the channel_id_to_post_* keys (backend
  // services/notification_service.py). Earlier *_channel_id names were dead
  // keys nothing consumed; backend migration web20a moved saved values over.
  // Channels that belong to one feature (deaths, Hall of Fame, recaps, Clan
  // Log, lootboard, manual review, the chat bridge) live in that feature's
  // category instead, so a feature is configured in one place.
  { key: "channel_id_to_post_loot", label: "Drops channel", category: "channels", type: "channel", help: "Channel where drop notifications are posted.", default: null },
  { key: "channel_id_to_post_levels", label: "Levels channel", category: "channels", type: "channel", help: "Channel for level-up notifications. Falls back to the drops channel when unset.", default: null },
  { key: "channel_id_to_post_pb", label: "Personal best channel", category: "channels", type: "channel", help: "Channel for personal-best notifications. Falls back to the drops channel when unset.", default: null },
  { key: "channel_id_to_post_ca", label: "Combat achievements channel", category: "channels", type: "channel", help: "Channel for combat-achievement notifications. Falls back to the drops channel when unset.", default: null },
  { key: "channel_id_to_post_pets", label: "Pets channel", category: "channels", type: "channel", help: "Channel for pet notifications. Falls back to the drops channel when unset.", default: null },
  { key: "channel_id_to_post_quests", label: "Quests channel", category: "channels", type: "channel", help: "Channel for quest-completion notifications. Falls back to the drops channel when unset.", default: null },
  { key: "channel_id_to_post_clog", label: "Collection log channel", category: "channels", type: "channel", help: "Channel for collection-log notifications. Falls back to the drops channel when unset.", default: null },
  { key: "channel_id_to_post_diaries", label: "Diaries channel", category: "channels", type: "channel", help: "Channel for achievement-diary notifications. Falls back to the drops channel when unset.", default: null },
  { key: "channel_id_to_post_kc", label: "KC milestones channel", category: "channels", type: "channel", help: "Channel for kill-count milestone notifications. Falls back to the drops channel when unset.", default: null },
  { key: "channel_id_to_post_ranks", label: "Rank milestones channel", category: "channels", type: "channel", help: "Channel for hiscores-rank milestone notifications. Falls back to the drops channel when unset.", default: null },
  { key: "announcements_channel_id", label: "Announcements channel", category: "channels", group: "Other channels", type: "channel", help: "Channel where published announcements are syndicated (FRONTEND_PLAN.md §10).", default: null },
  { key: "activity_launch_channel", label: "Activity launcher channel", category: "channels", group: "Other channels", type: "channel", help: "Post an “Open DropTracker” card in this channel with a button that opens the in-Discord app. The bot keeps one card here and moves or removes it when you change this.", default: null },
  { key: "channel_id_to_send_logs", label: "Member log channel", category: "channels", group: "Other channels", type: "channel", help: "Channel where member join/leave log messages are posted. Leave unset to disable.", default: null },
  // Submit button (suggestion #198): members send an entry from a button
  // instead of remembering /submit — on the launcher card, its own card, or both.
  { key: "submit_on_launch_card", label: "Submit button on the launcher card", category: "channels", group: "Submit button", type: "boolean", help: "Add a Submit button to the Open DropTracker card, so members can send a drop, PB or other entry without a slash command.", default: false },
  { key: "submit_panel_channel", label: "Submit card channel", category: "channels", group: "Submit button", type: "channel", help: "Post a card with a Submit button in this channel. The bot keeps one card here and moves or removes it when you change this.", default: null },
  { key: "submit_panel_message", label: "Submit card message", category: "channels", group: "Submit button", type: "string", help: "Optional. The text on the Submit card. Leave blank for the default.", default: "", maxLength: 250 },

  // --- Drop notifications -------------------------------------------------
  // Defaults must match the backend processors' runtime fallbacks
  // (data/submissions/drop.py) so the editor never shows one behavior while
  // the bot does another.
  { key: "minimum_value_to_notify", label: "Minimum value to notify", category: "drops", type: "int", help: "Suppress drop notifications below this GP value.", default: 2500000, min: 0, unit: "gp" },
  { key: "only_send_messages_with_images", label: "Only send with images", category: "drops", type: "boolean", help: "Require a screenshot before posting a drop.", default: false, seasonalMirror: true },
  { key: "send_stacks_of_items", label: "Announce item stacks", category: "drops", type: "boolean", help: "Announce drops of stackable items (e.g. rune/coin stacks) when their total value passes the minimum.", default: false, seasonalMirror: true },

  // Split tracking: GP splits only. Point splitting is a separate setting
  // managed on the Points page (`point_sharing` / `point_sharing_method`).
  { key: "split_gp_tracking", label: "Split GP tracking", category: "drops", type: "boolean", help: "Track raid loot splits: members receive their share of a split drop's GP value instead of the receiver keeping the full amount. Point splitting is configured separately on the Points tab.", default: false },

  // Announce anything that awarded group points but wouldn't have been
  // announced by the group's other settings. Opt-in (default OFF): the default
  // point template awards for every clog/PB/CA, so a default-ON override
  // silently discarded the notify_* toggles of every paid group (2026-09-01).
  // Inert for groups without the point system. Not seasonal-mirrored: group
  // points are main-world only.
  { key: "notify_points_awarded", label: "Announce point awards", category: "drops", type: "boolean", help: "When your point system awards points for a submission that wouldn't be announced on its own — a drop below the minimum value, a notification type you've turned off, or a combat achievement below your tier minimum — announce it anyway. Off by default; with the default point rules this posts every collection log, personal best and combat achievement. Screenshot requirements still apply.", default: false },

  // Manual submissions (suggestion #45): the policy and its review channel.
  {
    key: "manual_submission_policy",
    label: "Manual submissions",
    category: "drops",
    group: "Manual submissions",
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
    category: "drops",
    group: "Manual submissions",
    type: "channel",
    help: "Optional. Where to ping when a manual submission is held for approval (the \"Hold for admin approval\" policy). Leave unset to review only on the website.",
    default: null,
  },
  {
    key: "review_role_id",
    label: "Review staff role",
    category: "drops",
    group: "Manual submissions",
    type: "role",
    help: "Members with this Discord role can approve or reject submissions with the buttons on review messages. Group admins always can.",
    default: null,
  },

  // --- Achievement notifications ------------------------------------------
  // Everything a member unlocks rather than loots. Same runtime-fallback rule
  // as the drop toggles above.
  { key: "notify_clogs", label: "Notify collection logs", category: "achievements", group: "Collection log & pets", type: "boolean", help: "Post a notification on new collection-log slots.", default: true, seasonalMirror: true },
  { key: "notify_pets", label: "Notify pets", category: "achievements", group: "Collection log & pets", type: "boolean", help: "Post a notification on pet drops.", default: true, seasonalMirror: true },
  // Which duplicate pets are announced (backend utils/pet_notifications.py).
  // No stored row = "all", what every group did before this existed.
  {
    key: "notify_pet_duplicates",
    label: "Duplicate pets",
    category: "achievements",
    group: "Collection log & pets",
    type: "select",
    help: "Whether a pet the member already has is announced: every duplicate, none, or only the pets you choose.",
    default: "all",
    options: [
      { value: "all", label: "Every duplicate" },
      { value: "none", label: "Never" },
      { value: "selected", label: "Only pets I choose" },
    ],
    seasonalMirror: true,
  },
  { key: "notify_pet_duplicate_pets", label: "Announce duplicates of", category: "achievements", group: "Collection log & pets", type: "petlist", help: "The pets whose duplicates are announced when Duplicate pets is set to Only pets I choose.", default: "", seasonalMirror: true },
  { key: "notify_cas", label: "Notify combat achievements", category: "achievements", group: "Combat achievements", type: "boolean", help: "Post a notification on combat-achievement completions.", default: true, seasonalMirror: true },
  {
    key: "min_ca_tier_to_notify",
    label: "Minimum CA tier",
    category: "achievements",
    group: "Combat achievements",
    type: "select",
    help: "Lowest combat-achievement tier that triggers a notification.",
    default: "EASY",
    options: ["EASY", "MEDIUM", "HARD", "ELITE", "MASTER", "GRANDMASTER"].map((t) => ({
      value: t,
      label: t.charAt(0) + t.slice(1).toLowerCase(),
    })),
    seasonalMirror: true,
  },
  { key: "notify_quests", label: "Notify quests", category: "achievements", group: "Quests & diaries", type: "boolean", help: "Post a notification on quest completions.", default: false, seasonalMirror: true },
  { key: "notify_special_quests", label: "Notify special quests", category: "achievements", group: "Quests & diaries", type: "boolean", help: "Notify on milestone/special quests even when general quest notifications are off.", default: true, seasonalMirror: true },
  { key: "notify_diaries", label: "Notify achievement diaries", category: "achievements", group: "Quests & diaries", type: "boolean", help: "Post a notification on achievement-diary completions.", default: false, seasonalMirror: true },
  {
    key: "min_diary_tier_to_notify",
    label: "Minimum diary tier",
    category: "achievements",
    group: "Quests & diaries",
    type: "select",
    help: "Lowest achievement-diary tier that triggers a notification.",
    default: "EASY",
    options: ["EASY", "MEDIUM", "HARD", "ELITE"].map((t) => ({
      value: t,
      label: t.charAt(0) + t.slice(1).toLowerCase(),
    })),
    seasonalMirror: true,
  },
  // Slayer tasks: completions come from plugin 6.0.6+ and are recorded
  // whatever these say; they only decide what is announced. No stored
  // slayer_excluded_masters row means its default (Turael and Spria, the
  // backend's DEFAULT_EXCLUDED_MASTER_IDS); a saved "" means skip nobody.
  { key: "notify_slayer_tasks", label: "Notify slayer tasks", category: "achievements", group: "Slayer tasks", type: "boolean", help: "Post a notification when a member completes a slayer task.", default: false, seasonalMirror: true },
  {
    key: "slayer_excluded_masters",
    label: "Skip tasks from",
    category: "achievements",
    group: "Slayer tasks",
    type: "multiselect",
    help: "Tasks from these masters are not announced. By default that's Turael and Spria, whose tasks give no points and are mostly used to skip tasks from other masters.",
    default: "1,9",
    options: SLAYER_MASTER_OPTIONS,
  },
  { key: "channel_id_to_post_slayer", label: "Slayer channel", category: "achievements", group: "Slayer tasks", type: "channel", help: "Channel for slayer task notifications. Falls back to the drops channel when unset.", default: null },

  // --- Deaths ---------------------------------------------------------------
  // Death notifications get their own section: toggle, channel and the custom
  // message variants (suggestion: randomized clan-broadcast-style death lines).
  // death_message_variants is a JSON string array; it lives in LONG_VALUE_KEYS
  // on the backend so lists past 255 chars spill into long_value.
  { key: "notify_deaths", label: "Notify deaths", category: "deaths", type: "boolean", help: "Post a notification when a member dies.", default: false, seasonalMirror: true },
  { key: "notify_deaths_safe", label: "Notify safe deaths", category: "deaths", type: "boolean", help: "Also announce deaths that cost nothing: raid and Gauntlet wipes, Castle Wars, Soul Wars, Barbarian Assault, Nightmare Zone, your own house. Off by default so the deaths channel shows the ones that hurt, which also hides raid and Gauntlet wipes. Last Man Standing and the PK tutor have their own switches below. Inferno and Fight Caves always count as real deaths; mute those by blacklisting the region instead.", default: false, seasonalMirror: true },
  // Per-activity switches (backend db/death_filter.py), matched by region and
  // checked before the safe-death rule, so each is decided by itself alone.
  { key: "notify_deaths_lms", label: "Notify Last Man Standing deaths", category: "deaths", type: "boolean", help: "Announce deaths in Last Man Standing. Decided by this switch alone, so you can keep safe deaths on for raids and still leave LMS out.", default: false, seasonalMirror: true },
  { key: "notify_deaths_pk_tutor", label: "Notify PK tutor deaths", category: "deaths", type: "boolean", help: "Announce deaths at Pete Kayer's PK tutor. Members practising there can die dozens of times an hour, so this is off by default.", default: false, seasonalMirror: true },
  { key: "channel_id_to_post_deaths", label: "Deaths channel", category: "deaths", type: "channel", help: "Channel for player-death notifications. Falls back to the drops channel when unset.", default: null },
  { key: "death_message_variants", label: "Death messages", category: "deaths", group: "Death messages", type: "messagelist", help: "Custom death messages, one picked at random per death — like the in-game clan broadcasts. Placeholders like {player_name}, {source}, {region_name} and {value_lost} are filled in. A message is skipped for a death that leaves one of its placeholders blank — no known killer, say, or no {value_lost} from a plugin older than 6.0.4. Leave empty for the default message. In a custom embed or a Components layout, put the picked message wherever you like with {death_message}.", default: "" },
  { key: "death_message_as_embed_description", label: "Show message inside the embed", category: "deaths", group: "Death messages", type: "boolean", help: "On: the picked message replaces the embed description (including a custom embed's). Off: it's sent as the plain message text above the embed.", default: false },
  // Members' own death messages (backend db/member_messages.py). Off by default:
  // it hands every member a line in the group's channel, which is the group's call.
  { key: "allow_member_death_messages", label: "Let members write their own death message", category: "deaths", group: "Death messages", type: "boolean", help: "Members set their own message on the website, with /settings in Discord, or in the RuneLite plugin. A member's message is posted instead of your death messages, and members without one get yours. It appears wherever your messages do. Review what members wrote, and block anyone, in Members' death messages below.", default: false },

  // --- Level notifications ------------------------------------------------
  { key: "notify_levels", label: "Notify levels", category: "levels", type: "boolean", help: "Master toggle for level-up, total-level milestone, and post-99 XP milestone notifications.", default: false, seasonalMirror: true },
  { key: "level_minimum_for_notifications", label: "Minimum level", category: "levels", group: "Skill level-ups", type: "int", help: "Only notify for skill levels at or above this value. Set to 99 (with the toggles below off) to only announce 99s.", default: 1, min: 1, max: 99 },
  { key: "level_increment", label: "Level increment", category: "levels", group: "Skill level-ups", type: "int", help: "Notify every N skill levels (1 = every level). Level 99 always notifies. In a multi-level jump, every crossed level is checked.", default: 1, min: 1, max: 99 },
  { key: "notify_virtual_levels", label: "Virtual levels (100+)", category: "levels", group: "Skill level-ups", type: "boolean", help: "Also notify for virtual level-ups above 99 (levels 100–126). Off = level 99 is the final level-up notification for a skill.", default: false },
  { key: "notify_combat_levels", label: "Combat level-ups", category: "levels", group: "Skill level-ups", type: "boolean", help: "Notify when a member's combat level increases. Combat levels ignore the minimum/increment filters above.", default: false },
  { key: "level_milestones", label: "Total level milestones", category: "levels", group: "Total level & XP milestones", type: "csv", help: "Comma-separated TOTAL levels that always notify (e.g. 1500,2000,2277).", default: "" },
  { key: "post99_xp_interval", label: "Post-99 XP interval", category: "levels", group: "Total level & XP milestones", type: "int", help: "After a skill reaches 99, notify every N XP (e.g. 25m = every 25M). Multiples of 1M; 0 disables.", default: 25000000, min: 0, unit: "xp" },

  // --- Milestones (KC + hiscores rank) ------------------------------------
  // KC milestones are fed from the plugin's per-kill KC reports, WOM-recognized
  // bosses only; rank milestones from the periodic WiseOldMan bulk-hiscores
  // sweep. Neither family has a seasonal mirror: drops.kill_count is main-world
  // only and WOM mirrors the main-game hiscores.
  { key: "notify_kc_milestones", label: "Notify KC milestones", category: "milestones", group: "Kill count", type: "boolean", help: "Master toggle for boss kill-count milestone notifications (first kill and every-Nth-kill).", default: false },
  { key: "notify_first_kc", label: "Announce first kills", category: "milestones", group: "Kill count", type: "boolean", help: "Announce a member's first kill of a boss. Only applies while KC milestones are enabled.", default: true },
  { key: "kc_milestone_interval", label: "KC milestone interval", category: "milestones", group: "Kill count", type: "int", help: "Announce every Nth kill of a boss (e.g. 100 or 1000). 0 disables interval announcements (first kills can still announce).", default: 100, min: 0, max: 50000 },
  { key: "notify_rank_milestones", label: "Notify rank milestones", category: "milestones", group: "Hiscores rank", type: "boolean", help: "Announce when a member's hiscores rank enters a configured threshold (e.g. top 10,000) on a boss, skill or clue tier. Checked periodically via WiseOldMan.", default: false },
  { key: "rank_milestone_thresholds", label: "Rank thresholds", category: "milestones", group: "Hiscores rank", type: "csv", help: "Comma-separated rank thresholds to announce on entering (e.g. 10000,5000,1000). Only the deepest newly-entered threshold announces.", default: "10000,5000,1000" },
  { key: "rank_milestone_bosses", label: "Boss ranks", category: "milestones", group: "Hiscores rank", type: "boolean", help: "Include boss kill-count ranks in rank milestone checks.", default: true },
  { key: "rank_milestone_skills", label: "Skill ranks", category: "milestones", group: "Hiscores rank", type: "boolean", help: "Include skill XP ranks in rank milestone checks.", default: true },
  { key: "rank_milestone_clues", label: "Clue ranks", category: "milestones", group: "Hiscores rank", type: "boolean", help: "Include clue scroll completion ranks in rank milestone checks.", default: true },

  // --- Personal bests & Hall of Fame --------------------------------------
  // notify_pbs (PB notifications) is available to every group. The Hall of
  // Fame fields below are premium (entitlement: "hall_of_fame");
  // create_pb_embeds is the master switch the HOF bot keys off of.
  { key: "notify_pbs", label: "Notify personal bests", category: "pbs", type: "boolean", help: "Post personal-best notifications in Discord. Available to all groups.", default: true, seasonalMirror: true },
  { key: "create_pb_embeds", label: "Enable Hall of Fame", category: "pbs", group: "Hall of Fame", type: "boolean", help: "Post and keep updated the Hall of Fame personal-best leaderboards in Discord. Turn this on, then choose the bosses and channel below.", default: false, entitlement: "hall_of_fame" },
  { key: "hof_individual_boss_messages", label: "Individual Hall of Fame messages", category: "pbs", group: "Hall of Fame", type: "boolean", help: "Post one Hall of Fame message per boss. When off, only the directory message is posted and members use its drop-down to view each boss's leaderboard.", default: false, entitlement: "hall_of_fame" },
  { key: "personal_best_embed_boss_list", label: "Hall of Fame bosses", category: "pbs", group: "Hall of Fame", type: "bosslist", help: "Bosses featured in the Hall of Fame. Empty = no bosses shown.", default: "", entitlement: "hall_of_fame" },
  { key: "number_of_pbs_to_display", label: "PBs to display", category: "pbs", group: "Hall of Fame", type: "int", help: "Top PB entries shown per team-size bracket in Hall of Fame messages.", default: 5, min: 1, max: 10, entitlement: "hall_of_fame" },
  { key: "channel_id_to_send_pb_embeds", label: "Hall of Fame channel", category: "pbs", group: "Hall of Fame", type: "channel", help: "Channel where the Hall of Fame leaderboards are posted.", default: null, entitlement: "hall_of_fame" },

  // --- Lootboard ----------------------------------------------------------
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
  { key: "lootboard_channel_id", label: "Lootboard channel", category: "board", type: "channel", help: "Channel where the lootboard image is posted/updated.", default: null },
  { key: "lootboard_message_id", label: "Lootboard message id", category: "board", type: "string", help: "Message the bot edits when reposting the board. Managed automatically.", default: null, managed: true },
  { key: "only_include_items_over_minimum", label: "Hide items below minimum value", category: "board", type: "boolean", help: "When on, the lootboard only shows items worth at least your Minimum value to notify. When off, every tracked item for your members appears, and player totals on the board follow the same rule. Discord drop announcements are unchanged.", default: false, seasonalMirror: true },
  { key: "use_dynamic_colors", label: "Dynamic colors", category: "board", type: "boolean", help: "Color item tiles by relative value.", default: true },
  { key: "use_gp_colors", label: "GP colors", category: "board", type: "boolean", help: "Use GP-value color thresholds on the board.", default: true },
  { key: "repost_lootboard", label: "Repost lootboard", category: "board", type: "boolean", help: "Repost (vs. edit) the board on each update.", default: false },
  { key: "seasonal_boards", label: "Seasonal boards", category: "board", type: "boolean", help: "When enabled, automatically use themed boards for holidays/seasons when made available globally.", default: false },

  // --- Monthly recaps -----------------------------------------------------
  { key: "recaps_enabled", label: "Post monthly recaps", category: "recaps", type: "boolean", help: "Post your clan's recap card on the 1st of each month, covering the month just ended. Every clan receives one card to begin with; turn this on to keep receiving them, or off to stop.", default: false },
  { key: "channel_id_to_post_recaps", label: "Recap channel", category: "recaps", type: "channel", help: "Where the monthly recap card is posted. Leave empty to use your lootboard channel.", default: null },
  { key: "recap_post_hour", label: "Post at (hour)", category: "recaps", type: "int", help: "Hour of the 1st, in the timezone below, to post the card. Defaults to 12 (midday) — the month closes at 00:00 UTC, which is the middle of the night for most people. A card can't exist before that close, so clans far enough ahead of UTC receive theirs at the first moment after it.", default: 12, min: 0, max: 23 },
  { key: "recap_timezone", label: "Timezone", category: "recaps", type: "string", help: "IANA timezone name, e.g. Europe/London. Set automatically from your browser the first time an admin opens this page; empty means UTC.", default: null },

  // --- Clan Log -----------------------------------------------------------
  { key: "clan_log_enabled", label: "Post a live Clan Log board", category: "clan_log", type: "boolean", help: "Keep a standing message in your Discord showing how far through every boss's uniques your clan is, edited automatically as members pull things. Your board is always on the website and available through /clan-log — this is only the Discord message.", default: false },
  { key: "clan_log_channel_id", label: "Clan Log channel", category: "clan_log", type: "channel", help: "Where the standing Clan Log message lives. Pick a channel of its own: the bot edits this message continuously, so it will bury conversation in a busy channel.", default: null },
  { key: "clan_log_message_id", label: "Clan Log message id", category: "clan_log", type: "string", help: "Message the bot edits when updating the board. Managed automatically.", default: null, managed: true },

  // --- Clan bank ------------------------------------------------------------
  { key: "bank_show_on_profile", label: "Show the clan bank on your group page", category: "bank", type: "boolean", help: "Show the bank balance and totals on your public group page once you've recorded something. Turn off to keep the bank visible to admins only.", default: true },
  { key: "bank_show_donors", label: "Show donor names", category: "bank", type: "boolean", help: "List top donors and recent bank activity by name on your group page. Turn off to show only the totals.", default: true },
  // In-game coffer sync (backend web144a): relayed coffer broadcasts become
  // bank rows. Turning it on also has plugin users relay the clan's broadcasts.
  { key: "bank_coffer_sync", label: "Sync the in-game clan coffer", category: "bank", type: "boolean", help: "Record coffer deposits and withdrawals from your in-game clan broadcasts automatically. Requires the clan chat name to be set and coffer broadcasts to be shown in game. Only lines seen while a clanmate with the DropTracker plugin is online are recorded, so record anything missed by hand.", default: false },
  {
    key: "bank_coffer_status",
    label: "Synced coffer entries",
    category: "bank",
    type: "select",
    help: "Whether synced coffer entries wait in the review queue or count straight away. Review is safer: the lines are relayed by clanmates' clients, not read from Jagex directly.",
    default: "pending",
    options: [
      { value: "pending", label: "Wait for review" },
      { value: "confirmed", label: "Count straight away" },
    ],
  },

  // --- PvP ------------------------------------------------------------------
  // Player kills are tracked apart from drops (backend data/submissions/pvp.py):
  // their own standings, board and channel. Nothing posts until the PvP channel
  // is set, and it never falls back to the drops channel.
  { key: "channel_id_to_post_pvp", label: "PvP channel", category: "pvp", group: "Notifications", type: "channel", help: "Channel for PvP kills, and PvP deaths if you turn those on. Nothing is posted until you set it. PvP never uses the drops channel.", default: null },
  { key: "pvp_minimum_value_to_notify", label: "Minimum kill value to post", category: "pvp", group: "Notifications", type: "int", help: "Only post kills whose loot is worth at least this much GP. Every kill still counts on the standings and the PvP board.", default: 1000000, min: 0 },
  { key: "pvp_notify_deaths", label: "Post PvP deaths", category: "pvp", group: "Notifications", type: "boolean", help: "Also post to the PvP channel when a member is killed by another player. Deaths in LMS and other PvP minigames are left out.", default: false },
  { key: "pvp_death_minimum_value", label: "Minimum value lost to post a PvP death", category: "pvp", group: "Notifications", type: "int", help: "Only post PvP deaths that cost at least this much GP. 0 posts them all.", default: 0, min: 0 },
  { key: "pvp_count_member_kills", label: "Count kills on clanmates", category: "pvp", group: "What counts", type: "boolean", help: "Count kills where the victim is also in your group. Off by default, so members can't farm each other for the board.", default: false },
  { key: "pvp_same_victim_daily_limit", label: "Kills of one player that count per day", category: "pvp", group: "What counts", type: "int", help: "How many times a day killing the same player counts. Kills past this are still recorded but don't count or post.", default: 3, min: 1, max: 100 },
  { key: "pvp_same_victim_unlimited", label: "No daily limit on kills of one player", category: "pvp", group: "What counts", type: "boolean", help: "Count every kill of the same player, however many there are in a day.", default: false },
  { key: "pvp_lootboard_channel_id", label: "PvP lootboard channel", category: "pvp", group: "PvP lootboard", type: "channel", help: "Channel where the PvP lootboard is posted and kept up to date. It shows only loot from player kills.", default: null },
  { key: "pvp_loot_board_type", label: "PvP lootboard style", category: "pvp", group: "PvP lootboard", type: "boardstyle", help: "Visual style of the PvP lootboard.", default: "1" },
  { key: "pvp_repost_lootboard", label: "Repost PvP lootboard", category: "pvp", group: "PvP lootboard", type: "boolean", help: "Repost (vs. edit) the PvP board on each update.", default: false },
  { key: "pvp_lootboard_message_id", label: "PvP lootboard message id", category: "pvp", group: "PvP lootboard", type: "string", help: "Message the bot edits when updating the PvP board. Managed automatically.", default: null, managed: true },

  // --- Clan chat ------------------------------------------------------------
  // Clan broadcast tracking and the chat bridge both depend on the plugin
  // relaying in-game chat, and both key off the clan chat name. That shipped
  // in plugin v6.0, published on the Plugin Hub 2026-08-24, so the `comingSoon`
  // flags these keys carried are gone. Members still need to be on v6.0 and to
  // switch the relay on themselves.
  { key: "clan_chat_name", label: "Clan chat name", category: "clan_chat", type: "string", help: "Your in-game clan chat channel name, exactly as it appears in game. Required for clan broadcast tracking: relayed broadcasts only bind to this group when the relayer's clan matches this name.", default: "" },
  { key: "clan_broadcast_tracking", label: "Clan broadcast tracking", category: "clan_chat", group: "Broadcast tracking", type: "boolean", help: "Track drops, pets and collection log slots for members who don't run the plugin, parsed from in-game clan broadcast messages relayed by clanmates who do. Requires the clan chat name to be set. Chat-tracked entries are unverified, carry no screenshots, and never count toward events, points or splits.", default: false },
  { key: "clan_broadcast_notify_without_images", label: "Notify clan broadcasts without screenshots", category: "clan_chat", group: "Broadcast tracking", type: "boolean", help: "Relayed clan broadcasts never carry a screenshot, so leave this on if you use \"Only send messages with images\" — otherwise chat-tracked drops, personal bests, pets and collection log slots are recorded but never announced. Turn it off to keep those announcements out of your channels entirely.", default: true },
  { key: "clan_broadcast_min_value", label: "Clan broadcast minimum value", category: "clan_chat", group: "Broadcast tracking", type: "int", help: "Extra GP floor for chat-relayed drops: broadcasts below this are not recorded for this group at all. 0 records everything the clan's in-game broadcast threshold lets through.", default: 0, min: 0, unit: "gp" },
  { key: "clan_chat_bridge_enabled", label: "Clan chat bridge", category: "clan_chat", group: "Chat bridge", type: "boolean", help: "Two-way sync between your in-game clan chat and the bridge channel: game chat is mirrored into the channel, and channel messages appear in game for members running the plugin with the bridge enabled. Requires the clan chat name and a bridge channel.", default: false },
  { key: "channel_id_clan_chat_bridge", label: "Clan chat bridge channel", category: "clan_chat", group: "Chat bridge", type: "channel", help: "The Discord channel your in-game clan chat is mirrored to, and whose messages are relayed into the game. Anyone who can type in this channel can speak to the clan — restrict it accordingly.", default: null },
  { key: "clan_chat_relay_muted", label: "Show muted clanmates' chat", category: "clan_chat", group: "Chat bridge", type: "boolean", help: "Shows chat from clanmates the game has muted to members who use the plugin with the bridge on. A muted player's messages only appear on their own screen, so nobody else in the clan sees them. When their plugin relays a message that nobody else saw, it is shown in game to members with the plugin, with a muted icon by the name. It also appears in the bridge channel with the same icon. Only a player's own messages are relayed this way.", default: true },
  { key: "clan_chat_bridge_allowed_bots", label: "Bots allowed in the bridge", category: "clan_chat", group: "Chat bridge", type: "csv", help: "Bots or webhooks whose messages in the bridge channel also reach your clan in game. Off by default: leave this empty and bots are ignored. Enter Discord IDs separated by commas (up to 10), or use /clan-bridge allow-bot in your server, or right-click a bot's message and pick Apps, Allow in clan bridge. Anything an allowed bot posts in the bridge channel is shown to your clan.", default: "" },

  // --- Voice channel counters ---------------------------------------------
  // The bot renames these voice channels every 10 minutes; see templateTokens.
  { key: "vc_to_display_monthly_loot", label: "Monthly loot voice channel", category: "voice", group: "Monthly loot", type: "channel", channelKind: "voice", help: "Voice channel renamed every 10 minutes to show the group's monthly loot total. Nobody needs to be able to talk in it — the name is the display. Give the bot Manage Channel on it.", default: null },
  { key: "vc_to_display_monthly_loot_text", label: "Monthly loot channel text", category: "voice", group: "Monthly loot", type: "string", help: "Template for the loot voice channel name. Placeholders: {month}, {gp_amount}.", default: "{month}: {gp_amount} gp", templateTokens: [{ token: "{month}", sample: "September" }, { token: "{gp_amount}", sample: "1.2B", required: true }] },
  { key: "vc_to_display_droptracker_users", label: "Member count voice channel", category: "voice", group: "Member count", type: "channel", channelKind: "voice", help: "Voice channel renamed every 10 minutes to show the group's tracked member count. Nobody needs to be able to talk in it — the name is the display. Give the bot Manage Channel on it.", default: null },
  { key: "vc_to_display_droptracker_users_text", label: "Member count channel text", category: "voice", group: "Member count", type: "string", help: "Template for the member-count voice channel name. Placeholder: {member_count}.", default: "{member_count} members", templateTokens: [{ token: "{member_count}", sample: "345", required: true }] },

  // --- WiseOldMan & API ---------------------------------------------------
  { key: "auto_provision_members", label: "Auto-add WiseOldMan members", category: "integration", type: "boolean", help: "Creates DropTracker profiles ahead of time for everyone in this group's linked WiseOldMan group, so members join this group automatically the moment they install the plugin — instead of waiting up to an hour for the next member sync.", default: false },
  { key: "event_wom_reconciliation", label: "Event WiseOldMan tracking", category: "integration", type: "boolean", help: "During events, top up XP and boss KC task progress from WiseOldMan hiscores so members without the plugin still count. Never double-counts progress the plugin already tracked.", default: true },
  { key: "wom_verification_code", label: "WiseOldMan verification code", category: "integration", type: "password", help: "Your WiseOldMan group's verification code. Optional — lets DropTracker queue a group-wide WOM update when events start and end, keeping hiscores-based event progress fresh. Treat as a secret.", default: null },
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

/** The option values a stored `multiselect` value holds ("" = none). */
export function parseMultiselect(raw: string): string[] {
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * The stored form of a `multiselect` choice: the chosen values in option
 * order, comma-separated. Matches the backend's coerce_multiselect, so a
 * value the editor writes reads back unchanged.
 */
export function formatMultiselect(field: ConfigField, chosen: Iterable<string>): string {
  const picked = new Set(chosen);
  return (field.options ?? [])
    .map((o) => o.value)
    .filter((v) => picked.has(v))
    .join(",");
}

/**
 * Pet names from a stored `petlist` value (a JSON array; "" = none), or null
 * when it isn't one. The backend checks the names against its pet catalog.
 */
export function parsePetList(raw: string): string[] | null {
  if (raw.trim() === "") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((n) => typeof n !== "string")) return null;
    return parsed as string[];
  } catch {
    return null;
  }
}

/** The stored form of a `petlist` choice: a sorted JSON array, "" for none. */
export function formatPetList(names: Iterable<string>): string {
  const unique = [...new Set([...names].map((n) => n.trim()).filter(Boolean))].sort();
  return unique.length ? JSON.stringify(unique) : "";
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
    case "multiselect": {
      const allowed = new Set((f.options ?? []).map((o) => o.value));
      return z
        .string()
        .refine((raw) => parseMultiselect(raw).every((v) => allowed.has(v)), {
          message: "Unknown option.",
        });
    }
    case "role":
      return z.union([z.literal(""), z.string().regex(/^\d{15,21}$/, "Pick a role.")]);
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
    case "petlist":
      return z
        .string()
        .max(MESSAGE_LIST_MAX_RAW_LENGTH)
        .refine((raw) => raw === "" || parsePetList(raw) !== null, {
          message: "Must be a list of pet names.",
        });
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
    allConfigKeys()
      .filter((key) => !getConfigField(key)?.managed)
      .map((key) => {
        const field = getConfigField(key)!;
        return [key, fieldSchema(field).nullable().optional()];
      }),
  ),
);

export type GroupConfigPatch = Record<string, string | number | boolean | null | undefined>;

/** Standing boards the settings page can re-post (POST /groups/{id}/boards/{board}/repost). */
export type RepostBoard = "lootboard" | "pvp_lootboard" | "clan_log";
