import type {
  EventDetail,
  EventEffort,
  EventEffortBoss,
  EventMemberLastContribution,
  EventSummary,
  EventTask,
  EventTaskDifficulty,
} from "@droptracker/api-types";
import { EVENT_TASK_DIFFICULTIES } from "@droptracker/api-types";
import { formatGp } from "@/lib/format";

/** Default per-team accent palette, indexed by roster order — the fallback
 * when a team has no admin-assigned `color`. Shared by the bingo board, task
 * progress bars, and team pages so a team keeps one color across every event
 * surface.
 *
 * 16 entries so a large clan-vs-clan field (8–12+ clans) gets a distinct color
 * per team instead of wrapping the old 8. The first 8 are unchanged, so no
 * existing team is recolored; the next 8 fill the gaps (indigo, fuchsia, lime,
 * brown, aqua, cyan, rose, lavender) and are picked so positions 0–11 stay
 * clearly distinguishable from one another.
 *
 * "Roster order" means team id order. The backend mirrors this list as
 * TEAM_PALETTE in droptracker-core services/event_team_discord.py and picks
 * the same entry by id ordinal for the team's Discord role color, channel
 * circle and in-game orb, so edit or reorder the two together (a core unit
 * test compares them when both repos are checked out side by side). */
export const TEAM_COLORS = [
  "#e05c4c", // red
  "#4c8fe0", // blue
  "#4cb96b", // green
  "#e0b34c", // gold
  "#a05ce0", // purple
  "#e07f4c", // orange
  "#4cc9c0", // teal
  "#e05ca8", // pink
  "#6d5ce0", // indigo
  "#e05cd0", // fuchsia
  "#c9d94c", // lime
  "#b07a4c", // brown
  "#4cc9a0", // aqua
  "#4c9fd8", // cyan
  "#e04c72", // rose
  "#9c8fd0", // lavender
];

/** id → accent color for a roster: the team's assigned `color` when set,
 * else the palette entry for its roster index. Pass the UNSORTED roster so
 * fallback colors stay stable across re-ranks. */
export function teamColorMap(
  teams: { id: number; color?: string | null }[],
): Map<number, string> {
  return new Map(
    teams.map((t, i) => [t.id, t.color ?? TEAM_COLORS[i % TEAM_COLORS.length]!]),
  );
}

/** Formation modes (events-prd.md D4) as shown in the admin settings form. */
export const FORMATION_MODE_LABELS: Record<EventDetail["formation_mode"], string> = {
  self_join: "Self sign-up — players pick their team",
  auto_assign: "Self sign-up — auto-assigned to a team",
  signup_pool: "Sign-up pool — admins sort teams later",
  admin_assign: "Admin assign — no self sign-up",
};

/** One-line help under the formation-mode picker. */
export const FORMATION_MODE_HELP: Record<EventDetail["formation_mode"], string> = {
  self_join: "Players sign up from the event page and choose which team to join.",
  auto_assign: "Players sign up and are dropped onto the smallest team automatically.",
  signup_pool:
    "Players sign up into a pool with no team. You sort them into teams when ready — by hand or with a Randomize button you can re-roll as often as you like.",
  admin_assign: "Only admins place players on teams; there is no self sign-up.",
};

/** Formation modes that let a player sign themselves up. */
export const SELF_SIGNUP_MODES = ["self_join", "auto_assign", "signup_pool"] as const;

/** Event ownership shape labels. */
export const EVENT_MODE_LABELS: Record<EventDetail["mode"], string> = {
  standard: "Standard — single clan",
  clan_vs_clan: "Clan vs clan — invite an opponent",
};

/** Submission policies as shown in the admin settings form. */
export const SUBMISSION_POLICY_LABELS: Record<EventDetail["submission_policy"], string> = {
  all: "All submissions count",
  confirm_non_api: "Non-plugin submissions need review",
  api_only: "Plugin submissions only",
};

/** What each submission policy does to incoming submissions (settings help). */
export const SUBMISSION_POLICY_HELP: Record<EventDetail["submission_policy"], string> = {
  all: "Every submission counts toward tasks, no matter how it was sent.",
  confirm_non_api:
    "Submissions from the RuneLite plugin count immediately; anything else queues in Review as a pending completion until an admin confirms it.",
  api_only: "Only submissions sent by the RuneLite plugin count. Everything else is ignored.",
};

export const TASK_TYPE_LABELS: Record<EventTask["type"], string> = {
  item_collection: "Item collection",
  kc_target: "Kill count",
  xp_target: "XP target",
  ehp_target: "EHP (manual)",
  ehb_target: "EHB (manual)",
  pb_target: "Personal best",
  skill_target: "Skill level",
  loot_value: "Loot value",
  pet_collection: "Pet",
  ca_target: "Combat achievement",
  slayer_target: "Slayer tasks",
  loot_sweep: "Loot Sweep set",
  competition: "Competition race",
  custom: "Custom (manual)",
};

