/**
 * Page layouts (web137a): customizable group pages, player profiles and the
 * default profile layout a group sets for its members.
 *
 * Python twin: `disc/web_api/page_layouts_shared.py`, which validates and
 * NORMALIZES every save (unknown keys dropped, enums defaulted, ints
 * clamped). These schemas are therefore lenient readers: each block is
 * narrowed with `PageBlockSchema.safeParse` at render time and anything
 * unrecognized renders nothing, so a newer block type never breaks an older
 * build.
 */
import { z } from "zod";

export const LAYOUT_SCOPES = ["group", "member_default", "player"] as const;
export type LayoutScope = (typeof LAYOUT_SCOPES)[number];

export const BLOCK_WIDTHS = ["full", "two_thirds", "half", "third"] as const;
export type BlockWidth = (typeof BLOCK_WIDTHS)[number];

/** OSRS-styled containers a block can sit in. */
export const BLOCK_SURFACES = ["plain", "card", "stone", "window", "parchment", "scroll", "panel"] as const;
export type BlockSurface = (typeof BLOCK_SURFACES)[number];

export const HIDE_ON = ["none", "mobile", "desktop"] as const;
export const LINK_STYLES = ["outline", "solid", "osrs"] as const;
export type LinkStyle = (typeof LINK_STYLES)[number];
export const ALIGNS = ["left", "center", "right"] as const;
export type Align = (typeof ALIGNS)[number];

export const GROUP_LINK_KEYS = [
  "lootboard",
  "clan_log",
  "personal_bests",
  "pvp",
  "points",
  "recaps",
  "events",
  "discord",
] as const;
export type GroupLinkKey = (typeof GROUP_LINK_KEYS)[number];
export const PLAYER_LINK_KEYS = ["collection_log", "achievements", "recap"] as const;
export type PlayerLinkKey = (typeof PLAYER_LINK_KEYS)[number];

export const GROUP_STATS = [
  "members",
  "rank",
  "monthly_loot",
  "top_player",
  "top_boss",
  "records_held",
  "clan_log",
  "pvp_kills",
  "pvp_loot",
  "points_leader",
  "bank_balance",
  "events_running",
] as const;
export type GroupStatKey = (typeof GROUP_STATS)[number];
export const PLAYER_STATS = [
  "monthly_loot",
  "rank",
  "clan_points",
  "top_npc",
  "last_month_loot",
  "clog_slots",
  "ca_tasks",
  "quests",
  "combat_level",
  "pbs_count",
  "badges_count",
  "pvp_kills",
] as const;
export type PlayerStatKey = (typeof PLAYER_STATS)[number];
export const GROUP_STATS_DEFAULT: GroupStatKey[] = ["members", "rank", "monthly_loot", "top_player"];
export const PLAYER_STATS_DEFAULT: PlayerStatKey[] = ["monthly_loot", "rank", "clan_points", "top_npc"];
/** At most this many stats in one row (the validator caps it too). */
export const MAX_STATS = 8;
export const STAT_COLUMNS = ["auto", "2", "3", "4"] as const;
export const HIGHLIGHT_TYPES = ["drop", "pet", "clog", "pb"] as const;
export type HighlightType = (typeof HIGHLIGHT_TYPES)[number];

export const THEME_PRESETS = ["default", "dusk", "parchment", "wilderness"] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];
export const PAGE_BACKGROUNDS = ["default", "plain", "stone", "parchment", "starry"] as const;
export type PageBackground = (typeof PAGE_BACKGROUNDS)[number];
export const HEADER_STYLES = ["standard", "centered", "banner"] as const;
export type HeaderStyle = (typeof HEADER_STYLES)[number];

const base = {
  id: z.string(),
  width: z.enum(BLOCK_WIDTHS).catch("full"),
  surface: z.enum(BLOCK_SURFACES).catch("plain"),
  title: z.string().nullish(),
  hide_on: z.enum(HIDE_ON).catch("none"),
};

const limit = (d: number) => z.number().int().catch(d);
const period4 = z.enum(["month", "week", "day", "all"]).catch("month");

