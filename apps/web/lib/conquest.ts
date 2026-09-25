/**
 * Conquest events (web120a): display helpers and the designer's draft model.
 *
 * The rules live server-side (disc services/conquest.py); this module only
 * formats what the API returns and converts the map to and from the editable
 * draft the designer works on. Pure, so it is unit-tested directly.
 */
import type {
  ConquestBattle,
  ConquestMap,
  ConquestMapInput,
  ConquestSettings,
  ConquestTeam,
  ConquestTile,
  EventTask,
} from "@droptracker/api-types";

/** Logical canvas the schematic map is drawn on (16:10, matches the preset). */
export const CONQUEST_CANVAS = { width: 1600, height: 1000 } as const;

/** Fallback region tints when a region has no colour of its own. */
export const REGION_COLORS = [
  "#9b6a3c",
  "#c9733a",
  "#4f7fa6",
  "#2f8a67",
  "#7a63b0",
  "#a33a32",
  "#5a9a3e",
  "#4b4fa8",
  "#6b5a7e",
  "#c8a24a",
] as const;

export const NEUTRAL_COLOR = "#8a8375";

/** Task types that can drive a tile (mirrors services/conquest.RULE_TASK_TYPES):
 * the ones that count up, so "every N" means something. */
export const RULE_TASK_TYPES = [
  "kc_target",
  "item_collection",
  "xp_target",
  "loot_value",
  "pet_collection",
  "ca_target",
  "slayer_target",
  "custom",
] as const;

/** item_collection list kinds that stay additive (none = a single item). */
const RULE_ITEM_LIST_KINDS = new Set<string | undefined>([undefined, "any_of", "point_collection"]);

/** Can this event task drive a tile rule? */
export function ruleEligible(task: Pick<EventTask, "type" | "config">): boolean {
  if (!(RULE_TASK_TYPES as readonly string[]).includes(task.type)) return false;
  if (task.type !== "item_collection") return true;
  const cfg = parseConfig(task.config);
  const kind = typeof cfg.kind === "string" ? cfg.kind : undefined;
  return RULE_ITEM_LIST_KINDS.has(kind);
}

