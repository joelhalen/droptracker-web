"use client";

/** SOTW/BOTW breakdown: the standings split into their parts, so a clan
 * running a multi-boss race (or a pile of bonus rules) can read "how many
 * Vardorvis kills did Red get" or "who earned the orb bonus" without adding
 * up expanded rows by hand.
 *
 * Rows are teams or players; columns are either kills per boss or points per
 * bonus rule, each with its total. Every header sorts, the footer sums the
 * visible rows, and the CSV carries every column at once. Pure view over the
 * board payload: `by_npc` / `bonus_by_rule` on team rows, `by_npc` / `bonus`
 * on player rows. */

import { useMemo, useState } from "react";
import type {
  CompetitionStandingRow,
  CompetitionTeamStanding,
  EventCompetitionBoard,
} from "@droptracker/api-types";
import { ToggleChip } from "@droptracker/ui";
import { isTeamRace } from "@/lib/competition";

/** The `by_npc` key for kills recorded without a boss (pre-tagging rows,
 * WOM-only participants). */
const OTHER = "";

/** The pinned name column (the boss/rule columns scroll under it). */
const RAIL = "sticky left-0 z-10 border-osrs-bronze/20 border-r";

type Unit = "teams" | "players";
type ColumnSet = "boss" | "bonus";

interface Column {
  key: string;
  label: string;
  title?: string;
  icon?: string;
  /** Emphasized total column. */
  total?: boolean;
}

interface BreakdownRow {
  key: string;
  rank: number;
  name: string;
  color?: string;
  team?: string | null;
  values: Record<string, number>;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function sumValues(map: Record<string, number> | undefined): number {
  return Object.values(map ?? {}).reduce((a, b) => a + (Number(b) || 0), 0);
}

/** A player row's per-rule points, from its bonus slots. */
function rulePoints(row: CompetitionStandingRow): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [rid, slot] of Object.entries(row.bonus ?? {})) {
    if (slot.points) out[rid] = slot.points;
  }
  return out;
}

/** Kills per boss, with any gained the split can't place under OTHER — a
 * WOM-only row carries no split, and the parts must still sum to gained. */
function killsByNpc(byNpc: Record<string, number> | undefined, gained: number) {
  const out: Record<string, number> = { ...(byNpc ?? {}) };
  const rest = gained - sumValues(out);
  if (rest > 0) out[OTHER] = (out[OTHER] ?? 0) + rest;
  return out;
}

/** Whether the board has a per-boss split worth showing: a multi-boss race
 * with at least some kills tagged to a boss. */
export function hasBossBreakdown(board: EventCompetitionBoard): boolean {
  const npcs = board.competition.metric.npcs ?? [];
  if (board.competition.metric.kind !== "boss" || npcs.length < 2) return false;
  const tagged = (m: Record<string, number> | undefined) =>
    Object.entries(m ?? {}).some(([k, v]) => k !== OTHER && v > 0);
  return board.standings.some((r) => tagged(r.by_npc)) || (board.teams ?? []).some((t) => tagged(t.by_npc));
}

/** Rule id the backend files an organiser's manual bonus points under
 * (`services.competition.MANUAL_RULE_ID` — never a configured rule). */
const MANUAL_RULE_KEY = "0";

function hasManualBonus(board: EventCompetitionBoard): boolean {
  return board.standings.some((r) => (r.bonus?.[MANUAL_RULE_KEY]?.points ?? 0) > 0);
}

export function hasBreakdown(board: EventCompetitionBoard): boolean {
  return (
    hasBossBreakdown(board) || board.competition.bonus_rules.length > 0 || hasManualBonus(board)
  );
}