/** What each task type means / how the engine completes it (task-form help). */
export const TASK_TYPE_HELP: Record<EventTask["type"], string> = {
  item_collection:
    "Collect a specific item — or any / all / points-worth from a list. Credited from drops and " +
    "collection log entries. Lists can also include pets (use the Pets search tab) — those are " +
    "credited from pet submissions.",
  kc_target:
    "Kill an NPC a number of times — list several NPCs and a kill of any of them counts. Kills are counted from tracked drops.",
  xp_target: "Gain an amount of XP in a skill during the event.",
  ehp_target: "Reach an efficient-hours-played goal. Completed manually via an admin award.",
  ehb_target: "Reach an efficient-hours-bossed goal. Completed manually via an admin award.",
  pb_target: "Beat a boss within a time limit. Completed by a tracked personal best.",
  skill_target: "Reach a skill level during the event.",
  loot_value: "Earn a GP amount from drops — optionally only from specific NPCs.",
  pet_collection:
    "Obtain a pet — a specific one, any pet from a category (boss / skilling / raids), or any pet at all. Credited from pet submissions.",
  ca_target:
    "Complete combat achievements — name one, or pick the bosses (and optionally the tiers) and every achievement at them counts. The achievement list is resolved when you save, so it can't drift.",
  slayer_target:
    "Complete slayer tasks. Turael, Aya and Spria don't count unless you say so — they reset the streak and are how players skip tasks — or name exactly which masters count, pin specific assignments, or keep it to boss tasks. Credited from the plugin's slayer task completions.",
  loot_sweep:
    "One boss/“set” worth of items (Loot Sweep events only). Each item scores points that decay on every repeat receipt (capped per item); collecting the whole set awards a bonus. Never “completes” — it accrues points until the event ends.",
  competition:
    "The Skill/Boss of the Week race itself (competition events only). Managed from the event's Competition settings — not editable here.",
  custom: "Anything else. Completed manually via an admin award.",
};

/** Difficulty-tier display names. The stored values are the legacy
 * board-game rune elements (air easiest → fire hardest) — kept for DB/API
 * compat — but every dropdown/badge shows the plain difficulty instead. */
export const TASK_DIFFICULTY_LABELS: Record<EventTaskDifficulty, string> = {
  air: "Easy",
  water: "Medium",
  earth: "Hard",
  fire: "Elite",
};

/** Where a task sits on the participant task list's difficulty filter: its
 * tier, or "none" when the organisers never gave it one. Difficulty is
 * optional, so plenty of tasks (and whole events) have none. */
export type TaskDifficultyBucket = EventTaskDifficulty | "none";

/** Filter/section order: easiest first, untiered last. */
export const TASK_DIFFICULTY_BUCKETS: readonly TaskDifficultyBucket[] = [
  ...EVENT_TASK_DIFFICULTIES,
  "none",
];

export const TASK_DIFFICULTY_BUCKET_LABELS: Record<TaskDifficultyBucket, string> = {
  ...TASK_DIFFICULTY_LABELS,
  none: "No difficulty",
};

export function taskDifficultyBucket(task: Pick<EventTask, "difficulty">): TaskDifficultyBucket {
  return task.difficulty ?? "none";
}

export type TaskDifficultySection<T> = { difficulty: TaskDifficultyBucket; tasks: T[] };

/** Split a task list into difficulty sections in `TASK_DIFFICULTY_BUCKETS`
 * order. Tasks keep the event's own order within a section, and a tier with
 * no tasks gets no section. */
export function groupTasksByDifficulty<T extends Pick<EventTask, "difficulty">>(
  tasks: readonly T[],
): TaskDifficultySection<T>[] {
  const byBucket = new Map<TaskDifficultyBucket, T[]>();
  for (const task of tasks) {
    const bucket = taskDifficultyBucket(task);
    const list = byBucket.get(bucket);
    if (list) list.push(task);
    else byBucket.set(bucket, [task]);
  }
  return TASK_DIFFICULTY_BUCKETS.flatMap((difficulty) => {
    const list = byBucket.get(difficulty);
    return list ? [{ difficulty, tasks: list }] : [];
  });
}

/** Pet categories the engine can gate on (utils/osrs_pets.py). `misc` is
 * opt-in — a bare "any pet" task excludes those trivial/stackable pets. */
export const PET_CATEGORY_LABELS: Record<string, string> = {
  boss: "Boss pets",
  skilling: "Skilling pets",
  raids: "Raids pets",
  clue: "Clue pets",
  minigame: "Minigame pets",
  misc: "Misc pets (stackable / trivial)",
};

