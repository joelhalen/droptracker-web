/**
 * Block library for the page builder (web137a): what each block is called,
 * where it can go, what it starts with, plus the standard layouts every page
 * falls back to and the starter templates.
 *
 * Client-safe (no server imports): the builder, the page renderers and the
 * tests all read it. The Python validator in
 * `disc/web_api/page_layouts_shared.py` is the authority on what can be
 * saved; keep the two in step.
 */
import type {
  BlockSurface,
  LayoutScope,
  PageBlockType,
  PageLayout,
  PageTheme,
} from "@droptracker/api-types";

export type BlockCategory = "basics" | "clan" | "loot" | "records" | "community" | "profile";

export type BlockDef = {
  type: PageBlockType;
  label: string;
  /** One line for the library card. */
  description: string;
  icon: string;
  category: BlockCategory;
  scope: "group" | "player" | "both";
  /** Surface a fresh block starts in. */
  surface: BlockSurface;
  /** Initial props for a fresh block. */
  props: Record<string, unknown>;
  /** At most one per page (it would only repeat itself). */
  single?: boolean;
};

export const BLOCK_CATEGORIES: { key: BlockCategory; label: string }[] = [
  { key: "basics", label: "Basics" },
  { key: "clan", label: "Clan" },
  { key: "profile", label: "Profile" },
  { key: "loot", label: "Loot" },
  { key: "records", label: "Records" },
  { key: "community", label: "Community" },
];

