/**
 * Loot Sweep matrix board — pure row/column shaping for the collection-log
 * view (item rows grouped under boss header rows, one column per team).
 * Kept out of the component so the flattening, ordering, and tooltip rules
 * are unit-testable (test/loot-sweep-matrix.test.ts).
 */
import type {
  LootSweepBoard,
  LootSweepConfigItem,
  LootSweepGroup,
  LootSweepSet,
} from "@droptracker/api-types";
import { defaultMaxAwards, itemTotal, receiptPoints } from "./loot-sweep";

export type LootSweepTeamEntry = LootSweepSet["teams"][number];
export type LootSweepTeamGroupEntry = LootSweepTeamEntry["groups"][number];

/** One rendered row of the matrix. `group` rows appear only in meta-sets
 * (Barrows, DKs) — a single-boss set goes straight from its header to items. */
export type MatrixRow =
  | { kind: "set"; set: LootSweepSet; multiGroup: boolean; gatingGroups: number }
  | { kind: "group"; set: LootSweepSet; group: LootSweepGroup; groupIdx: number }
  | {
      kind: "item";
      set: LootSweepSet;
      group: LootSweepGroup;
      groupIdx: number;
      item: LootSweepConfigItem;
      /** Index into group.items — SAME index into a team's `groups[gi].items`. */
      itemIdx: number;
      /** false = scoring extra (pet / mega-rare) that doesn't gate the group. */
      gates: boolean;
    };

/** A team column, ranked by overall event score (viewer pinned first). */
export type TeamColumn = {
  id: number;
  name: string;
  color: string;
  score: number;
  rank: number;
  isViewer: boolean;
};

/** Total scoring receipts for an item (the number of squares its cells get). */
export function maxAwardsOf(item: LootSweepConfigItem): number {
  return item.max_awards ?? defaultMaxAwards(item.awards_per_tier ?? 1);
}

/** Game ids of the piece icons an entry displays: the resolved `icon_ids` from
 * the board (a pooled/virtual entry shows all its pieces), falling back to the
 * single primary icon. */
export function iconIdsOf(item: LootSweepConfigItem): number[] {
  if (item.icon_ids && item.icon_ids.length) return item.icon_ids;
  return item.item_id != null ? [item.item_id] : [];
}

/** Points a group is worth when cleared once: each gating entry's first
 * `required` receipts (a pooled "any 3" entry counts three receipts), plus its
 * completion bonus. */
export function groupClearPoints(group: LootSweepGroup, decayPercent: number, decayMode: LootSweepSet["decay_mode"]): number {
  let pts = 0;
  for (const it of group.items) {
    if (it.counts_for_group === false) continue;
    pts += itemTotal(it.points, it.required ?? 1, maxAwardsOf(it), decayPercent, it.awards_per_tier ?? 1, decayMode);
  }
  return round2(pts + group.bonus_points);
}

/** Points a whole set is worth when fully cleared once — each group cleared
 * plus the whole-set bonus. This is the "complete the section for N pts"
 * headline shown beside the boss art. */
export function sectionClearPoints(set: LootSweepSet): number {
  let pts = 0;
  for (const g of set.groups) pts += groupClearPoints(g, set.decay_percent, set.decay_mode);
  return round2(pts + set.set_bonus_points);
}

/** Theoretical maximum a set can yield (every item maxed, all bonuses at their
 * repeat cap) — the tooltip's "up to N". */