export function CompetitionBreakdown({
  board,
  accents,
  teamId = null,
  teamFilter = null,
  exportable = true,
}: {
  board: EventCompetitionBoard;
  accents: Map<number, string>;
  /** A team page: players of this team only, no team rows. */
  teamId?: number | null;
  /** The standings' team filter chip, applied to the player rows. */
  teamFilter?: number | null;
  /** CSV download (off inside the Discord Activity's iframe). */
  exportable?: boolean;
}) {
  const { competition } = board;
  const teamRace = isTeamRace(competition) && (board.teams?.length ?? 0) > 0;
  const bossAvailable = hasBossBreakdown(board);
  const manualBonus = hasManualBonus(board);
  const bonusAvailable = competition.bonus_rules.length > 0 || manualBonus;
  const pointsMode = competition.ranking.mode === "points";
  const canTeams = teamRace && teamId == null;

  const [unitChoice, setUnit] = useState<Unit>("teams");
  const unit: Unit = canTeams ? unitChoice : "players";
  const [setChoice, setColumnSet] = useState<ColumnSet>("boss");
  const columnSet: ColumnSet = !bossAvailable ? "bonus" : !bonusAvailable ? "boss" : setChoice;
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);

  // Boss columns in the race's own order, icons from the id map (keyed by
  // the DB's casing, so match case-insensitively).
  const npcIcons = useMemo(() => {
    const byLower = new Map<string, number>();
    for (const [name, id] of Object.entries(competition.metric.npc_ids ?? {})) {
      byLower.set(name.toLowerCase(), id);
    }
    return byLower;
  }, [competition.metric.npc_ids]);

  const teamRows: BreakdownRow[] = useMemo(
    () =>
      (board.teams ?? []).map((t: CompetitionTeamStanding) => ({
        key: `t${t.team_id}`,
        rank: t.rank,
        name: t.name,
        color: accents.get(t.team_id),
        values: {
          ...prefixed("k:", killsByNpc(t.by_npc, t.gained)),
          ...prefixed("b:", t.bonus_by_rule ?? {}),
          gained: t.gained,
          bonus: t.bonus_points,
          points: t.points,
        },
      })),
    [board.teams, accents],
  );

  const scopeTeam = teamId ?? teamFilter;
  const playerRows: BreakdownRow[] = useMemo(
    () =>
      board.standings
        .filter((r) => scopeTeam == null || r.team_id === scopeTeam)
        .map((r) => ({
          key: `p${r.player_id ?? "w"}-${r.wom_player_id ?? r.rank}`,
          rank: r.rank,
          name: r.player_name,
          color: r.team_id != null ? accents.get(r.team_id) : undefined,
          team: r.team_name ?? null,
          values: {
            ...prefixed("k:", killsByNpc(r.by_npc, r.gained)),
            ...prefixed("b:", rulePoints(r)),
            gained: r.gained,
            bonus: r.bonus_points,
            points: r.points,
          },
        })),
    [board.standings, scopeTeam, accents],
  );

  const baseRows = unit === "teams" ? teamRows : playerRows;

  const bossColumns: Column[] = useMemo(() => {
    const cols: Column[] = (competition.metric.npcs ?? []).map((npc) => {
      const id = npcIcons.get(npc.toLowerCase());
      return {
        key: `k:${npc}`,
        label: titleCase(npc),
        icon: id != null ? `/img/npcdb/${id}.png` : undefined,
      };
    });
    if (baseRows.some((r) => (r.values[`k:${OTHER}`] ?? 0) > 0)) {
      cols.push({
        key: `k:${OTHER}`,
        label: "Other",
        title: "Kills with no boss on record: WiseOldMan-only players, or kills logged before the per-boss split",
      });
    }
    cols.push({ key: "gained", label: "Total KC", total: true });
    return cols;
  }, [competition.metric.npcs, npcIcons, baseRows]);

  const bonusColumns: Column[] = useMemo(
    () => [
      ...competition.bonus_rules.map((r) => ({
        key: `b:${r.id}`,
        label: r.label,
        title: r.scope_line ? `${r.label} (${r.scope_line})` : r.label,
      })),
      ...(manualBonus
        ? [{ key: `b:${MANUAL_RULE_KEY}`, label: "Manual", title: "Bonus points awarded by an organiser" }]
        : []),
      { key: "bonus", label: "Bonus total", total: true },
    ],
    [competition.bonus_rules, manualBonus],
  );

  const columns = useMemo(() => {
    const cols = columnSet === "boss" ? [...bossColumns] : [...bonusColumns];
    if (pointsMode) cols.push({ key: "points", label: "Points", total: true });
    return cols;
  }, [columnSet, bossColumns, bonusColumns, pointsMode]);

  const rows = useMemo(() => {
    if (!sort) return baseRows;
    const dir = sort.desc ? -1 : 1;
    return [...baseRows].sort((a, b) => {
      const d = ((a.values[sort.key] ?? 0) - (b.values[sort.key] ?? 0)) * dir;
      return d !== 0 ? d : a.rank - b.rank;
    });
  }, [baseRows, sort]);

  const totals = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of baseRows) {
      for (const [k, v] of Object.entries(r.values)) out[k] = (out[k] ?? 0) + v;
    }
    return out;
  }, [baseRows]);

  const onSort = (key: string) =>
    setSort((cur) => (cur?.key === key ? (cur.desc ? { key, desc: false } : null) : { key, desc: true }));

  const downloadCsv = () => {
    const cols = [
      ...(bossAvailable ? bossColumns : [{ key: "gained", label: "Total KC" } as Column]),
      ...(bonusAvailable ? bonusColumns : []),
      ...(pointsMode ? [{ key: "points", label: "Points" } as Column] : []),
    ];
    const head = ["Rank", unit === "teams" ? "Team" : "Player", ...(unit === "players" && teamRace ? ["Team"] : [])];
    const lines = [
      [...head, ...cols.map((c) => c.label)],
      ...rows.map((r) => [
        String(r.rank),
        r.name,
        ...(unit === "players" && teamRace ? [r.team ?? ""] : []),
        ...cols.map((c) => String(r.values[c.key] ?? 0)),
      ]),
    ];
    const csv = lines.map((l) => l.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `event-${board.event_id}-${unit}-breakdown.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {canTeams && (
          <div className="flex gap-1" role="group" aria-label="Break down by">
            <ToggleChip active={unit === "teams"} onClick={() => setUnit("teams")}>
              Teams
            </ToggleChip>
            <ToggleChip active={unit === "players"} onClick={() => setUnit("players")}>
              Players
            </ToggleChip>
          </div>
        )}
        {bossAvailable && bonusAvailable && (
          <div className="flex gap-1" role="group" aria-label="Columns">
            <ToggleChip active={columnSet === "boss"} onClick={() => setColumnSet("boss")}>
              Kills by boss
            </ToggleChip>
            <ToggleChip active={columnSet === "bonus"} onClick={() => setColumnSet("bonus")}>
              Bonus by rule
            </ToggleChip>
          </div>
        )}
        {exportable && rows.length > 0 && (
          <button
            type="button"
            onClick={downloadCsv}
            className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright ml-auto text-xs underline-offset-2 hover:underline"
          >
            Download CSV
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-osrs-parchment-dark/50 px-1 py-4 text-sm">Nothing to break down yet.</p>
      ) : (
        <div className="border-osrs-bronze/30 overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-osrs-bronze/30 text-osrs-parchment-dark/60 border-b text-left text-xs">
                <th className={`${RAIL} bg-osrs-surface-2 min-w-[9rem] px-2.5 py-2 font-normal`}>
                  {unit === "teams" ? "Team" : "Player"}
                </th>
                {columns.map((c) => {
                  const active = sort?.key === c.key;
                  return (
                    <th
                      key={c.key}
                      aria-sort={active ? (sort!.desc ? "descending" : "ascending") : "none"}
                      className="px-2.5 py-2 text-right font-normal"
                    >
                      <button
                        type="button"
                        onClick={() => onSort(c.key)}
                        title={c.title ?? `Sort by ${c.label}`}
                        className={`inline-flex max-w-[9rem] items-center justify-end gap-1 ${
                          active ? "text-osrs-gold-bright" : "hover:text-osrs-parchment"
                        } ${c.total ? "font-medium" : ""}`}
                      >
                        {c.icon && (
                          <img src={c.icon} alt="" className="h-4 w-4 shrink-0 object-contain" />
                        )}
                        <span className="truncate">{c.label}</span>
                        <span aria-hidden className="w-2 shrink-0 text-[10px]">
                          {active ? (sort!.desc ? "▼" : "▲") : ""}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-osrs-bronze/15 border-b">
                  <td className={`${RAIL} bg-osrs-surface-1 px-2.5 py-1.5`}>
                    <span className="inline-flex max-w-[13rem] items-center gap-1.5">
                      <span className="text-osrs-parchment-dark/50 w-6 shrink-0 text-xs tabular-nums">
                        {r.rank}
                      </span>
                      {r.color && (
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: r.color }}
                        />
                      )}
                      <span className="text-osrs-parchment truncate">{r.name}</span>
                    </span>
                  </td>
                  {columns.map((c) => {
                    const v = r.values[c.key] ?? 0;
                    return (
                      <td
                        key={c.key}
                        className={`px-2.5 py-1.5 text-right tabular-nums ${
                          c.total
                            ? "text-osrs-gold-bright font-medium"
                            : v
                              ? "text-osrs-parchment"
                              : "text-osrs-parchment-dark/30"
                        }`}
                      >
                        {v ? v.toLocaleString("en-US") : "·"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-osrs-bronze/30 text-osrs-parchment-dark/80 border-t text-xs">
                <td className={`${RAIL} bg-osrs-surface-2 px-2.5 py-2`}>
                  Total{unit === "players" && scopeTeam != null ? " (this team)" : ""}
                </td>
                {columns.map((c) => (
                  <td key={c.key} className="px-2.5 py-2 text-right font-medium tabular-nums">
                    {(totals[c.key] ?? 0).toLocaleString("en-US")}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="text-osrs-parchment-dark/40 text-[11px]">
        {columnSet === "boss"
          ? "Kills gained at each boss. "
          : "Bonus points each rule paid out. "}
        Tap a column to sort.
      </p>
    </div>
  );
}

function prefixed(prefix: string, map: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(map)) out[`${prefix}${k}`] = Number(v) || 0;
  return out;
}

function csvCell(value: string): string {
  // Leading =, +, - or @ would run as a formula in a spreadsheet; player and
  // rule names are user-chosen.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
