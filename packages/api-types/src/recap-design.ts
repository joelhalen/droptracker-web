/**
 * Recap designs (backend `services/recap_design.py`, migration web154a,
 * suggestion #224): what a clan's monthly recap card shows, in what order, in
 * which column, how many rows each list gets, its accent, and an optional
 * message from the clan.
 *
 * The backend normalises every design it stores (`normalize_design`), so a
 * design read back is always complete. These constants mirror the backend's
 * and `disc tests/unit/test_recap_design.py` pins its defaults; keep both in
 * step when a section, standout or limit changes.
 */
import { z } from "zod";

export const RECAP_SECTIONS = [
  { key: "gallery", label: "Loot gallery", help: "The month's most valuable items and who got them.", column: "main", enabled: true },
  { key: "sources", label: "Top sources", help: "Where the loot came from, boss by boss.", column: "main", enabled: true },
  { key: "skills", label: "Skills", help: "XP the clan gained in each skill, and who led it.", column: "main", enabled: false },
  { key: "bosses", label: "Boss kills", help: "Kill counts gained per boss, and who led it.", column: "main", enabled: false },
  { key: "note", label: "Message from the clan", help: "A short note of your own: shout-outs, events, news.", column: "main", enabled: false },
  { key: "members", label: "Top members", help: "Members ranked by loot.", column: "side", enabled: true },
  { key: "standouts", label: "Standouts", help: "The member who led each category you pick below.", column: "side", enabled: true },
  { key: "milestones", label: "Milestones", help: "Clan totals: PBs, log slots, CAs, pets, quests and more.", column: "side", enabled: true },
  { key: "pets", label: "New pets", help: "Every pet the clan got this month.", column: "side", enabled: false },
  { key: "drop", label: "Drop of the month", help: "The biggest single drop, with its screenshot.", column: null, enabled: true },
] as const;
export type RecapSectionKey = (typeof RECAP_SECTIONS)[number]["key"];
export type RecapColumn = "main" | "side";

export const RECAP_LAYOUTS = [
  { value: "auto", label: "Automatic" },
  { value: "columns", label: "Two columns" },
  { value: "stacked", label: "Single column" },
] as const;

/** Mirrors services.group_stats.STANDOUTS (key, label, unit). */
export const RECAP_STANDOUTS = [
  { key: "loot", label: "Most loot", unit: "gp" },
  { key: "biggest_drop", label: "Biggest drop", unit: "gp" },
  { key: "xp", label: "Most XP gained", unit: "xp" },
  { key: "levels", label: "Most levels gained", unit: "count" },
  { key: "ehb", label: "Most EHB gained", unit: "hours" },
  { key: "ehp", label: "Most EHP gained", unit: "hours" },
  { key: "kills", label: "Most boss kills", unit: "count" },
  { key: "drops", label: "Most drops", unit: "count" },
  { key: "clog_slots", label: "Most log slots", unit: "count" },
  { key: "pets", label: "Most pets", unit: "count" },
  { key: "pbs", label: "Most personal bests", unit: "count" },
  { key: "cas", label: "Most combat achievements", unit: "count" },
  { key: "clues", label: "Most clues", unit: "count" },
  { key: "slayer_tasks", label: "Most slayer tasks", unit: "count" },
  { key: "quests", label: "Most quests", unit: "count" },
  { key: "diaries", label: "Most diaries", unit: "count" },
  { key: "pvp_kills", label: "Most PvP kills", unit: "count" },
  { key: "deaths", label: "Most deaths", unit: "count" },
] as const;
export type RecapStandoutKey = (typeof RECAP_STANDOUTS)[number]["key"];
export const RECAP_DEFAULT_STANDOUTS: RecapStandoutKey[] = ["pbs", "clog_slots", "cas", "pets", "deaths"];
export const RECAP_MAX_STANDOUTS = 10;

export const RECAP_HERO_STATS = [
  { key: "drops", label: "Drops" },
  { key: "unique_items", label: "Unique items" },
  { key: "rank", label: "Clan rank" },
  { key: "members", label: "Members looting" },
  { key: "ehb", label: "EHB gained" },
  { key: "xp", label: "XP gained" },
  { key: "levels", label: "Levels gained" },
  { key: "kills", label: "Boss kills" },
  { key: "ehp", label: "EHP gained" },
  { key: "prime_time", label: "Prime time" },
  { key: "sources", label: "Sources" },
  { key: "clog_slots", label: "Log slots" },
  { key: "pets", label: "Pets" },
  { key: "pbs", label: "Personal bests" },
  { key: "cas", label: "Combat achievements" },
] as const;
export type RecapHeroStat = (typeof RECAP_HERO_STATS)[number]["key"];
export const RECAP_MAX_HERO_STATS = 4;