export const PageBlockSchema = z.discriminatedUnion("type", [
  // shared
  z.object({ ...base, type: z.literal("markdown"), body: z.string().catch(""), align: z.enum(ALIGNS).catch("left") }),
  z.object({
    ...base,
    type: z.literal("image"),
    url: z.string().nullish(),
    alt: z.string().catch(""),
    caption: z.string().catch(""),
    fit: z.enum(["cover", "contain"]).catch("cover"),
    height: z.enum(["sm", "md", "lg", "auto"]).catch("md"),
    link: z.string().nullish(),
  }),
  z.object({
    ...base,
    type: z.literal("buttons"),
    items: z.array(z.object({ label: z.string(), href: z.string() })).catch([]),
    style: z.enum(LINK_STYLES).catch("solid"),
    align: z.enum(ALIGNS).catch("left"),
  }),
  z.object({ ...base, type: z.literal("divider"), size: z.enum(["sm", "md", "lg"]).catch("md"), rule: z.boolean().catch(true) }),
  // group
  z.object({
    ...base,
    type: z.literal("group_links"),
    items: z.array(z.enum(GROUP_LINK_KEYS)).catch([...GROUP_LINK_KEYS]),
    style: z.enum(LINK_STYLES).catch("outline"),
    align: z.enum(ALIGNS).catch("left"),
  }),
  z.object({ ...base, type: z.literal("support_card") }),
  z.object({
    ...base,
    type: z.literal("stats_row"),
    stats: z.array(z.enum(GROUP_STATS)).catch([...GROUP_STATS_DEFAULT]),
    columns: z.enum(STAT_COLUMNS).catch("auto"),
  }),
  z.object({ ...base, type: z.literal("bank") }),
  z.object({ ...base, type: z.literal("records"), limit: limit(8) }),
  z.object({ ...base, type: z.literal("top_players"), limit: limit(10) }),
  z.object({ ...base, type: z.literal("boss_activity"), limit: limit(10) }),
  z.object({ ...base, type: z.literal("recent_drops"), limit: limit(10) }),
  z.object({ ...base, type: z.literal("lootboard"), period: period4 }),
  z.object({
    ...base,
    type: z.literal("pb_board"),
    bosses: z.array(z.object({ npc_id: z.number().int(), team_sizes: z.array(z.string()).catch([]) })).catch([]),
    rows: limit(5),
  }),
  z.object({ ...base, type: z.literal("leaderboard"), limit: limit(10), period: period4 }),
  z.object({
    ...base,
    type: z.literal("clan_log"),
    view: z.enum(["summary", "board"]).catch("summary"),
    show_categories: z.boolean().catch(true),
    recent: limit(6),
  }),
  z.object({ ...base, type: z.literal("points_leaderboard"), limit: limit(10) }),
  z.object({
    ...base,
    type: z.literal("pvp_summary"),
    period: z.enum(["month", "all"]).catch("month"),
    limit: limit(5),
    show_recent: z.boolean().catch(true),
  }),
  z.object({
    ...base,
    type: z.literal("events_list"),
    show: z.enum(["active", "active_and_past"]).catch("active_and_past"),
    limit: limit(4),
  }),
  z.object({
    ...base,
    type: z.literal("highlights"),
    types: z.array(z.enum(HIGHLIGHT_TYPES)).catch(["pet", "clog", "pb"]),
    limit: limit(8),
  }),
  z.object({
    ...base,
    type: z.literal("npc_board"),
    npc_id: z.number().int().nullish(),
    npc_name: z.string().catch(""),
    period: period4,
    limit: limit(10),
  }),
  z.object({ ...base, type: z.literal("recap"), period: z.enum(["month", "year"]).catch("month") }),
  z.object({ ...base, type: z.literal("announcements"), limit: limit(3) }),
  z.object({ ...base, type: z.literal("event_standings"), event_id: z.number().int().nullish() }),
  z.object({ ...base, type: z.literal("wom_achievements"), limit: limit(10) }),
  z.object({
    ...base,
    type: z.literal("member_roster"),
    limit: limit(50),
    sort: z.enum(["monthly", "all_time", "name"]).catch("monthly"),
    layout: z.enum(["cards", "table"]).catch("cards"),
    show_rank: z.boolean().catch(true),
    sortable: z.boolean().catch(true),
  }),
  z.object({ ...base, type: z.literal("live_ticker") }),
  // player
  z.object({
    ...base,
    type: z.literal("player_links"),
    items: z.array(z.enum(PLAYER_LINK_KEYS)).catch([...PLAYER_LINK_KEYS]),
    style: z.enum(LINK_STYLES).catch("outline"),
    align: z.enum(ALIGNS).catch("left"),
  }),
  z.object({ ...base, type: z.literal("player_showcase") }),
  z.object({
    ...base,
    type: z.literal("player_stats"),
    stats: z.array(z.enum(PLAYER_STATS)).catch([...PLAYER_STATS_DEFAULT]),
    columns: z.enum(STAT_COLUMNS).catch("auto"),
  }),
  z.object({ ...base, type: z.literal("player_clog"), view: z.enum(["summary", "browser"]).catch("summary") }),
  z.object({ ...base, type: z.literal("player_ca"), view: z.enum(["summary", "browser"]).catch("summary") }),
  z.object({ ...base, type: z.literal("player_quests") }),
  z.object({
    ...base,
    type: z.literal("player_highlights"),
    types: z.array(z.enum(HIGHLIGHT_TYPES)).catch(["pet", "clog", "pb"]),
    limit: limit(8),
  }),
  z.object({ ...base, type: z.literal("personal_bests"), limit: limit(12) }),
  z.object({ ...base, type: z.literal("top_bosses"), limit: limit(10) }),
  z.object({ ...base, type: z.literal("player_groups") }),
  z.object({ ...base, type: z.literal("player_pvp") }),
  z.object({ ...base, type: z.literal("player_recent_drops"), limit: limit(10) }),
  z.object({ ...base, type: z.literal("player_badges") }),
]);
export type PageBlock = z.infer<typeof PageBlockSchema>;
export type PageBlockType = PageBlock["type"];

