import type { EventDetail, EventTask } from "@droptracker/api-types";

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
  custom: "Custom (manual)",
};

/** What each task type means / how the engine completes it (task-form help). */
export const TASK_TYPE_HELP: Record<EventTask["type"], string> = {
  item_collection:
    "Collect a specific item — or any / all / points-worth from a list. Credited from drops and collection log entries.",
  kc_target: "Kill a specific NPC a number of times. Kills are counted from tracked drops.",
  xp_target: "Gain an amount of XP in a skill during the event.",
  ehp_target: "Reach an efficient-hours-played goal. Completed manually via an admin award.",
  ehb_target: "Reach an efficient-hours-bossed goal. Completed manually via an admin award.",
  pb_target: "Beat a boss within a time limit. Completed by a tracked personal best.",
  skill_target: "Reach a skill level during the event.",
  loot_value: "Earn a GP amount from drops — optionally only from specific NPCs.",
  custom: "Anything else. Completed manually via an admin award.",
};

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

/** Items in an item-list config, for display chips. */
export function taskConfigItems(
  task: Pick<EventTask, "config">,
): { item_name: string; points?: number }[] {
  const items = taskConfig(task).items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((it) => {
    if (typeof it === "string") return [{ item_name: it }];
    const entry = it as { item_name?: string; points?: number };
    return entry.item_name ? [{ item_name: entry.item_name, points: entry.points }] : [];
  });
}

/** Human-readable goal for a task, e.g. "Vorkath · 50 KC" or "Zulrah · sub 1:10".
 * Takes the goal fields only, so task-library presets qualify too. */
export function taskGoal(
  task: Pick<EventTask, "type" | "target" | "target_value" | "config">,
): string {
  const target = task.target ?? "";
  const tv = task.target_value;
  switch (task.type) {
    case "kc_target":
      return tv != null ? `${target} · ${tv.toLocaleString()} KC` : target;
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
      const items = taskConfigItems(task);
      if (items.length) {
        const kind = String(taskConfig(task).kind ?? "any_of").replace("_", " ");
        return `${kind} · ${items.length} items`;
      }
      if (target) return tv != null && tv > 1 ? `${target} · ${tv.toLocaleString()}×` : target;
      return "";
    }
    default: {
      const parts: string[] = [];
      if (target) parts.push(target);
      if (tv != null) parts.push(tv.toLocaleString());
      return parts.join(" · ");
    }
  }
}