/** Category keys offered in the pet task builder, in display order. */
export const PET_CATEGORY_KEYS = [
  "boss",
  "skilling",
  "raids",
  "clue",
  "minigame",
  "misc",
] as const;

/** Canonical OSRS skills as RuneLite reports them (xp/skill task targets). */
export const OSRS_SKILLS = [
  "Attack", "Strength", "Defence", "Ranged", "Prayer", "Magic",
  "Runecraft", "Hitpoints", "Crafting", "Mining", "Smithing", "Fishing",
  "Cooking", "Firemaking", "Woodcutting", "Agility", "Herblore",
  "Thieving", "Fletching", "Slayer", "Farming", "Construction", "Hunter",
] as const;

/** "2:30" ⇒ 150 seconds; also accepts "h:mm:ss" and plain seconds. */
export function parseTimeToSeconds(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/.exec(v);
  if (!m || m[2] === undefined || m[3] === undefined) return null;
  return (m[1] ? parseInt(m[1], 10) * 3600 : 0) + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
}

export function formatSeconds(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** Parsed task config, {} on any failure (mirrors the engine's parser). */
export function taskConfig(task: Pick<EventTask, "config">): Record<string, unknown> {
  if (!task.config) return {};
  try {
    const parsed: unknown = JSON.parse(task.config);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** One sub-requirement of a `kind: "groups"` config. */
export type TaskConfigGroup = { mode: "all_of" | "any_of"; need: number; items: string[] };

function parseConfigGroups(raw: unknown): TaskConfigGroup[] {
  if (!Array.isArray(raw)) return [];
  return (raw as { mode?: string; need?: number; items?: unknown[] }[]).map((g) => {
    const items = (Array.isArray(g.items) ? g.items : []).flatMap((it) => {
      if (typeof it === "string") return [it];
      const name = (it as { item_name?: string } | null)?.item_name;
      return name ? [name] : [];
    });
    const mode = g.mode === "any_of" ? ("any_of" as const) : ("all_of" as const);
    return {
      mode,
      need: mode === "any_of" && typeof g.need === "number" && g.need >= 1 ? g.need : items.length,
      items,
    };
  });
}

/** Structured groups of a combined-requirements config, [] otherwise. */
export function taskConfigGroups(task: Pick<EventTask, "config">): TaskConfigGroup[] {
  const cfg = taskConfig(task);
  if (cfg.kind !== "groups") return [];
  return parseConfigGroups(cfg.groups);
}

/** Metric alternatives an either-or path may be instead of an item list
 * ("boss pet OR 5,000 GWD kills"): kill count, or GP of drops. */
export type PathMetric = "kc" | "loot_value";

/** One alternative of a `kind: "any_path"` (either-or) config. Item paths
 * carry `groups`; metric paths carry `metric` + `need` (+ optional `npcs`);
 * points paths carry `kind: "points"` + a weighted `items` list + `need`. */
export type TaskConfigPath = {
  label: string | null;
  groups: TaskConfigGroup[];
  metric?: PathMetric;
  need?: number;
  npcs?: string[];
  kind?: "points";
  items?: { item_name: string; points: number }[];
};

/** Structured paths of an either-or config, [] otherwise. Completing ANY
 * path completes the task ("dryness protection", suggestion #52). */
export function taskConfigPaths(task: Pick<EventTask, "config">): TaskConfigPath[] {
  const cfg = taskConfig(task);
  if (cfg.kind !== "any_path" || !Array.isArray(cfg.paths)) return [];
  return (
    cfg.paths as {
      label?: unknown;
      groups?: unknown;
      metric?: unknown;
      need?: unknown;
      npcs?: unknown;
      kind?: unknown;
      items?: unknown;
    }[]
  ).map((p) => {
    const label = typeof p.label === "string" && p.label.trim() ? p.label : null;
    if (p.metric === "kc" || p.metric === "loot_value") {
      return {
        label,
        groups: [],
        metric: p.metric,
        need: typeof p.need === "number" && p.need >= 1 ? p.need : 1,
        npcs: Array.isArray(p.npcs)
          ? p.npcs.filter((n): n is string => typeof n === "string" && n.trim().length > 0)
          : [],
      };
    }
    if (p.kind === "points") {
      return {
        label,
        kind: "points" as const,
        groups: [],
        need: typeof p.need === "number" && p.need >= 1 ? p.need : 1,
        items: (Array.isArray(p.items) ? p.items : []).flatMap((it) => {
          const name =
            typeof it === "string" ? it : (it as { item_name?: string } | null)?.item_name;
          if (!name) return [];
          const pts = typeof it === "object" && it ? (it as { points?: number }).points : undefined;
          return [{ item_name: name, points: typeof pts === "number" && pts >= 1 ? pts : 1 }];
        }),
      };
    }
    return { label, groups: parseConfigGroups(p.groups) };
  });
}

/** Optional per-item source-NPC restriction (`config.item_npcs`, a flat
 * `{item_name: [npc, ...]}` map used by multi-item tasks so it reaches groups /
 * any_path whose stored item lists are bare name strings). Keys keep their
 * stored (canonical) casing. */
function parseItemNpcs(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      const npcs = v.filter((n): n is string => typeof n === "string" && n.trim().length > 0);
      if (npcs.length) out[k] = npcs;
    }
  }
  return out;
}

/** Per-item source restriction for a multi-item task (`{item_name: [npc]}`). */
export function taskItemNpcs(task: Pick<EventTask, "config">): Record<string, string[]> {
  return parseItemNpcs(taskConfig(task).item_npcs);
}

/** Lower-cased names in an item-list config flagged as PETS
 * (`config.pet_items`): credited from pet submissions, not drops/clogs. */
export function taskConfigPetNames(task: Pick<EventTask, "config">): Set<string> {
  const raw = taskConfig(task).pet_items;
  return new Set(
    Array.isArray(raw)
      ? raw
          .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
          .map((n) => n.toLowerCase())
      : [],
  );
}

/** Task-level source restriction for a single-item task (`config.source_npcs`). */
export function taskSourceNpcs(task: Pick<EventTask, "config">): string[] {
  const raw = taskConfig(task).source_npcs;
  return Array.isArray(raw) ? raw.filter((n): n is string => typeof n === "string") : [];
}

/** The four DT2 vestiges. Each one's boss drops a Gold ring, then two, on the
 * rolls before the vestige itself (backend: utils/vestige_rings.py). */
export const DT2_VESTIGES = [
  "Ultor vestige",
  "Magus vestige",
  "Venator vestige",
  "Bellator vestige",
] as const;

/** Item id of the Gold ring, for its icon. */
export const GOLD_RING_ITEM_ID = 1635;

const itemKey = (name: string) => name.trim().toLowerCase().split(/\s+/).join(" ");
const VESTIGE_KEYS = new Set<string>(DT2_VESTIGES.map(itemKey));

/** Whether an item name is one of the DT2 vestiges (case and spacing ignored,
 * like the engine's name match). */
export function isVestigeName(name: string): boolean {
  return VESTIGE_KEYS.has(itemKey(name));
}

/** Whether an item name is the Gold ring. A list that names it counts a ring
 * as a ring, so the "Gold rings count as vestiges" switch has no effect there. */
export function isGoldRingName(name: string): boolean {
  return itemKey(name) === "gold ring";
}

/** Whether a Gold ring from a vestige's boss counts as that vestige on this
 * task (`config.vestige_rings`). On unless explicitly switched off, which is
 * also how every task built before the switch existed behaves. */
export function vestigeRingsCount(task: Pick<EventTask, "config">): boolean {
  return taskConfig(task).vestige_rings !== false;
}

/** Whether a duplicate pet counts on a task of this type when its config
 * doesn't say (`config.duplicate_pets`; backend: utils/duplicate_pets.py).
 * Item lists always counted them (a listed pet has no other credit path);
 * pet tasks and loot sweeps counted only pets the player didn't already own. */
export function duplicatePetsDefault(type: string): boolean {
  return type === "item_collection";
}

/** Whether a duplicate of a pet the player already owns counts toward this
 * task (`config.duplicate_pets`). Only a real boolean overrides the type's
 * default, which is also how every task saved before the switch behaves. */
export function duplicatePetsCount(task: Pick<EventTask, "type" | "config">): boolean {
  const value = taskConfig(task).duplicate_pets;
  return typeof value === "boolean" ? value : duplicatePetsDefault(task.type);
}

/** Whether an item_collection task names `item` itself, as its single target
 * or anywhere in its item list (case and spacing ignored). */
export function taskListsItem(
  task: Pick<EventTask, "type" | "target" | "config">,
  item: string,
): boolean {
  if (task.type !== "item_collection") return false;
  const key = itemKey(item);
  if (task.target && itemKey(task.target) === key) return true;
  return taskConfigItems(task).some((it) => itemKey(it.item_name) === key);
}

/** pb_target completion requirement (config `{mode, need}`): beat the time N
 * times / N unique players each beat it / every rostered team member beats
 * it. Config-less tasks are the legacy `times` ×1 (complete on first beat). */
export type PbRequirementMode = "times" | "unique_players" | "whole_team";

export function pbRequirement(
  task: Pick<EventTask, "config">,
): { mode: PbRequirementMode; need: number } {
  const cfg = taskConfig(task);
  const mode =
    cfg.mode === "unique_players" || cfg.mode === "whole_team" || cfg.mode === "times"
      ? (cfg.mode as PbRequirementMode)
      : "times";
  const need = typeof cfg.need === "number" && cfg.need >= 1 ? Math.floor(cfg.need) : 1;
  return { mode, need };
}

/** Mirrors `RESET_MASTER_IDS` / the names in the backend's
 * `utils/slayer_masters.py`: Turael (whose slot Aya shares) is 1, Spria is 9.
 * Used only to RECOGNISE a stored default (so the form shows "the default"
 * rather than two ticked boxes) and to label it before the catalog has
 * loaded; what a task saves comes from the server. */
export const SLAYER_RESET_MASTER_IDS: readonly number[] = [1, 9];
export const SLAYER_RESET_MASTER_NAMES: Record<number, string> = { 1: "Turael/Aya", 9: "Spria" };

export type SlayerRequirement = {
  /** Allow-list of master ids, or null when the task is a deny-list. */
  masters: number[] | null;
  /** Deny-list of master ids; empty means every master counts. Ignored when
   * `masters` is set. */
  excludeMasters: number[];
  /** Assignment names the task is pinned to; empty means any. */
  tasks: string[];
  bossOnly: boolean;
};

function masterIdList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const v of raw) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

/** A slayer_target's stored criteria. A config with no master key at all is
 * the server's default (the reset masters excluded), which is what a task
 * saved through the form without touching the masters looks like. */
export function slayerRequirement(task: Pick<EventTask, "config">): SlayerRequirement {
  const cfg = taskConfig(task);
  const masters = masterIdList(cfg.masters);
  const exclude =
    "exclude_masters" in cfg ? masterIdList(cfg.exclude_masters) : [...SLAYER_RESET_MASTER_IDS];
  return {
    masters: masters.length ? masters : null,
    excludeMasters: masters.length ? [] : exclude,
    tasks: Array.isArray(cfg.tasks)
      ? cfg.tasks.filter((t): t is string => typeof t === "string" && t.trim() !== "")
      : [],
    bossOnly: cfg.boss_only === true,
  };
}

/** True when a deny-list is exactly the server's default exclusion. */
export function isDefaultSlayerExclusion(ids: readonly number[]): boolean {
  if (ids.length !== SLAYER_RESET_MASTER_IDS.length) return false;
  const sorted = [...ids].sort((a, b) => a - b);
  return sorted.every((v, i) => v === SLAYER_RESET_MASTER_IDS[i]);
}

/** One line for a slayer_target — "25 slayer tasks — any master except
 * Turael/Aya, Spria — boss tasks only". `names` is the catalog's id → name
 * map; an id nobody knows prints as "#id" rather than vanishing. */
export function slayerRequirementSummary(
  req: SlayerRequirement,
  count: number,
  names: Record<number, string> = {},
): string {
  const name = (id: number) => names[id] ?? SLAYER_RESET_MASTER_NAMES[id] ?? `#${id}`;
  const parts = [`${count} slayer task${count === 1 ? "" : "s"}`];
  if (req.masters) parts.push(`from ${req.masters.map(name).join(" / ")}`);
  else if (req.excludeMasters.length === 0) parts.push("any master");
  else parts.push(`any master except ${req.excludeMasters.map(name).join(", ")}`);
  if (req.tasks.length)
    parts.push(req.tasks.length <= 3 ? req.tasks.join(" / ") : `${req.tasks.length} assignments`);
  if (req.bossOnly) parts.push("boss tasks only");
  return parts.join(" — ");
}

/** Items in an item-list config, for display chips (groups and either-or
 * paths are flattened; paths may share items, so names are de-duplicated).
 * `npcs` carries the item's source restriction, if any. */
export function taskConfigItems(
  task: Pick<EventTask, "config">,
): { item_name: string; points?: number; npcs?: string[] }[] {
  const cfg = taskConfig(task);
  const itemNpcs = parseItemNpcs(cfg.item_npcs);
  const npcByLower: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(itemNpcs)) npcByLower[k.toLowerCase()] = v;
  const items = Array.isArray(cfg.items)
    ? cfg.items
    : Array.isArray(cfg.any_of) // legacy bare any_of list (backend still accepts it)
      ? cfg.any_of
      : cfg.kind === "any_path"
        ? taskConfigPaths(task).flatMap((p) => [
            ...p.groups.flatMap((g) => g.items),
            ...(p.items ?? []),
          ])
        : taskConfigGroups(task).flatMap((g) => g.items);
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  return items.flatMap((it) => {
    const name = typeof it === "string" ? it : (it as { item_name?: string } | null)?.item_name;
    if (!name) return [];
    const key = name.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    const points = typeof it === "object" && it ? (it as { points?: number }).points : undefined;
    const npcs = npcByLower[key];
    return [
      {
        item_name: name,
        ...(points !== undefined ? { points } : {}),
        ...(npcs ? { npcs } : {}),
      },
    ];
  });
}

