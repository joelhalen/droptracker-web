"use client";

/**
 * Loot Sweep live board, matrix edition (web design pass 2026-07): a
 * collection-log grid — one row per item grouped under collapsible boss
 * header rows, one column per team. Each cell is the team's receipt squares
 * (one per scoring receipt, filled in team color), so a row compares teams
 * on an item and a column reads as a team's whole log. The left rail
 * (points + icon + name) and the viewer's team column are sticky, so the
 * board scrolls horizontally to any number of teams without losing context.
 *
 * Columns rank by overall event score (viewer pinned first); items that cap
 * above 8 receipts render a compact progress bar instead of a wall of
 * squares. Set rows carry per-team completion (uniques got / full-set bonus
 * banked). Realtime: scoring frames on the event SSE scope schedule a
 * DEBOUNCED refetch (≥2s apart) — the payload is whole-board, so bursts of
 * frames coalesce into one consistent reload.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type {
  LootSweepBoard,
  LootSweepGroup,
  LootSweepSet,
  RealtimeEvent,
} from "@droptracker/api-types";
import { fetchEventLootSweep } from "@/app/(site)/(public)/events/[id]/actions";
import { ItemDbIcon } from "@/components/item-db-icon";
import { decaySequence } from "@/lib/loot-sweep";
import {
  buildMatrixRows,
  buildTeamColumns,
  gatingCounts,
  itemCellTitle,
  maxAwardsOf,
  type LootSweepTeamEntry,
  type TeamColumn,
} from "@/lib/loot-sweep-matrix";
import { teamColorMap } from "@/lib/events";
import { useEventStream } from "@/lib/use-event-stream";

const REFETCH_KINDS = new Set(["loot_sweep", "revoke", "completion", "progress"]);
/** Minimum spacing between board refetches — SSE frames arrive in bursts. */
const REFETCH_GAP_MS = 2000;
/** Layout constants (px). Sticky offsets need real numbers, so these live in
 * inline styles rather than Tailwind classes. */
const RAIL_W = 224;
const COL_W = 76;
/** Column width when receipt tabs render as item icons (≤4 teams). */
const COL_W_ICON = 124;
/** Above this many receipts a cell renders a progress bar, not squares. */
const SQUARES_MAX = 8;

const PREVIEW_COLUMN: TeamColumn = {
  id: -1,
  name: "Items",
  color: "#c8a165",
  score: 0,
  rank: 0,
  isViewer: false,
};

function fmt(n: number): string {
  return n.toLocaleString();
}

function groupImg(group: LootSweepGroup): string | null {
  return group.image_url || (group.npc_id != null ? `/img/npcdb/${group.npc_id}.png` : null);
}

function BossArt({ src, size }: { src: string | null; size: number }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      style={{ width: size, height: size }}
      className="shrink-0 object-contain"
      onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
    />
  );
}

/** Receipt squares (≤8 scoring receipts) or a compact bar (9+). With `iconId`
 * set (≤4-team mode), each receipt tab is the item's own icon — grayscale
 * until received, full color once it lands (pets have no icon → squares). */
function ReceiptCell({
  count,
  max,
  color,
  iconId,
  iconSize = 20,
  wide = false,
}: {
  count: number;
  max: number;
  color: string;
  iconId?: number | null;
  /** Icon-tab edge length; scaled up as the field shrinks. */
  iconSize?: number;
  /** Small-field mode: cells stretch, so bars/squares grow with them. */
  wide?: boolean;
}) {
  const filled = Math.min(count, max);
  if (max > SQUARES_MAX) {
    const pct = Math.round((filled / max) * 100);
    return (
      <div className="flex w-full flex-col items-center gap-0.5" aria-label={`${filled} of ${max} received`}>
        <span
          className={`bg-osrs-surface-3 overflow-hidden rounded-full ${
            wide ? "h-[8px] w-4/5 max-w-[150px]" : "h-[6px] w-[44px]"
          }`}
        >
          <span className="block h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </span>
        <span className="text-osrs-parchment-dark/50 text-[10px] leading-none tabular-nums">
          {filled}/{max}
        </span>
      </div>
    );
  }
  if (iconId != null) {
    return (
      <div
        className="flex flex-wrap justify-center gap-[3px] px-1"
        aria-label={`${filled} of ${max} received`}
      >
        {Array.from({ length: max }).map((_, i) => (
          <ItemDbIcon
            key={i}
            itemId={iconId}
            size={iconSize}
            className={i < filled ? "" : "opacity-25 grayscale"}
          />
        ))}
      </div>
    );
  }
  return (
    <div
      className={`flex flex-wrap justify-center ${wide ? "gap-[3px]" : "max-w-[58px] gap-[2px]"}`}
      aria-label={`${filled} of ${max} received`}
    >
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`rounded-[2px] border ${wide ? "h-[13px] w-[13px]" : "h-[9px] w-[9px]"} ${
            i < filled ? "" : "border-osrs-stone/50"
          }`}
          style={i < filled ? { backgroundColor: color, borderColor: color } : undefined}
        />
      ))}
    </div>
  );
}