export const BLOCK_DEFS: BlockDef[] = [
  // basics
  { type: "markdown", label: "Text", description: "Headings, paragraphs and lists.", icon: "¶", category: "basics", scope: "both", surface: "plain", props: { body: "## About us\n\nTell visitors who you are.", align: "left" } },
  { type: "image", label: "Image", description: "A banner, screenshot or logo.", icon: "🖼", category: "basics", scope: "both", surface: "plain", props: { url: null, alt: "", caption: "", fit: "cover", height: "md" } },
  { type: "buttons", label: "Buttons", description: "Links to Discord, Wise Old Man or anywhere.", icon: "⬢", category: "basics", scope: "both", surface: "plain", props: { items: [{ label: "Join our Discord", href: "https://discord.gg/" }], style: "solid", align: "left" } },
  { type: "divider", label: "Divider", description: "Space between sections.", icon: "—", category: "basics", scope: "both", surface: "plain", props: { size: "md", rule: true } },
  // clan
  { type: "group_links", label: "Clan links", description: "Lootboard, Clan Log, PBs, Discord and more.", icon: "☷", category: "clan", scope: "group", surface: "plain", props: { items: ["lootboard", "clan_log", "personal_bests", "pvp", "points", "recaps", "discord"], style: "outline", align: "left" }, single: true },
  { type: "stats_row", label: "Stats", description: "Pick up to 8: members, loot, Clan Log, PvP, bank and more.", icon: "▦", category: "clan", scope: "group", surface: "plain", props: { stats: ["members", "rank", "monthly_loot", "top_player"], columns: "auto", tile_style: "auto" } },
  { type: "events_list", label: "Events", description: "What's running now, and recent results.", icon: "🚩", category: "community", scope: "group", surface: "card", props: { show: "active_and_past", limit: 4 } },
  { type: "clan_log", label: "Clan Log", description: "Collection log progress across the clan.", icon: "📖", category: "records", scope: "group", surface: "card", props: { view: "summary", show_categories: true, recent: 6, show_link: true } },
  { type: "points_leaderboard", label: "Clan points", description: "Top members by clan points, for any time frame.", icon: "✦", category: "clan", scope: "group", surface: "card", props: { limit: 10, period: "month", switchable: false, periods: ["month", "all"], show_link: true } },
  { type: "pvp_summary", label: "PvP", description: "Kills, PvP loot and top killers.", icon: "☠", category: "loot", scope: "group", surface: "card", props: { period: "month", limit: 5, show_recent: true, show_link: true } },
  { type: "highlights", label: "Highlights", description: "Recent pets, log slots, PBs: you pick which.", icon: "✨", category: "loot", scope: "group", surface: "card", props: { types: ["pet", "clog", "pb"], limit: 8 } },
  { type: "support_card", label: "Support card", description: "Lets members chip in toward your plan.", icon: "♥", category: "clan", scope: "group", surface: "plain", props: {}, single: true },
  { type: "bank", label: "Clan bank", description: "Your bank balance and recent entries.", icon: "⛁", category: "clan", scope: "group", surface: "plain", props: {}, single: true },
  { type: "member_roster", label: "Member list", description: "Your members, ranked or alphabetical.", icon: "👥", category: "clan", scope: "group", surface: "card", props: { limit: 50, sort: "monthly", layout: "cards", show_rank: true, sortable: true } },
  // loot
  { type: "recent_drops", label: "Recent drops", description: "The latest tracked loot.", icon: "◈", category: "loot", scope: "group", surface: "plain", props: { limit: 10 } },
  { type: "top_players", label: "Top players", description: "This month's biggest earners.", icon: "♛", category: "loot", scope: "group", surface: "card", props: { limit: 10 } },
  { type: "boss_activity", label: "Most active bosses", description: "What the clan farms most.", icon: "⚔", category: "loot", scope: "group", surface: "card", props: { limit: 10 } },
  { type: "leaderboard", label: "Loot leaderboard", description: "GP ranking for a day, week, month or all time.", icon: "☰", category: "loot", scope: "group", surface: "card", props: { limit: 10, period: "month", switchable: false, periods: ["month", "all"] } },
  { type: "npc_board", label: "Boss leaderboard", description: "Loot ranking for one boss.", icon: "🐉", category: "loot", scope: "group", surface: "card", props: { npc_id: null, period: "month", limit: 10, switchable: false, periods: ["month", "all"] } },
  { type: "lootboard", label: "Lootboard", description: "The lootboard image.", icon: "▤", category: "loot", scope: "group", surface: "card", props: { period: "month" } },
  { type: "live_ticker", label: "Live drop feed", description: "Drops as they happen.", icon: "⚡", category: "loot", scope: "group", surface: "plain", props: {} },
  // records
  { type: "records", label: "Clan records", description: "Fastest kills held by members.", icon: "⏱", category: "records", scope: "group", surface: "plain", props: { limit: 8 } },
  { type: "pb_board", label: "PB board", description: "Ranked times for chosen bosses.", icon: "⏲", category: "records", scope: "group", surface: "card", props: { bosses: [], rows: 5, max_sizes: 3 } },
  // community
  { type: "announcements", label: "Announcements", description: "Your latest news posts.", icon: "📣", category: "community", scope: "group", surface: "card", props: { limit: 3 } },
  { type: "event_standings", label: "Event standings", description: "Team scores for a running event.", icon: "🚩", category: "community", scope: "group", surface: "card", props: { event_id: null } },
  { type: "wom_achievements", label: "Recent achievements", description: "Milestones from Wise Old Man.", icon: "🏆", category: "community", scope: "group", surface: "card", props: { limit: 10 } },
  { type: "recap", label: "Recap card", description: "Your latest monthly recap.", icon: "🗓", category: "community", scope: "group", surface: "plain", props: { period: "month" } },
  // player
  { type: "player_links", label: "Profile links", description: "Collection log, achievements, recap.", icon: "☷", category: "profile", scope: "player", surface: "plain", props: { items: ["collection_log", "achievements", "recap"], style: "outline", align: "left" }, single: true },
  { type: "player_showcase", label: "Character and account", description: "Your character, loot and account tabs.", icon: "🧍", category: "profile", scope: "player", surface: "plain", props: {}, single: true },
  { type: "player_stats", label: "Stats", description: "Pick up to 8: loot, log slots, CAs, quests and more.", icon: "▦", category: "profile", scope: "player", surface: "plain", props: { stats: ["monthly_loot", "rank", "clan_points", "top_npc"], columns: "auto", tile_style: "auto" } },
  { type: "player_clog", label: "Collection log", description: "Log progress, or the full browsable log.", icon: "📖", category: "records", scope: "player", surface: "card", props: { view: "summary" }, single: true },
  { type: "player_ca", label: "Combat achievements", description: "Progress by tier, or every task.", icon: "🗡", category: "records", scope: "player", surface: "card", props: { view: "summary" }, single: true },
  { type: "player_quests", label: "Quests and diaries", description: "Quest points and diary tiers.", icon: "📜", category: "records", scope: "player", surface: "card", props: {}, single: true },
  { type: "player_highlights", label: "Highlights", description: "Recent pets, log slots, PBs: you pick which.", icon: "✨", category: "loot", scope: "player", surface: "card", props: { types: ["pet", "clog", "pb"], limit: 8 } },
  { type: "personal_bests", label: "Personal bests", description: "Your fastest kill times.", icon: "⏱", category: "records", scope: "player", surface: "plain", props: { limit: 12 } },
  { type: "top_bosses", label: "Top bosses", description: "Your most-killed bosses this month.", icon: "⚔", category: "loot", scope: "player", surface: "card", props: { limit: 10 } },
  { type: "player_recent_drops", label: "Recent drops", description: "Your latest tracked loot.", icon: "◈", category: "loot", scope: "player", surface: "card", props: { limit: 10 } },
  { type: "player_groups", label: "Groups", description: "The clans you're in.", icon: "⛨", category: "profile", scope: "player", surface: "plain", props: {}, single: true },
  { type: "player_badges", label: "Badges", description: "Badges you've earned.", icon: "✪", category: "profile", scope: "player", surface: "plain", props: {}, single: true },
  { type: "player_pvp", label: "PvP record", description: "Kills, deaths and loot from PvP.", icon: "☠", category: "profile", scope: "player", surface: "plain", props: {}, single: true },
];