/** Short human summary of one either-or path, e.g. "all 3 items",
 * "5,000 KC at Kree'arra", or its authored label. */
export function pathSummary(p: TaskConfigPath): string {
  if (p.label) return p.label;
  if (p.metric) {
    const amount = (p.need ?? 1).toLocaleString();
    const at = p.npcs && p.npcs.length ? ` at ${p.npcs.join(" / ")}` : "";
    return p.metric === "kc" ? `${amount} KC${at}` : `${amount} GP${at}`;
  }
  const parts = p.groups.map((g) =>
    g.mode === "all_of" ? `all ${g.items.length}` : `any ${g.need} of ${g.items.length}`,
  );
  return `${parts.join(" + ")} items`;
}

/** Display label for a task type that reached us as a loose string — ledger
 * rows and per-member rollups carry the type as text, not the task union.
 * Unknown values pass through so a new backend type still reads sensibly. */
export function taskTypeLabel(type: string | null | undefined): string {
  if (!type) return "";
  return TASK_TYPE_LABELS[type as EventTask["type"]] ?? type;
}

/** Task types whose progress is a rising metric (xp / kills / GP / a level)
 * rather than discrete acquisitions. Mirrors `METRIC_TASK_TYPES` in the
 * backend's `web_api/event_players.py`: repeated updates on one of these count
 * as a SINGLE contribution, which is what the roster's counter reports. */