/** Per-team cell on a set (boss) header row: completion square + uniques. */
function SetCell({
  set,
  gatingGroups,
  team,
  col,
}: {
  set: LootSweepSet;
  gatingGroups: number;
  team: LootSweepTeamEntry | undefined;
  col: TeamColumn;
}) {
  const multiGroup = set.groups.length > 1;
  let done: boolean;
  let frac: string;
  if (multiGroup) {
    const groupsDone = set.groups.filter(
      (g, gi) =>
        g.items.some((it) => it.counts_for_group !== false) &&
        (team?.groups[gi]?.awarded ?? 0) > 0,
    ).length;
    done = (team?.set_awarded ?? 0) > 0;
    frac = `${groupsDone}/${gatingGroups}`;
  } else {
    const counts = gatingCounts(set.groups[0]!, team?.groups[0]);
    done = (team?.groups[0]?.awarded ?? 0) > 0;
    frac = `${counts.got}/${counts.of}`;
  }
  const title =
    `${set.label} — ${col.name}: ${frac} ${multiGroup ? "groups" : "uniques"}` +
    `${done ? " · bonus banked" : ""} · ${fmt(team?.total ?? 0)} pts in this set`;
  return (
    <div className="flex items-center justify-center gap-1" title={title}>
      <span
        className={`h-[13px] w-[13px] rounded-[3px] border ${done ? "" : "border-osrs-stone/50"}`}
        style={done ? { backgroundColor: col.color, borderColor: col.color } : undefined}
      />
      <span className="text-osrs-parchment-dark/50 text-[10px] tabular-nums">{frac}</span>
    </div>
  );
}

