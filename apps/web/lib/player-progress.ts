/**
 * Pure shaping for the profile's account tabs: skills, combat achievement
 * tiers and filters, diary tones. Kept out of the components so it is
 * unit-testable (test/player-progress.test.ts).
 */
import type { PlayerAchievements } from "@droptracker/api-types";

export const SITE_IMG_BASE = "https://www.droptracker.io/img";

/** Backend image URLs are absolute to the site. A host with a same-origin-only
 * image policy (the Discord Activity) passes "/img" to re-root them. */
export function rebaseImg(url: string | null | undefined, imgBase: string): string | null {
  if (!url) return null;
  return url.startsWith(SITE_IMG_BASE) ? imgBase + url.slice(SITE_IMG_BASE.length) : url;
}

/** Skills in the order the in-game stats panel lays them out, row by row. */
export const SKILL_ORDER = [
  "attack", "hitpoints", "mining",
  "strength", "agility", "smithing",
  "defence", "herblore", "fishing",
  "ranged", "thieving", "cooking",
  "prayer", "crafting", "firemaking",
  "magic", "fletching", "woodcutting",
  "runecraft", "slayer", "farming",
  "construction", "hunter", "sailing",
] as const;

export function skillLabel(skill: string): string {
  return skill.charAt(0).toUpperCase() + skill.slice(1);
}

/** 1,234,567 -> "1.23M"; small numbers stay exact. */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US");
}

export const CA_TIERS = ["Easy", "Medium", "Hard", "Elite", "Master", "Grandmaster"] as const;

export function caTierIcon(tier: string | null | undefined): string | null {
  const key = (tier ?? "").toLowerCase();
  return (CA_TIERS as readonly string[]).some((t) => t.toLowerCase() === key)
    ? `/osrs/ca-${key}.png`
    : null;
}

type Combat = PlayerAchievements["combat_achievements"];
export type CaTask = Combat["monsters"][number]["tasks"][number] & { monster: string };

/** Every task as one flat list, in the game's order: tier, then name. */
export function flattenCaTasks(combat: Combat): CaTask[] {
  const rank = new Map<string, number>(CA_TIERS.map((t, i) => [t, i]));
  return combat.monsters
    .flatMap((m) => m.tasks.map((task) => ({ ...task, monster: m.monster })))
    .sort(
      (a, b) =>
        (rank.get(a.tier) ?? 9) - (rank.get(b.tier) ?? 9) ||
        a.monster.localeCompare(b.monster) ||
        a.name.localeCompare(b.name),
    );
}

export type CaFilters = {
  tier: string;
  type: string;
  monster: string;
  /** "all" | "complete" | "incomplete" */
  completed: string;
  query: string;
};

export const NO_CA_FILTERS: CaFilters = {
  tier: "all",
  type: "all",
  monster: "all",
  completed: "all",
  query: "",
};

export function filterCaTasks(tasks: CaTask[], f: CaFilters): CaTask[] {
  const q = f.query.trim().toLowerCase();
  return tasks.filter(
    (t) =>
      (f.tier === "all" || t.tier === f.tier) &&
      (f.type === "all" || t.type === f.type) &&
      (f.monster === "all" || t.monster === f.monster) &&
      (f.completed === "all" || (f.completed === "complete") === t.completed) &&
      (!q ||
        t.name.toLowerCase().includes(q) ||
        t.monster.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)),
  );
}

/** The item each diary's top reward is, used as the area's icon. */
export const DIARY_AREA_ITEM: Record<number, number> = {
  0: 13103, // Karamja gloves 4
  1: 13124, // Ardougne cloak 4
  2: 13120, // Falador shield 4
  3: 13132, // Fremennik sea boots 4
  4: 13140, // Kandarin headgear 4
  5: 13136, // Desert amulet 4
  6: 13128, // Explorer's ring 4
  7: 13115, // Morytania legs 4
  8: 13107, // Varrock armour 4
  9: 13111, // Wilderness sword 4
  10: 13144, // Western banner 4
  11: 22947, // Rada's blessing 4
};

/** The journal's colours: green done, yellow started, red untouched. */
export function progressTone(completed: number | null | undefined, total: number | null | undefined): string {
  if (completed == null || !total) return "text-osrs-parchment-dark/60";
  if (completed >= total) return "text-osrs-green";
  if (completed > 0) return "text-osrs-gold-bright";
  return "text-osrs-red";
}