function parseConfig(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string" && raw) {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** 1234.5 → "1,234.5"; 12 → "12". */
export function fmtPoints(value: number): string {
  const v = Math.round(value * 10) / 10;
  return Number.isInteger(v)
    ? v.toLocaleString("en-US")
    : v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** What a team's current holdings are worth, in the event's scoring terms. */
export function holdingText(
  team: Pick<ConquestTeam, "holding">,
  mode: ConquestSettings["scoring_mode"],
): string {
  return mode === "hold_time"
    ? `+${fmtPoints(team.holding)}/h`
    : `${fmtPoints(team.holding)} if it ended now`;
}

/** One-line description of the rules in force. */
export function settingsSummary(s: ConquestSettings): string {
  const scoring =
    s.scoring_mode === "hold_time"
      ? "Points for every hour a tile is held"
      : "Only the map at the end counts";
  const battles =
    s.battle_mode === "dice"
      ? `${s.attack_dice} attack dice vs up to ${s.defense_dice} defense dice`
      : "Each attack removes one defense (no dice)";
  return `${scoring}. ${battles}. Defense tops out at ${s.max_defense}.`;
}

/** Player-facing words for a battle-log row. No em-dashes (site copy). */
export function battleText(
  b: ConquestBattle,
  names: Map<number, string>,
  tileLabel: string,
): string {
  const team = b.team_id != null ? (names.get(b.team_id) ?? "A team") : "A team";
  const owner =
    b.owner_before != null ? (names.get(b.owner_before) ?? "a team") : "the neutral garrison";
  switch (b.outcome) {
    case "claim":
      return `${team} claimed ${tileLabel}`;
    case "capture":
      return `${team} captured ${tileLabel} from ${owner}`;
    case "breach":
      return `${team} broke through ${tileLabel}'s defenses`;
    case "attack":
      return `${team} attacked ${tileLabel} (${owner}): defense ${b.defense_before} to ${b.defense_after}`;
    case "repelled":
      return `${owner} held ${tileLabel} against ${team}`;
    case "adjust": {
      const who = b.owner_after != null ? (names.get(b.owner_after) ?? "a team") : "nobody";
      return `An organiser set ${tileLabel} to ${who}`;
    }
    default:
      return `${team} reinforced ${tileLabel}`;
  }
}

/** "6 · 3 vs 5" for rows that rolled dice, else null. */
export function diceText(b: Pick<ConquestBattle, "attack_dice" | "defense_dice">): string | null {
  if (!b.attack_dice.length) return null;
  return `${b.attack_dice.join(" · ")} vs ${b.defense_dice.join(" · ")}`;
}

/** Team id → colour for the map: the team's own colour, else the palette
 * slot by roster order (same rule as teamColorMap in lib/events). */
export function conquestTeamColors(
  teams: { id: number; color?: string | null }[],
  palette: readonly string[],
): Map<number, string> {
  return new Map(teams.map((t, i) => [t.id, t.color ?? palette[i % palette.length]!]));
}

/** Tiles grouped by region id (null = no region), in map order. */
export function tilesByRegion(tiles: ConquestTile[]): Map<number | null, ConquestTile[]> {
  const out = new Map<number | null, ConquestTile[]>();
  for (const t of tiles) {
    const list = out.get(t.region_id) ?? [];
    list.push(t);
    out.set(t.region_id, list);
  }
  return out;
}

/** Where a region's label goes: its stored anchor, else just above its
 * tiles' centre. Fractions of the canvas. */
export function regionLabelPoint(
  region: { label_x: number | null; label_y: number | null },
  tiles: { x: number; y: number }[],
): { x: number; y: number } {
  if (region.label_x != null && region.label_y != null)
    return { x: region.label_x, y: region.label_y };
  if (!tiles.length) return { x: 0.5, y: 0.5 };
  const x = tiles.reduce((a, t) => a + t.x, 0) / tiles.length;
  const top = Math.min(...tiles.map((t) => t.y));
  return { x, y: Math.max(top - 0.08, 0.03) };
}

/* ── Region control (the Risk part) ─────────────────────────────────────── */

export type RegionStanding = {
  /** Tiles that count toward control (respawn points never do). */
  total: number;
  /** Tiles each team holds here, most first. */
  counts: { teamId: number; tiles: number }[];
  unowned: number;
  /** The team holding every tile, if one does. */
  controller: number | null;
  /** The team holding the most tiles, when no other team ties it. */
  leader: number | null;
};

type StandingTile = Pick<ConquestTile, "id" | "kind" | "owner_team_id">;

/** Who holds what in one region. */
export function regionStanding(tiles: StandingTile[]): RegionStanding {
  const counted = tiles.filter((t) => t.kind !== "respawn");
  const by = new Map<number, number>();
  let unowned = 0;
  for (const t of counted) {
    if (t.owner_team_id == null) unowned += 1;
    else by.set(t.owner_team_id, (by.get(t.owner_team_id) ?? 0) + 1);
  }
  const counts = [...by.entries()]
    .map(([teamId, n]) => ({ teamId, tiles: n }))
    .sort((a, b) => b.tiles - a.tiles || a.teamId - b.teamId);
  const top = counts[0];
  const tied = counts.length > 1 && counts[1]!.tiles === top?.tiles;
  const total = counted.length;
  return {
    total,
    counts,
    unowned,
    controller: top && total > 0 && top.tiles === total ? top.teamId : null,
    leader: top && !tied ? top.teamId : null,
  };
}

/** The tiles a team still has to take to control the region. */
export function tilesToControl<T extends StandingTile>(tiles: T[], teamId: number): T[] {
  return tiles.filter((t) => t.kind !== "respawn" && t.owner_team_id !== teamId);
}

/** One plain line on where a region stands. No em-dashes (site copy). */
export function regionStatusText(standing: RegionStanding, names: Map<number, string>): string {
  const name = (id: number) => names.get(id) ?? "A team";
  const { total, counts, controller, leader } = standing;
  if (!total) return "No tiles to hold here.";
  if (controller != null) return `${name(controller)} controls it, all ${total} tiles.`;
  if (!counts.length) return `Unclaimed. Hold all ${total} tiles to take control.`;
  if (leader != null) {
    const have = counts[0]!.tiles;
    const need = total - have;
    return `${name(leader)} leads with ${have} of ${total}, ${need} more to take control.`;
  }
  const tiedAt = counts[0]!.tiles;
  const tiedNames = counts.filter((c) => c.tiles === tiedAt).map((c) => name(c.teamId));
  return `Contested: ${tiedNames.join(", ")} hold ${tiedAt} of ${total} each.`;
}

/** What control is worth, in the event's scoring terms. */
export function regionBonusText(
  bonus: number,
  mode: ConquestSettings["scoring_mode"],
  total: number,
): string {
  const pts = `${fmtPoints(bonus)} ${bonus === 1 ? "point" : "points"}`;
  return mode === "hold_time"
    ? `Hold all ${total} for +${pts} an hour.`
    : `Hold all ${total} at the end for +${pts}.`;
}

/* ── The designer's draft model ─────────────────────────────────────────── */

export type DraftRule = { task_id: number; troops: number; label: string };
export type DraftRegion = {
  key: string;
  name: string;
  color: string | null;
  bonus: number;
  label_x: number | null;
  label_y: number | null;
  /** Outline on a drawn map (web121a); carried through saves untouched. */
  shape: string | null;
};
export type DraftTile = {
  key: string;
  label: string;
  x: number;
  y: number;
  kind: "normal" | "respawn";
  value: number;
  region_key: string | null;
  icon_npc_id: number | null;
  icon_item_id: number | null;
  /** Territory on a drawn map (web121a); carried through saves untouched. */
  shape: string | null;
  rules: DraftRule[];
};
export type ConquestDraft = { regions: DraftRegion[]; tiles: DraftTile[] };

/** The server map as an editable draft (stable keys from row ids). */
export function draftFromMap(map: ConquestMap): ConquestDraft {
  const regionKey = new Map(map.regions.map((r) => [r.id, `r${r.id}`]));
  return {
    regions: map.regions.map((r) => ({
      key: `r${r.id}`,
      name: r.name,
      color: r.color,
      bonus: r.bonus,
      label_x: r.label_x,
      label_y: r.label_y,
      shape: r.shape ?? null,
    })),
    tiles: map.tiles.map((t) => ({
      key: `t${t.id}`,
      label: t.label,
      x: t.x,
      y: t.y,
      kind: t.kind === "respawn" ? "respawn" : "normal",
      value: t.value,
      region_key: t.region_id != null ? (regionKey.get(t.region_id) ?? null) : null,
      icon_npc_id: t.icon_npc_id,
      icon_item_id: t.icon_item_id,
      shape: t.shape ?? null,
      rules: t.rules.map((r) => ({ task_id: r.task_id, troops: r.troops, label: r.label })),
    })),
  };
}

/** The draft as the PUT body. */
export function draftToInput(draft: ConquestDraft, revision: number): ConquestMapInput {
  return {
    revision,
    regions: draft.regions.map((r) => ({
      key: r.key,
      name: r.name.trim(),
      color: r.color,
      bonus: r.bonus,
      label_x: r.label_x,
      label_y: r.label_y,
      shape: r.shape,
    })),
    tiles: draft.tiles.map((t) => ({
      key: t.key,
      label: t.label.trim(),
      x: clamp01(t.x),
      y: clamp01(t.y),
      kind: t.kind,
      value: t.value,
      region_key: t.region_key,
      icon_npc_id: t.icon_npc_id,
      icon_item_id: t.icon_item_id,
      shape: t.shape,
      rules:
        t.kind === "respawn" ? [] : t.rules.map((r) => ({ task_id: r.task_id, troops: r.troops })),
    })),
  };
}

/** Problems the server would 422 on, found before saving. */
export function draftProblems(draft: ConquestDraft): string[] {
  const out: string[] = [];
  const used = new Map<number, string>();
  for (const r of draft.regions) {
    if (!r.name.trim()) out.push("Every region needs a name.");
  }
  for (const t of draft.tiles) {
    if (!t.label.trim()) out.push("Every tile needs a name.");
    if (t.kind === "normal" && t.rules.length === 0) {
      out.push(`${t.label || "A tile"} has nothing that earns troops.`);
    }
    for (const rule of t.rules) {
      const other = used.get(rule.task_id);
      if (other != null && other !== t.key) {
        out.push(`${rule.label} drives two tiles. A task can drive only one.`);
      }
      used.set(rule.task_id, t.key);
    }
  }
  return [...new Set(out)];
}

export function clamp01(v: number): number {
  return Math.min(Math.max(Number.isFinite(v) ? v : 0.5, 0.01), 0.99);
}

/** A fresh key for a tile or region the designer adds. */
export function newKey(prefix: "t" | "r", taken: Iterable<string>): string {
  const set = new Set(taken);
  let n = 1;
  while (set.has(`${prefix}new${n}`)) n += 1;
  return `${prefix}new${n}`;
}