export const METRIC_TASK_TYPES = new Set<string>([
  "xp_target",
  "kc_target",
  "skill_target",
  "loot_value",
  "ehp_target",
  "ehb_target",
]);

/**
 * What a single credited action WAS, in a few words — the roster's "last
 * contribution" line and the per-task breakdown both read from this.
 *
 * The item name wins when there is one ("Twisted bow", "Bones ×24"); otherwise
 * the quantity is read the way its task type means it ("14 kills", "1.20M xp").
 */
export function contributionSummary(c: EventMemberLastContribution): string {
  const qty = c.quantity ?? 1;
  if (c.matched_target) {
    return qty > 1 ? `${c.matched_target} ×${qty.toLocaleString()}` : c.matched_target;
  }
  switch (c.task_type) {
    case "kc_target":
      return `${qty.toLocaleString()} kill${qty === 1 ? "" : "s"}`;
    case "xp_target":
      return `${formatGp(qty)} xp`;
    case "loot_value":
      return `${formatGp(qty)} gp`;
    case "pb_target":
      return "personal best";
    case "skill_target":
      return "level reached";
    default:
      break;
  }
  if (c.source_type === "manual") return "admin award";
  if (c.source_type === "bonus") return "bonus";
  return qty > 1 ? `×${qty.toLocaleString()}` : "credited";
}