/** Row counts per list: [min, max, default]. */
export const RECAP_COUNTS = {
  gallery: [4, 10, 10],
  members: [3, 10, 5],
  sources: [3, 10, 5],
  skills: [3, 8, 6],
  bosses: [3, 8, 6],
  pets: [3, 12, 8],
} as const;
export type RecapCountKey = keyof typeof RECAP_COUNTS;

/** Accent palettes: the lantern-gold the card always had, plus alternatives.
 *  Values feed the card's --gold / --gold-dim / --bronze / --bronze-hi. */
export const RECAP_ACCENTS = {
  gold: { label: "Lantern gold", gold: "#ffd166", goldDim: "#d9a53c", bronze: "#7c6135", bronzeHi: "#c49a55", fillRgb: "255, 209, 102" },
  ember: { label: "Ember", gold: "#ff9a5c", goldDim: "#e0662f", bronze: "#7a3b22", bronzeHi: "#c46a45", fillRgb: "255, 154, 92" },
  frost: { label: "Frost", gold: "#9fdcff", goldDim: "#5fb0e0", bronze: "#2f5670", bronzeHi: "#6f9fbf", fillRgb: "159, 220, 255" },
  verdant: { label: "Verdant", gold: "#9be08a", goldDim: "#5fb35a", bronze: "#355f32", bronzeHi: "#6fa067", fillRgb: "155, 224, 138" },
  amethyst: { label: "Amethyst", gold: "#d9a8ff", goldDim: "#a970e0", bronze: "#53356f", bronzeHi: "#9070b5", fillRgb: "217, 168, 255" },
  silver: { label: "Silver", gold: "#eef1f4", goldDim: "#b8c0c8", bronze: "#5a6068", bronzeHi: "#9aa2ab", fillRgb: "238, 241, 244" },
} as const;
export type RecapAccent = keyof typeof RECAP_ACCENTS;

export const RECAP_TITLE_MAX = 60;
export const RECAP_HEADLINE_MAX = 90;
export const RECAP_NOTE_TITLE_MAX = 40;
export const RECAP_NOTE_BODY_MAX = 400;
export const RECAP_MAX_HIDDEN_PLAYERS = 50;

export const RecapDesignSectionSchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
  column: z.enum(["main", "side"]).optional(),
});

export const RecapDesignSchema = z.object({
  version: z.number().int().default(1),
  layout: z.enum(["auto", "columns", "stacked"]).default("auto"),
  accent: z.string().default("gold"),
  sections: z.array(RecapDesignSectionSchema).default([]),
  standouts: z.array(z.string()).default([]),
  standouts_depth: z.number().int().default(1),
  hero_stats: z.array(z.string()).default([]),
  counts: z.record(z.string(), z.number().int()).default({}),
  title: z.string().default(""),
  headline: z.string().default(""),
  note: z.object({ title: z.string().default(""), body: z.string().default("") }).default({ title: "", body: "" }),
  hidden_players: z.array(z.number().int()).default([]),
});
export type RecapDesign = z.infer<typeof RecapDesignSchema>;

/** The built-in default: the card as it was before designs existed. */
export function defaultRecapDesign(): RecapDesign {
  return {
    version: 1,
    layout: "auto",
    accent: "gold",
    sections: RECAP_SECTIONS.map((s) =>
      s.column ? { key: s.key, enabled: s.enabled, column: s.column } : { key: s.key, enabled: s.enabled },
    ),
    standouts: [...RECAP_DEFAULT_STANDOUTS],
    standouts_depth: 1,
    hero_stats: [],
    counts: Object.fromEntries(Object.entries(RECAP_COUNTS).map(([k, v]) => [k, v[2]])),
    title: "",
    headline: "",
    note: { title: "", body: "" },
    hidden_players: [],
  };
}

export const RecapDesignResponseSchema = z.object({
  design: RecapDesignSchema,
  /** month = this month's own design; default = the clan's; builtin = none saved. */
  source: z.enum(["month", "default", "builtin"]),
  updated_at: z.string().nullable(),
});
export type RecapDesignResponse = z.infer<typeof RecapDesignResponseSchema>;

export const RecapDesignAdminSchema = RecapDesignResponseSchema.extend({
  period: z.string(),
  has_month: z.boolean(),
  has_default: z.boolean(),
  approved_at: z.string().nullable(),
  review_mode: z.enum(["off", "notify", "approve"]),
  recaps_enabled: z.boolean(),
  channel_id: z.string().nullable(),
  guild_id: z.string().nullable(),
  post_due_at: z.string().nullable(),
  post: z
    .object({
      status: z.string(),
      channel_id: z.string().nullable(),
      message_id: z.string().nullable(),
      sent_at: z.string().nullable(),
      posted: z.boolean(),
    })
    .nullable(),
  has_snapshot: z.boolean(),
  /** False for cards built before standouts existed: "Rebuild" adds them. */
  snapshot_has_standouts: z.boolean(),
  members: z.array(z.object({ player_id: z.number().int(), name: z.string().nullable() })),
});
export type RecapDesignAdmin = z.infer<typeof RecapDesignAdminSchema>;