export function LootSweepMatrix({
  eventId,
  initial,
  live,
  viewerTeamId,
}: {
  eventId: number;
  initial: LootSweepBoard;
  live: boolean;
  viewerTeamId?: number | null;
}) {
  const [board, setBoard] = useState<LootSweepBoard>(initial);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [, startTransition] = useTransition();

  const refetchNow = useCallback(() => {
    startTransition(async () => {
      try {
        setBoard(await fetchEventLootSweep(eventId));
      } catch {
        /* keep the last good board */
      }
    });
  }, [eventId]);

  // Leading + trailing debounce: an idle frame refetches immediately; a burst
  // schedules exactly one trailing refetch REFETCH_GAP_MS after the last run.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRunAt = useRef(0);
  const scheduleRefetch = useCallback(() => {
    if (timer.current) return;
    const wait = Math.max(0, lastRunAt.current + REFETCH_GAP_MS - Date.now());
    timer.current = setTimeout(() => {
      timer.current = null;
      lastRunAt.current = Date.now();
      refetchNow();
    }, wait);
  }, [refetchNow]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onFrame = useCallback(
    (frame: RealtimeEvent) => {
      if (frame.type !== "event_update") return;
      const kind = (frame.data as { kind?: string }).kind;
      if (kind && REFETCH_KINDS.has(kind)) scheduleRefetch();
    },
    [scheduleRefetch],
  );
  useEventStream(live ? [`event:${eventId}`] : [], onFrame);

  // Colors resolve against the unsorted roster (palette fallbacks stay stable
  // and match the Teams panel); columns then rank by overall score.
  const colors = useMemo(() => teamColorMap(board.teams), [board.teams]);
  const columns = useMemo(
    () => buildTeamColumns(board.teams, viewerTeamId ?? null, colors),
    [board.teams, viewerTeamId, colors],
  );
  const rows = useMemo(() => buildMatrixRows(board.sets), [board.sets]);
  const teamsBySet = useMemo(
    () =>
      new Map(
        board.sets.map((s) => [s.task_id, new Map(s.teams.map((t) => [t.team_id, t]))]),
      ),
    [board.sets],
  );

  if (!board.sets.length) {
    return (
      <p className="text-osrs-parchment-dark/50 text-sm">
        No Loot Sweep sets have been set up for this event yet.
      </p>
    );
  }

  const preview = columns.length === 0;
  const cols = preview ? [PREVIEW_COLUMN] : columns;
  // Small fields get the collection-log treatment: with ≤4 columns there's
  // room to use the item icon itself as each receipt tab, and the columns
  // flex (minmax → 1fr) to fill the page instead of leaving it empty —
  // receipt art scales up with the extra room.
  const iconTabs = cols.length <= 4;
  const iconSize = cols.length <= 2 ? 34 : 28;
  const gridTemplate = iconTabs
    ? `${RAIL_W}px repeat(${cols.length}, minmax(${COL_W_ICON}px, 1fr))`
    : `${RAIL_W}px repeat(${cols.length}, ${COL_W}px)`;

  const toggleSet = (taskId: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });

  // Sticky cells sit above scrolling siblings, so they need opaque backgrounds
  // matching their row (set rows are a surface step up from item rows).
  const railBase = "sticky left-0 z-10 border-osrs-bronze/20 border-r";
  const pinBase = "sticky z-[5] border-osrs-gold/25 border-x";

  return (
    <div className="space-y-3">
      <details className="border-osrs-bronze/25 bg-osrs-surface-1 rounded-lg border px-4 py-2.5 text-sm">
        <summary className="text-osrs-parchment-dark/80 cursor-pointer select-none">
          Each row is a drop, each column a team — squares fill in as a team receives the item.
          <span className="text-osrs-gold-bright ml-1">How scoring works</span>
        </summary>
        <div className="text-osrs-parchment-dark/70 mt-2 space-y-2 leading-relaxed">
          <p>
            Every item is worth its listed points the first time your team receives it, and a
            little less each time after — so spreading out across many bosses beats farming one.
            Hover any cell for exact numbers, including what the next receipt is worth. Items
            that can score many times show a progress bar instead of squares.
          </p>
          <p>
            A boss&apos;s header row tracks the set: collect <em>all</em> of its required uniques
            and your team banks the full-set bonus (the filled square). Rows marked{" "}
            <span className="ring-osrs-gold/40 rounded px-1 ring-1">bonus</span> or{" "}
            <span className="ring-osrs-gold/40 rounded px-1 ring-1">pet</span> still score but
            aren&apos;t needed to complete the set. Click a boss row to collapse it.
          </p>
        </div>
      </details>

      <div className="border-osrs-bronze/25 overflow-x-auto rounded-lg border">
        {/* column headers */}
        <div className="bg-osrs-surface-2 w-max min-w-full" style={{ display: "grid", gridTemplateColumns: gridTemplate }}>
          <div className={`${railBase} bg-osrs-surface-2 text-osrs-parchment-dark/50 flex items-end px-3 pb-2 pt-3 text-[11px] uppercase tracking-wider`}>
            Boss / item
          </div>
          {cols.map((col) => (
            <div
              key={col.id}
              className={`flex flex-col items-center gap-0.5 px-1 pb-2 pt-3 ${
                col.isViewer ? `${pinBase} bg-osrs-surface-2` : ""
              }`}
              style={col.isViewer ? { left: RAIL_W } : undefined}
              title={preview ? "Team progress appears here once teams are added" : `${col.name} — ${fmt(col.score)} pts overall`}
            >
              <span className="flex w-full items-center justify-center gap-1">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
                <span
                  className={`truncate text-[11px] ${
                    col.isViewer ? "text-osrs-gold-bright font-semibold" : "text-osrs-parchment-dark/80"
                  }`}
                >
                  {col.name}
                  {col.isViewer ? " (you)" : ""}
                </span>
              </span>
              {!preview && (
                <>
                  <span className="text-sm font-bold leading-tight tabular-nums" style={{ color: col.color }}>
                    {fmt(col.score)}
                  </span>
                  <span className="text-osrs-parchment-dark/40 text-[10px] leading-none">
                    #{col.rank}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>

        {rows.map((row) => {
          if (row.kind !== "set" && collapsed.has(row.set.task_id)) return null;
          const setTeams = teamsBySet.get(row.set.task_id);

          if (row.kind === "set") {
            const single = row.multiGroup ? null : row.set.groups[0]!;
            const art = single ? groupImg(single) : null;
            const bonus = single ? single.bonus_points : row.set.set_bonus_points;
            const bonusMax = single ? single.bonus_max : row.set.set_bonus_max;
            const isCollapsed = collapsed.has(row.set.task_id);
            return (
              <div
                key={`set-${row.set.task_id}`}
                className="bg-osrs-surface-2 border-osrs-bronze/20 w-max min-w-full border-t"
                style={{ display: "grid", gridTemplateColumns: gridTemplate }}
              >
                <button
                  type="button"
                  onClick={() => toggleSet(row.set.task_id)}
                  aria-expanded={!isCollapsed}
                  className={`${railBase} bg-osrs-surface-2 hover:text-osrs-gold-bright flex items-center gap-2 px-3 py-2 text-left`}
                  title={`${row.set.label} — −${row.set.decay_percent}% per tier (${row.set.decay_mode})${
                    bonus > 0 ? ` · full-set bonus ${fmt(bonus)}${bonusMax > 1 ? ` ×${bonusMax}` : ""}` : ""
                  }. Click to ${isCollapsed ? "expand" : "collapse"}.`}
                >
                  <span className="text-osrs-parchment-dark/50 w-2 text-[10px]">
                    {isCollapsed ? "▸" : "▾"}
                  </span>
                  <BossArt src={art} size={24} />
                  <span className="text-osrs-gold min-w-0 flex-1 truncate text-sm font-semibold">
                    {row.set.label}
                  </span>
                  {bonus > 0 && (
                    <span className="text-osrs-gold-bright text-[11px] tabular-nums">+{fmt(bonus)}</span>
                  )}
                </button>
                {cols.map((col) => (
                  <div
                    key={col.id}
                    className={`flex items-center justify-center py-2 ${
                      col.isViewer ? `${pinBase} bg-osrs-surface-2` : ""
                    }`}
                    style={col.isViewer ? { left: RAIL_W } : undefined}
                  >
                    {!preview && (
                      <SetCell
                        set={row.set}
                        gatingGroups={row.gatingGroups}
                        team={setTeams?.get(col.id)}
                        col={col}
                      />
                    )}
                  </div>
                ))}
              </div>
            );
          }

          if (row.kind === "group") {
            return (
              <div
                key={`group-${row.set.task_id}-${row.groupIdx}`}
                className="bg-osrs-surface-1 border-osrs-bronze/10 w-max min-w-full border-t"
                style={{ display: "grid", gridTemplateColumns: gridTemplate }}
              >
                <div
                  className={`${railBase} bg-osrs-surface-1 flex items-center gap-1.5 py-1.5 pl-7 pr-3`}
                  title={`${row.group.label ?? ""}${row.group.npcs.length ? ` — ${row.group.npcs.join(", ")}` : ""}${
                    row.group.bonus_points ? ` · +${fmt(row.group.bonus_points)} for the set` : ""
                  }`}
                >
                  <BossArt src={groupImg(row.group)} size={18} />
                  <span className="text-osrs-parchment-dark/70 min-w-0 truncate text-xs font-medium">
                    {row.group.label || row.group.npcs[0] || "—"}
                  </span>
                  {row.group.bonus_points > 0 && (
                    <span className="text-osrs-parchment-dark/50 text-[10px] tabular-nums">
                      +{fmt(row.group.bonus_points)}
                    </span>
                  )}
                </div>
                {cols.map((col) => {
                  const tg = setTeams?.get(col.id)?.groups[row.groupIdx];
                  const counts = gatingCounts(row.group, tg);
                  const done = (tg?.awarded ?? 0) > 0;
                  return (
                    <div
                      key={col.id}
                      className={`flex items-center justify-center gap-1 py-1.5 ${
                        col.isViewer ? `${pinBase} bg-osrs-surface-1` : ""
                      }`}
                      style={col.isViewer ? { left: RAIL_W } : undefined}
                      title={
                        preview
                          ? undefined
                          : `${row.group.label || row.group.npcs[0] || "Group"} — ${col.name}: ${counts.got}/${counts.of} uniques${done ? " · bonus banked" : ""}`
                      }
                    >
                      {!preview && (
                        <>
                          <span
                            className={`h-[10px] w-[10px] rounded-[2px] border ${done ? "" : "border-osrs-stone/50"}`}
                            style={done ? { backgroundColor: col.color, borderColor: col.color } : undefined}
                          />
                          <span className="text-osrs-parchment-dark/40 text-[10px] tabular-nums">
                            {counts.got}/{counts.of}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          }

          const max = maxAwardsOf(row.item);
          const isPet = row.item.source === "pet";
          return (
            <div
              key={`item-${row.set.task_id}-${row.groupIdx}-${row.itemIdx}`}
              className="border-osrs-bronze/10 bg-osrs-surface-1 w-max min-w-full border-t"
              style={{
                display: "grid",
                gridTemplateColumns: gridTemplate,
                contentVisibility: "auto",
                containIntrinsicSize: iconTabs ? "auto 48px" : "auto 37px",
              }}
            >
              <div
                className={`${railBase} bg-osrs-surface-1 flex items-center gap-2 py-1.5 pr-3 ${
                  row.set.groups.length > 1 ? "pl-9" : "pl-5"
                }`}
                title={`${row.item.item_name} — points per receipt: ${decaySequence(
                  row.item.points,
                  max,
                  row.set.decay_percent,
                  row.item.awards_per_tier ?? 1,
                  row.set.decay_mode,
                ).join(" / ")}`}
              >
                <span className="text-osrs-parchment-dark/60 w-7 shrink-0 text-right text-xs tabular-nums">
                  {fmt(row.item.points)}
                </span>
                <ItemDbIcon itemId={row.item.item_id} size={22} />
                <span className="text-osrs-parchment min-w-0 flex-1 truncate text-sm">
                  {row.item.item_name}
                </span>
                {isPet && (
                  <span
                    className="text-osrs-gold/70 ring-osrs-gold/30 shrink-0 rounded px-1 text-[9px] font-medium uppercase tracking-wider ring-1"
                    title="Credited from a pet drop"
                  >
                    pet
                  </span>
                )}
                {!row.gates && (
                  <span
                    className="text-osrs-gold/70 ring-osrs-gold/30 shrink-0 rounded px-1 text-[9px] font-medium uppercase tracking-wider ring-1"
                    title="Scores points but isn't needed to complete the set"
                  >
                    bonus
                  </span>
                )}
              </div>
              {cols.map((col) => {
                const prog = setTeams?.get(col.id)?.groups[row.groupIdx]?.items[row.itemIdx];
                return (
                  <div
                    key={col.id}
                    className={`flex items-center justify-center ${iconTabs ? "py-2" : "py-1.5"} ${
                      col.isViewer ? `${pinBase} bg-osrs-surface-1` : ""
                    }`}
                    style={col.isViewer ? { left: RAIL_W } : undefined}
                    title={
                      preview
                        ? undefined
                        : itemCellTitle({
                            teamName: col.name,
                            item: row.item,
                            prog,
                            decayPercent: row.set.decay_percent,
                            decayMode: row.set.decay_mode,
                          })
                    }
                  >
                    <ReceiptCell
                      count={prog?.count ?? 0}
                      max={max}
                      color={col.color}
                      iconId={iconTabs ? row.item.item_id : null}
                      iconSize={iconSize}
                      wide={iconTabs}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {preview && (
        <p className="text-osrs-parchment-dark/40 text-xs">
          No teams yet — each team&apos;s progress appears as a column once teams are added.
        </p>
      )}
    </div>
  );
}