/**
 * EHE (Efficient Hours towards Event) as a short label — "12.4h", "45m", "—".
 *
 * Sub-hour effort reads better in minutes: "0.4h" at a boss is a real session
 * and rounding it to "0h" would say the opposite. Zero renders as an em dash
 * because 0 EHE genuinely means "nothing we can price", not "did nothing" —
 * a boss with no published rate still shows its kills separately.
 *
 * `estimated` prefixes a tilde ("~12h"): some or all of the figure was priced
 * with DropTracker-derived rates rather than WOM's published ones (bosses WOM
 * doesn't price — exactly the new content bingos concentrate on). The server
 * flags it via `ehb_estimated_hours` / per-boss `estimated`; the tilde is the
 * promised label that keeps an estimate from posing as the standard number.
 */
export function formatEheHours(
  hours: number | null | undefined,
  estimated = false,
): string {
  const h = Number(hours ?? 0);
  if (!Number.isFinite(h) || h <= 0) return "—";
  const label =
    h < 1
      ? `${Math.max(Math.round(h * 60), 1)}m`
      : `${h < 10 ? h.toFixed(1) : Math.round(h).toLocaleString()}h`;
  return estimated ? `~${label}` : label;
}

/**
 * "520 kills at 2 bosses" — the plain-English gloss under an EHE figure, so a
 * reader who doesn't know what EHE is still learns what the player did.
 */
export function effortSummary(effort: EventEffort | null | undefined): string {
  const kills = effort?.kills ?? 0;
  if (!kills) return "No tracked kills yet";
  const bosses = effort?.boss_count ?? effort?.bosses.length ?? 0;
  const killLabel = `${kills.toLocaleString()} kill${kills === 1 ? "" : "s"}`;
  if (bosses <= 1) return killLabel;
  return `${killLabel} at ${bosses} bosses`;
}

/** Whether an effort row is a clue tier, where "kills" are caskets opened and
 * only the ones paired with a scroll rolled in-window were priced. `paired` is
 * null for every other NPC, which is what distinguishes them. */
export function isClueEffort(
  boss: Pick<EventEffortBoss, "paired"> | null | undefined,
): boolean {
  return boss?.paired != null;
}