export const BLOCK_DEF: Record<string, BlockDef> = Object.fromEntries(
  BLOCK_DEFS.map((d) => [d.type, d]),
);

/** The periods a board shows: just its own, or (switchable) its own plus the
 * offered ones, in the order the editor set. */
export function boardPeriods<T extends string>(period: T, switchable: boolean, offered: readonly T[]): T[] {
  if (!switchable) return [period];
  return offered.includes(period) ? [...offered] : [period, ...offered];
}

/** member_default layouts are player profiles. */
export function layoutKind(scope: LayoutScope): "group" | "player" {
  return scope === "group" ? "group" : "player";
}

export function defsForScope(scope: LayoutScope): BlockDef[] {
  const kind = layoutKind(scope);
  return BLOCK_DEFS.filter((d) => d.scope === "both" || d.scope === kind);
}

export function newBlockId(): string {
  return `b${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function makeBlock(type: PageBlockType, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const def = BLOCK_DEF[type];
  return {
    id: newBlockId(),
    type,
    width: "full",
    surface: def?.surface ?? "plain",
    title: null,
    hide_on: "none",
    ...structuredClone(def?.props ?? {}),
    ...overrides,
  };
}

export const DEFAULT_THEME: PageTheme = {
  preset: "default",
  background: "default",
  header_style: "standard",
  banner_url: null,
  banner_height: "md",
  show_description: true,
  palette: {},
};

/** Fixed ids so the standard layouts are stable across renders (React keys,
 * and the builder's "start from the standard page"). */
function std(id: string, type: PageBlockType, overrides: Record<string, unknown> = {}) {
  return { ...makeBlock(type, overrides), id };
}

/** The standard group page: what every group shows until it publishes its own. */
export function defaultGroupLayout(): PageLayout {
  return {
    version: 1,
    theme: { ...DEFAULT_THEME },
    blocks: [
      std("std-links", "group_links"),
      std("std-support", "support_card"),
      std("std-stats", "stats_row"),
      std("std-bank", "bank"),
      std("std-records", "records", { title: "Clan records" }),
      std("std-top", "top_players", { title: "Top players this month", width: "half" }),
      std("std-bosses", "boss_activity", { title: "Most active bosses", width: "half" }),
      std("std-recent", "recent_drops", { title: "Recent submissions" }),
    ],
  };
}

/** The standard profile. */
export function defaultPlayerLayout(): PageLayout {
  return {
    version: 1,
    theme: { ...DEFAULT_THEME },
    blocks: [
      std("std-plinks", "player_links"),
      std("std-showcase", "player_showcase"),
      std("std-pbs", "personal_bests", { title: "Personal bests" }),
      std("std-pbosses", "top_bosses", { title: "Top bosses this month", width: "half" }),
      std("std-groups", "player_groups", { title: "Groups", width: "half" }),
      std("std-pvp", "player_pvp"),
    ],
  };
}

export function defaultLayout(scope: LayoutScope): PageLayout {
  return layoutKind(scope) === "group" ? defaultGroupLayout() : defaultPlayerLayout();
}

export type LayoutTemplate = {
  key: string;
  label: string;
  description: string;
  build: () => PageLayout;
};

export const GROUP_TEMPLATES: LayoutTemplate[] = [
  { key: "standard", label: "Standard", description: "The DropTracker page everyone starts with.", build: defaultGroupLayout },
  {
    key: "pvm",
    label: "PvM clan",
    description: "Records and boss boards up front, stone panels.",
    build: () => ({
      version: 1,
      theme: { ...DEFAULT_THEME, preset: "wilderness", background: "stone", header_style: "centered" },
      blocks: [
        makeBlock("group_links", { style: "osrs", align: "center" }),
        makeBlock("stats_row"),
        makeBlock("records", { title: "Clan records", surface: "stone" }),
        makeBlock("stats_row", { stats: ["clan_log", "top_boss", "records_held", "pvp_kills"] }),
        makeBlock("pb_board", { title: "Raid times", surface: "stone", width: "half" }),
        makeBlock("boss_activity", { title: "Most farmed", surface: "stone", width: "half" }),
        makeBlock("highlights", { title: "Pets and log slots", surface: "window", types: ["pet", "clog"], width: "half" }),
        makeBlock("recent_drops", { title: "Latest loot", surface: "stone", width: "half" }),
      ],
    }),
  },
  {
    key: "community",
    label: "Social clan",
    description: "A welcome scroll, news and your members.",
    build: () => ({
      version: 1,
      theme: { ...DEFAULT_THEME, preset: "dusk", header_style: "banner" },
      blocks: [
        makeBlock("markdown", { surface: "scroll", align: "center", body: "## Welcome, adventurer\n\nWe're a friendly clan for every kind of player. Say hello in our Discord!" }),
        makeBlock("buttons", { align: "center", style: "osrs", items: [{ label: "Join our Discord", href: "https://discord.gg/" }] }),
        makeBlock("announcements", { title: "Clan news", width: "two_thirds" }),
        makeBlock("events_list", { title: "Events", width: "third" }),
        makeBlock("stats_row", { stats: ["members", "rank", "clan_log", "points_leader"] }),
        makeBlock("top_players", { title: "Top earners", width: "half" }),
        makeBlock("wom_achievements", { title: "Recent milestones", width: "half" }),
        makeBlock("member_roster", { title: "Our members" }),
      ],
    }),
  },
  {
    key: "minimal",
    label: "Minimal",
    description: "Just the essentials, lots of breathing room.",
    build: () => ({
      version: 1,
      theme: { ...DEFAULT_THEME, background: "plain", header_style: "centered" },
      blocks: [
        makeBlock("group_links", { align: "center" }),
        makeBlock("stats_row"),
        makeBlock("recent_drops", { title: "Recent drops" }),
      ],
    }),
  },
];

export const PLAYER_TEMPLATES: LayoutTemplate[] = [
  { key: "standard", label: "Standard", description: "The DropTracker profile everyone starts with.", build: defaultPlayerLayout },
  {
    key: "pvmer",
    label: "PvMer",
    description: "Personal bests first, on stone.",
    build: () => ({
      version: 1,
      theme: { ...DEFAULT_THEME, preset: "wilderness", background: "stone" },
      blocks: [
        makeBlock("player_links", { style: "osrs" }),
        makeBlock("player_stats", { stats: ["clog_slots", "ca_tasks", "pbs_count", "combat_level"] }),
        makeBlock("personal_bests", { title: "Personal bests", surface: "stone", limit: 24 }),
        makeBlock("player_showcase"),
        makeBlock("top_bosses", { title: "Top bosses", surface: "stone", width: "half" }),
        makeBlock("player_recent_drops", { title: "Recent drops", surface: "stone", width: "half" }),
      ],
    }),
  },
  {
    key: "about-me",
    label: "About me",
    description: "A short bio on a scroll, then your stats.",
    build: () => ({
      version: 1,
      theme: { ...DEFAULT_THEME, preset: "dusk", header_style: "banner" },
      blocks: [
        makeBlock("markdown", { surface: "scroll", align: "center", body: "## About me\n\nWrite a few lines about your account and goals." }),
        makeBlock("player_stats"),
        makeBlock("player_showcase"),
        makeBlock("player_clog", { title: "Collection log", width: "half" }),
        makeBlock("player_ca", { title: "Combat achievements", width: "half" }),
        makeBlock("player_badges", { title: "Badges", width: "half" }),
        makeBlock("player_groups", { title: "Groups", width: "half" }),
      ],
    }),
  },
];

export function templatesFor(scope: LayoutScope): LayoutTemplate[] {
  return layoutKind(scope) === "group" ? GROUP_TEMPLATES : PLAYER_TEMPLATES;
}

export const SURFACE_LABELS: Record<BlockSurface, { label: string; hint: string }> = {
  plain: { label: "None", hint: "Sits straight on the page." },
  card: { label: "Card", hint: "The site's standard card." },
  stone: { label: "Stone", hint: "OSRS interface panel." },
  window: { label: "Window", hint: "OSRS window with a title bar." },
  parchment: { label: "Parchment", hint: "Light paper with dark ink." },
  scroll: { label: "Scroll", hint: "The rolled scroll from our docs." },
  panel: { label: "Glass", hint: "Dark panel with a gold rim." },
};
