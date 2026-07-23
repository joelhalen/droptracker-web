import type { EventDetail, EventTask, EventTaskDifficulty } from "@droptracker/api-types";

/** Default per-team accent palette, indexed by roster order — the fallback
 * when a team has no admin-assigned `color`. Shared by the bingo board, task
 * progress bars, and team pages so a team keeps one color across every event
 * surface.
 *
 * 16 entries so a large clan-vs-clan field (8–12+ clans) gets a distinct color
 * per team instead of wrapping the old 8. The first 8 are unchanged, so no
 * existing team is recolored; the next 8 fill the gaps (indigo, fuchsia, lime,
 * brown, aqua, cyan, rose, lavender) and are picked so positions 0–11 stay
 * clearly distinguishable from one another. */
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
  loot_sweep: "Loot Sweep set",
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
  loot_sweep:
    "One boss/“set” worth of items (Loot Sweep events only). Each item scores points that decay on every repeat receipt (capped per item); collecting the whole set awards a bonus. Never “completes” — it accrues points until the event ends.",
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

/** Pet categories the engine can gate on (utils/osrs_pets.py). `misc` is
 * opt-in — a bare "any pet" task excludes those trivial/stackable pets. */
export const PET_CATEGORY_LABELS: Record<string, string> = {
  boss: "Boss pets",
  skilling: "Skilling pets",
  raids: "Raids pets",
  misc: "Misc pets (stackable / trivial)",
};

/** Category keys offered in the pet task builder, in display order. */
export const PET_CATEGORY_KEYS = ["boss", "skilling", "raids", "misc"] as const;

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
 * carry `groups`; metric paths carry `metric` + `need` (+ optional `npcs`). */
export type TaskConfigPath = {
  label: string | null;
  groups: TaskConfigGroup[];
  metric?: PathMetric;
  need?: number;
  npcs?: string[];
};

/** Structured paths of an either-or config, [] otherwise. Completing ANY
 * path completes the task ("dryness protection", suggestion #52). */
export function taskConfigPaths(task: Pick<EventTask, "config">): TaskConfigPath[] {
  const cfg = taskConfig(task);
  if (cfg.kind !== "any_path" || !Array.isArray(cfg.paths)) return [];
  return (
    cfg.paths as { label?: unknown; groups?: unknown; metric?: unknown; need?: unknown; npcs?: unknown }[]
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
    : cfg.kind === "any_path"
      ? taskConfigPaths(task).flatMap((p) => p.groups.flatMap((g) => g.items))
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
    case "pb_target":
      return tv != null ? `${target} · sub ${formatSeconds(tv)}` : target;
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
        const kind = String(taskConfig(task).kind ?? "any_of").replace("_", " ");
        const need =
          taskConfig(task).kind === "any_of" && tv != null && tv > 1
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