/**
 * The count beside a boss on an effort list — "412 kills", or "25 caskets" for
 * a clue tier, where calling a casket a kill is what makes the hours beside it
 * look wrong.
 */
export function effortKillLabel(boss: EventEffortBoss): string {
  const n = boss.kills ?? 0;
  const unit = isClueEffort(boss) ? "casket" : "kill";
  return `${n.toLocaleString()} ${unit}${n === 1 ? "" : "s"}`;
}

/**
 * Why a clue tier's hours are lower than its openings suggest — the tooltip
 * that answers "I opened 60 elites, where are my hours?". Returns undefined
 * for anything that is not a clue tier.
 */
export function effortPairNote(boss: EventEffortBoss): string | undefined {
  if (!isClueEffort(boss)) return undefined;
  const paired = boss.paired ?? 0;
  const rolled = boss.rolled ?? 0;
  const opened = boss.kills ?? 0;
  if (paired <= 0) {
    return `No hours: ${rolled.toLocaleString()} clue${rolled === 1 ? "" : "s"} of this tier were rolled during the event, so none of these ${opened.toLocaleString()} openings could be paired. Clues banked before the event don't count.`;
  }
  return `${paired.toLocaleString()} of ${opened.toLocaleString()} openings paired with a clue rolled during the event (${rolled.toLocaleString()} rolled). Only paired clues earn hours.`;
}

/**
 * How much one player has put into a task, with its unit — "14 kills",
 * "4.25M xp", "×24". Returns "" for tasks whose quantity carries no meaning
 * (a personal best or a level is reached, not accumulated).
 */
export function taskQuantityLabel(type: string | null | undefined, quantity: number): string {
  switch (type) {
    case "kc_target":
      return `${quantity.toLocaleString()} kill${quantity === 1 ? "" : "s"}`;
    case "xp_target":
      return `${formatGp(quantity)} xp`;
    case "loot_value":
      return `${formatGp(quantity)} gp`;
    case "pb_target":
    case "skill_target":
    case "ehp_target":
    case "ehb_target":
      return "";
    default:
      return `×${quantity.toLocaleString()}`;
  }
}

/** Human-readable goal for a task, e.g. "Vorkath · 50 KC" or "Zulrah · sub 1:10".
 * Takes the goal fields only, so task-library presets qualify too. */
export function taskGoal(
  task: Pick<EventTask, "type" | "target" | "target_value" | "config">,
): string {
  const target = task.target ?? "";
  const tv = task.target_value;
  switch (task.type) {
    case "kc_target": {
      // Multi-NPC tasks (config.npcs, "either counts") show every NPC.
      const npcs = taskConfig(task).npcs;
      const who =
        Array.isArray(npcs) && npcs.length > 1 ? (npcs as string[]).join(" / ") : target;
      return tv != null ? `${who} · ${tv.toLocaleString()} KC` : who;
    }
    case "pb_target": {
      const base = tv != null ? `${target} · sub ${formatSeconds(tv)}` : target;
      const { mode, need } = pbRequirement(task);
      if (mode === "whole_team") return `${base} · whole team`;
      if (mode === "unique_players") return `${base} · ${need} unique player${need === 1 ? "" : "s"}`;
      if (need > 1) return `${base} ×${need}`;
      return base;
    }
    case "xp_target":
      return tv != null ? `${target} · ${tv.toLocaleString()} XP` : target;
    case "skill_target":
      return tv != null ? `${target} · level ${tv}` : target;
    case "loot_value": {
      const sources = taskConfig(task).source_npcs;
      const from =
        Array.isArray(sources) && sources.length ? ` from ${(sources as string[]).join(", ")}` : "";
      return tv != null ? `${tv.toLocaleString()} GP${from}` : "";
    }
    case "item_collection": {
      // Per-item source restriction (multi-item tasks) shows as a count suffix.
      const lockedCount = Object.keys(taskItemNpcs(task)).length;
      const lockSuffix = lockedCount ? ` · ${lockedCount} source-locked` : "";
      const paths = taskConfigPaths(task);
      if (paths.length) {
        // e.g. "Full set OR Any 5 pieces" (dryness protection).
        return paths.map(pathSummary).join(" OR ") + lockSuffix;
      }
      const groups = taskConfigGroups(task);
      if (groups.length) {
        // e.g. "all 3 + any 1 of 4 items" (godsword: shards + any hilt).
        const parts = groups.map((g) =>
          g.mode === "all_of" ? `all ${g.items.length}` : `any ${g.need} of ${g.items.length}`,
        );
        return `${parts.join(" + ")} items${lockSuffix}`;
      }
      const items = taskConfigItems(task);
      if (items.length) {
        const rawKind = taskConfig(task).kind;
        // any_of_distinct counts each item once ("any 4 DIFFERENT of 8");
        // naming it keeps it apart from any_of, where repeats count.
        const kind =
          rawKind === "any_of_distinct"
            ? "any different"
            : String(rawKind ?? "any_of").replace("_", " ");
        const need =
          (rawKind === "any_of" || rawKind === "any_of_distinct") && tv != null && tv > 1
            ? ` · ${tv.toLocaleString()} needed`
            : "";
        return `${kind} · ${items.length} items${need}${lockSuffix}`;
      }
      if (target) {
        // Single item — mirror the loot_value " from <NPC>" idiom.
        const sources = taskSourceNpcs(task);
        const from = sources.length ? ` from ${sources.join(", ")}` : "";
        const qty = tv != null && tv > 1 ? ` · ${tv.toLocaleString()}×` : "";
        return `${target}${qty}${from}`;
      }
      return "";
    }
    case "pet_collection": {
      const count = tv != null && tv > 1 ? ` · ${tv.toLocaleString()}×` : "";
      // Specific pet by name.
      if (target) return `${target}${count}`;
      // Explicit allow list (customized category preset) — name the pets when
      // short, else just the count of eligible ones.
      const pets = taskConfig(task).pets;
      if (Array.isArray(pets) && pets.length) {
        if (pets.length <= 3) return `Any of ${(pets as string[]).join(" / ")}${count}`;
        return `Any of ${pets.length} listed pets${count}`;
      }
      // Category gate, else "any pet".
      const cats = taskConfig(task).categories;
      if (Array.isArray(cats) && cats.length) {
        const names = (cats as string[]).map((c) => PET_CATEGORY_LABELS[c] ?? c);
        return `Any ${names.join(" / ").toLowerCase()}${count}`;
      }
      return `Any pet${count}`;
    }
    default: {
      const parts: string[] = [];
      if (target) parts.push(target);
      if (tv != null) parts.push(tv.toLocaleString());
      return parts.join(" · ");
    }
  }
}