export const PageThemeSchema = z.object({
  preset: z.enum(THEME_PRESETS).catch("default"),
  background: z.enum(PAGE_BACKGROUNDS).catch("default"),
  header_style: z.enum(HEADER_STYLES).catch("standard"),
  banner_url: z.string().nullish(),
  banner_height: z.enum(["sm", "md", "lg"]).catch("md"),
  show_description: z.boolean().catch(true),
  palette: z.record(z.string(), z.string()).catch({}),
});
export type PageTheme = z.infer<typeof PageThemeSchema>;

/** Blocks stay loose records here: the renderer narrows each one on its own
 * so a single bad block can't blank the page. */
export const PageLayoutSchema = z.object({
  version: z.number().int().catch(1),
  theme: PageThemeSchema.catch(PageThemeSchema.parse({})),
  blocks: z.array(z.record(z.string(), z.unknown())).catch([]),
});
export type PageLayout = z.infer<typeof PageLayoutSchema>;

export const PublicGroupLayoutSchema = z.object({ layout: PageLayoutSchema.nullable() });
export const PublicPlayerLayoutSchema = z.object({
  layout: PageLayoutSchema.nullable(),
  source: z.enum(["player", "group"]).nullable(),
  group_id: z.number().int().nullable(),
});
export type PublicPlayerLayout = z.infer<typeof PublicPlayerLayoutSchema>;

export const LayoutBuilderStateSchema = z.object({
  scope: z.enum(LAYOUT_SCOPES),
  subject_id: z.number().int(),
  draft: PageLayoutSchema.nullable(),
  published: PageLayoutSchema.nullable(),
  has_unpublished_changes: z.boolean(),
  can_publish: z.boolean(),
  updated_at: z.string().nullable(),
  published_at: z.string().nullable(),
});
export type LayoutBuilderState = z.infer<typeof LayoutBuilderStateSchema>;