export function sectionMaxPoints(set: LootSweepSet): number {
  let pts = 0;
  for (const g of set.groups) {
    for (const it of g.items) {
      pts += itemTotal(it.points, maxAwardsOf(it), maxAwardsOf(it), set.decay_percent, it.awards_per_tier ?? 1, set.decay_mode);
    }
    pts += g.bonus_points * (g.bonus_max ?? 1);
  }
  return round2(pts + set.set_bonus_points * (set.set_bonus_max ?? 1));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Flatten sets → groups → items into the matrix's row list. Within a group,
 * gating items keep config order and bonus items follow them, so the "bonus"
 * rows always sit at the bottom of their boss block. */
export function buildMatrixRows(sets: LootSweepSet[]): MatrixRow[] {
  const rows: MatrixRow[] = [];
  for (const set of sets) {
    const multiGroup = set.groups.length > 1;
    const gatingGroups = set.groups.filter((g) =>
      g.items.some((it) => it.counts_for_group !== false),
    ).length;
    rows.push({ kind: "set", set, multiGroup, gatingGroups });
    set.groups.forEach((group, groupIdx) => {
      if (multiGroup) rows.push({ kind: "group", set, group, groupIdx });
      const indexed = group.items.map((item, itemIdx) => ({ item, itemIdx }));
      const gating = indexed.filter(({ item }) => item.counts_for_group !== false);
      const bonus = indexed.filter(({ item }) => item.counts_for_group === false);
      for (const { item, itemIdx } of [...gating, ...bonus]) {
        rows.push({
          kind: "item",
          set,
          group,
          groupIdx,
          item,
          itemIdx,
          gates: item.counts_for_group !== false,
        });
      }
    });
  }
  return rows;
}

/** Order teams into columns: overall score descending (rank), viewer's team
 * pulled to the front with its rank kept. `colors` should come from
 * `teamColorMap` over the UNSORTED roster so palette fallbacks stay stable. */
export function buildTeamColumns(
  teams: LootSweepBoard["teams"],
  viewerTeamId: number | null,
  colors: Map<number, string>,
): TeamColumn[] {
  const ranked = [...teams]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((t, i) => ({
      id: t.id,
      name: t.name,
      color: colors.get(t.id) ?? "#c8a165",
      score: t.score,
      rank: i + 1,
      isViewer: viewerTeamId != null && t.id === viewerTeamId,
    }));
  const viewerIdx = ranked.findIndex((t) => t.isViewer);
  if (viewerIdx > 0) ranked.unshift(ranked.splice(viewerIdx, 1)[0]!);
  return ranked;
}

/** Gating-item completion within one group: how many of the group's gating
 * entries the team has satisfied — an entry with `required: 3` (an "any 3
 * ancestral pieces" pool) only counts once 3 receipts have landed. */
export function gatingCounts(
  group: LootSweepGroup,
  teamGroup: LootSweepTeamGroupEntry | undefined,
): { got: number; of: number } {
  let got = 0;
  let of = 0;
  group.items.forEach((item, i) => {
    if (item.counts_for_group === false) return;
    of += 1;
    if ((teamGroup?.items[i]?.count ?? 0) >= (item.required ?? 1)) got += 1;
  });
  return { got, of };
}

/** Point formatter: thousands separators, up to 2 decimals, trailing zeros
 * trimmed — 1200 → "1,200", 0.8 → "0.8", 3.0 → "3". */
export function fmtPoints(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const fmt = fmtPoints;

/** Compact relative time for receipt rows: "just now", "5m ago", "3h ago",
 * "2d ago", "3w ago". Hours run to 48 before switching to days so "yesterday
 * evening" doesn't collapse into a bare "1d". */
export function timeAgo(epochSec: number | null | undefined, nowMs = Date.now()): string {
  if (!epochSec) return "";
  const s = Math.max(0, Math.floor(nowMs / 1000) - epochSec);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

/** Hover text for one item × team cell — receipts, banked points, and what
 * the NEXT receipt is worth (the decay made tangible). */
export function itemCellTitle(args: {
  teamName: string;
  item: LootSweepConfigItem;
  prog: { count: number; scored: number; points: number } | undefined;
  decayPercent: number;
  decayMode: LootSweepSet["decay_mode"];
}): string {
  const { teamName, item, prog, decayPercent, decayMode } = args;
  const max = maxAwardsOf(item);
  const apt = item.awards_per_tier ?? 1;
  const required = item.required ?? 1;
  const head = `${item.item_name} — ${teamName}`;
  const need = required > 1 ? ` · needs ${required} for the set` : "";
  if (!prog || prog.count === 0) {
    const batch = apt > 1 ? ` (full points ×${apt} at a time)` : "";
    return `${head}: worth ${fmt(item.points)} each, up to ${max}${batch}${need}`;
  }
  const tail =
    prog.scored >= max
      ? `capped (${max}/${max} scored)`
      : `next worth ${fmt(receiptPoints(item.points, prog.scored + 1, decayPercent, apt, decayMode))}`;
  return `${head}: ${prog.count} received · ${fmt(prog.points)} pts banked · ${tail}${need}`;
}