/** Ledger statuses whose credit is still standing — the set the backend's
 * revoke endpoint accepts (`APPLIED_STATUSES` in web_api/routes/event_admin.py).
 * `pending` is decided in Review (confirm/reject), and `rejected`/`revoked`
 * never counted or already stopped counting. */
export const APPLIED_COMPLETION_STATUSES = ["auto", "confirmed", "manual"] as const;

/** Whether an audit-log row points at a completion whose points can still be
 * taken back. Both the ledger and audit sources report the completion's
 * *current* status, so a confirmation that was already revoked reads as
 * `revoked` here and offers no second revoke.
 *
 * Structurally typed rather than importing `AuditEntry` from `@/lib/api` —
 * that module is the whole BFF client, and this file is imported by leaf
 * components. */
export function isRevocableCompletion(entry: {
  completion_id: number | null;
  status: string | null;
}): boolean {
  return (
    entry.completion_id != null &&
    entry.status != null &&
    (APPLIED_COMPLETION_STATUSES as readonly string[]).includes(entry.status)
  );
}

/** Whether a ledger row still belongs in the Review list once its status
 * changes — the review queue applies confirm/reject/revoke optimistically, so
 * a row that no longer matches the active status filter leaves the list before
 * the server answers. `"all"` is the filter that keeps everything.
 *
 * Structurally typed (a bare status string) for the same reason as
 * `isRevocableCompletion` above. */
export function completionMatchesFilter(rowStatus: string, filter: string): boolean {
  return filter === "all" || rowStatus === filter;
}

/** Undo an optimistic patch/removal: put `row` back at index `at`, the
 * position it held before the action that failed. Any stale copy of the row is
 * dropped first (the optimistic update may have left a patched one in place),
 * and an index that no longer exists — the list was refetched underneath —
 * appends instead of throwing the row away. */
export function restoreOptimisticRow<T extends { id: number }>(rows: T[], row: T, at: number): T[] {
  const without = rows.filter((r) => r.id !== row.id);
  const idx = at < 0 || at > without.length ? without.length : at;
  return [...without.slice(0, idx), row, ...without.slice(idx)];
}

/** Pick which of the viewer's clan events (GET /events?mine=true) appear in
 * the "Your events" section on /events: live ones first (soonest end), then
 * upcoming drafts (soonest start). Null timestamps sort last in their bucket;
 * past events never show. */
export function pickYourEvents(events: EventSummary[]): EventSummary[] {
  const byTime = (t: (e: EventSummary) => number | null) => (a: EventSummary, b: EventSummary) =>
    (t(a) ?? Infinity) - (t(b) ?? Infinity);
  const live = events.filter((e) => e.status === "active").sort(byTime((e) => e.ends_at));
  const upcoming = events.filter((e) => e.status === "draft").sort(byTime((e) => e.starts_at));
  return [...live, ...upcoming];
}
