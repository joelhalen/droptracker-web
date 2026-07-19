"use client";

/**
 * Loot Sweep live board, matrix edition (web design pass 2026-07): a
 * collection-log grid — one row per item grouped under collapsible boss
 * header rows, one column per team. Each cell is the team's receipt tabs
 * (one per scoring receipt, filled in team color), so a row compares teams
 * on an item and a column reads as a team's whole log. The left rail
 * (points + icon + name) is sticky, the viewer's team column is pinned, and
 * the team header row lives in its own scroll-synced strip that PINS below
 * the site nav — scores stay visible however deep the page scrolls.
 *
 * Cells adapt to the field: ≤4 columns go elastic (minmax → 1fr, full page
 * width) with the item's own icon as each receipt tab (grayscale until
 * received) and tab counts up to 25; bigger fields use compact squares and
 * fall back to a progress bar past 8 receipts. Set/group header cells tally
 * one box per required unique. Hovering any cell opens the site's standard
 * rich hover card (who pulled each receipt, when, points, screenshot proof),
 * lazily fetched per item and cached until the next scoring frame.
 *
 * Realtime: scoring frames on the event SSE scope schedule a DEBOUNCED
 * refetch (≥2s apart) — the payload is whole-board, so bursts coalesce into
 * one consistent reload.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type {
  LootSweepBoard,
  LootSweepGroup,
  LootSweepSet,
  RealtimeEvent,
} from "@droptracker/api-types";
import { fetchEventLootSweep } from "@/app/(site)/(public)/events/[id]/actions";
import { HoverCard } from "@/components/hover-card";
import { ItemDbIcon } from "@/components/item-db-icon";
import {
  LootSweepReceiptCard,
  clearLootSweepReceiptsCache,
} from "@/components/loot-sweep-receipt-card";
import { decaySequence } from "@/lib/loot-sweep";
import {
  buildMatrixRows,
  buildTeamColumns,
  fmtPoints,
  gatingCounts,
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
/** Column width floor when receipt tabs render as item icons (≤4 teams). */
const COL_W_ICON = 124;
/** Tab-count ceilings before a cell falls back to the progress bar: narrow
 * columns cap early; elastic small-field columns show every receipt (the
 * template tops out at 25). */
const SQUARES_MAX = 8;
const WIDE_TABS_MAX = 25;

const PREVIEW_COLUMN: TeamColumn = {
  id: -1,
  name: "Items",
  color: "#c8a165",
  score: 0,
  rank: 0,
  isViewer: false,
};

const fmt = fmtPoints;

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

/** Receipt tabs — item icons in small-field mode, squares otherwise — with a
 * compact progress bar once the cap outgrows the mode's tab ceiling. */
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
  /** Small-field mode: cells stretch, so tabs/bars grow with them. */
  wide?: boolean;
}) {
  const filled = Math.min(count, max);
  if (max > (wide ? WIDE_TABS_MAX : SQUARES_MAX)) {
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
        className="flex max-w-full flex-wrap justify-center gap-[3px] px-1"
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

/** Section tally: one box per required unique (or per group on a meta-set),
 * filled as collected; a gold ring marks the bonus banked. */
function TallyBoxes({
  got,
  of,
  color,
  done,
  wide,
}: {
  got: number;
  of: number;
  color: string;
  done: boolean;
  wide: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap justify-center gap-[2px] ${wide ? "max-w-[118px]" : "max-w-[58px]"} ${
        done ? "ring-osrs-gold/50 rounded-[3px] p-0.5 ring-1" : ""
      }`}
      aria-label={`${got} of ${of} collected${done ? ", bonus banked" : ""}`}
    >
      {Array.from({ length: of }).map((_, i) => (
        <span
          key={i}
          className={`rounded-[2px] border ${wide ? "h-[11px] w-[11px]" : "h-[9px] w-[9px]"} ${
            i < got ? "" : "border-osrs-stone/50"
          }`}
          style={i < got ? { backgroundColor: color, borderColor: color } : undefined}
        />
      ))}
    </div>
  );
}

/** Per-team cell on a set (boss) header row. */
function SetCell({
  set,
  gatingGroups,
  team,
  col,
  wide,
}: {
  set: LootSweepSet;
  gatingGroups: number;
  team: LootSweepTeamEntry | undefined;
  col: TeamColumn;
  wide: boolean;
}) {
  const multiGroup = set.groups.length > 1;
  let done: boolean;
  let got: number;
  let of: number;
  if (multiGroup) {
    got = set.groups.filter(
      (g, gi) =>
        g.items.some((it) => it.counts_for_group !== false) &&
        (team?.groups[gi]?.awarded ?? 0) > 0,
    ).length;
    of = gatingGroups;
    done = (team?.set_awarded ?? 0) > 0;
  } else {
    const counts = gatingCounts(set.groups[0]!, team?.groups[0]);
    got = counts.got;
    of = counts.of;
    done = (team?.groups[0]?.awarded ?? 0) > 0;
  }
  const title =
    `${set.label} — ${col.name}: ${got}/${of} ${multiGroup ? "groups" : "uniques"}` +
    `${done ? " · bonus banked" : ""} · ${fmt(team?.total ?? 0)} pts in this set`;
  return (
    <div title={title}>
      <TallyBoxes got={got} of={of} color={col.color} done={done} wide={wide} />
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
    clearLootSweepReceiptsCache();
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

  // The header strip pins below the site nav — measure the nav's sticky
  // wrapper so the strip lands flush under it (0 = viewport top fallback).
  const [stickyTop, setStickyTop] = useState(0);
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>("div.sticky.top-0");
    const measure = () => setStickyTop(nav?.offsetHeight ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // One horizontal scroller (the body) drives the pinned header strip.
  const headScrollRef = useRef<HTMLDivElement>(null);
  const onBodyScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (headScrollRef.current) headScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
  }, []);

  // Elastic columns are MEASURED, not fr-based: rows lay out at max-content
  // width (needed for the fixed-column overflow mode), and under max-content
  // sizing a 1fr track grows to fit an UNWRAPPED run of receipt tabs —
  // pushing into the next team's column instead of line-breaking. Fixed
  // pixel tracks derived from the scroller's width make flex-wrap actually
  // wrap while still filling the page.
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const [bodyW, setBodyW] = useState(0);
  useEffect(() => {
    const el = bodyScrollRef.current;
    if (!el) return;
    const measure = () => setBodyW(el.clientWidth);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

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
  // 1100 ≈ content width before first measure (SSR + hydration render).
  const iconColW = Math.max(COL_W_ICON, Math.floor(((bodyW || 1100) - RAIL_W) / cols.length));
  const gridTemplate = `${RAIL_W}px repeat(${cols.length}, ${iconTabs ? iconColW : COL_W}px)`;

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
  // Every team column carries a left divider so adjacent columns read as
  // separate logs — essential in elastic mode, where receipt tabs would
  // otherwise run edge-to-edge into one continuous strip.
  const colBase = "border-osrs-bronze/25 border-l";

  return (
    <div className="space-y-3">
      <details className="border-osrs-bronze/25 bg-osrs-surface-1 rounded-lg border px-4 py-2.5 text-sm">
        <summary className="text-osrs-parchment-dark/80 cursor-pointer select-none">
          Each row is a drop, each column a team — hover any cell for who got it and what&apos;s
          next. <span className="text-osrs-gold-bright ml-1">How scoring works</span>
        </summary>
        <div className="text-osrs-parchment-dark/70 mt-2 space-y-2 leading-relaxed">
          <p>
            Every item is worth its listed points the first time your team receives it, and a
            little less each time after — so spreading out across many bosses beats farming one.
            Hover (or tap) any cell for the full story: every receipt so far, who pulled it, the
            screenshot when there is one, and what the next one is worth.
          </p>
          <p>
            A boss&apos;s header row tallies its required uniques — one box each — and the{" "}
            <span className="ring-osrs-gold/50 rounded px-1 ring-1">gold ring</span> means the
            full-set bonus is banked. Rows marked{" "}
            <span className="ring-osrs-gold/40 rounded px-1 ring-1">bonus</span> or{" "}
            <span className="ring-osrs-gold/40 rounded px-1 ring-1">pet</span> still score but
            aren&apos;t needed to complete the set. Click a boss row to collapse it.
          </p>
        </div>
      </details>

      <div>
        {/* Team header strip: pinned below the site nav, scroll-synced to the
            board so columns stay labelled (and scores visible) all the way
            down a 300-row page. */}
        <div
          ref={headScrollRef}
          className="border-osrs-bronze/25 bg-osrs-surface-2 shadow-osrs-card sticky z-30 overflow-x-hidden rounded-t-lg border"
          style={{ top: stickyTop }}
        >
          <div className="w-max min-w-full" style={{ display: "grid", gridTemplateColumns: gridTemplate }}>
            <div className={`${railBase} bg-osrs-surface-2 text-osrs-parchment-dark/50 flex items-end px-3 pb-2 pt-3 text-[11px] uppercase tracking-wider`}>
              Boss / item
            </div>
            {cols.map((col) => (
              <div
                key={col.id}
                className={`flex flex-col items-center gap-0.5 px-1 pb-2 pt-3 ${
                  col.isViewer ? `${pinBase} bg-osrs-surface-2` : colBase
                }`}
                style={col.isViewer ? { left: RAIL_W } : undefined}
                title={
                  preview
                    ? "Team progress appears here once teams are added"
                    : `${col.name} — ${fmt(col.score)} pts overall`
                }
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
        </div>

        <div
          ref={bodyScrollRef}
          className="border-osrs-bronze/25 overflow-x-auto rounded-b-lg border border-t-0"
          onScroll={onBodyScroll}
        >
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
                  className="bg-osrs-surface-2 border-osrs-bronze/20 w-max min-w-full border-t first:border-t-0"
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
                        col.isViewer ? `${pinBase} bg-osrs-surface-2` : colBase
                      }`}
                      style={col.isViewer ? { left: RAIL_W } : undefined}
                    >
                      {!preview && (
                        <SetCell
                          set={row.set}
                          gatingGroups={row.gatingGroups}
                          team={setTeams?.get(col.id)}
                          col={col}
                          wide={iconTabs}
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
                        className={`flex items-center justify-center py-1.5 ${
                          col.isViewer ? `${pinBase} bg-osrs-surface-1` : colBase
                        }`}
                        style={col.isViewer ? { left: RAIL_W } : undefined}
                        title={
                          preview
                            ? undefined
                            : `${row.group.label || row.group.npcs[0] || "Group"} — ${col.name}: ${counts.got}/${counts.of} uniques${done ? " · bonus banked" : ""}`
                        }
                      >
                        {!preview && (
                          <TallyBoxes
                            got={counts.got}
                            of={counts.of}
                            color={col.color}
                            done={done}
                            wide={iconTabs}
                          />
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
                  ).join(" / ")}${
                    row.item.match_names?.length
                      ? ` · also counts: ${row.item.match_names.join(", ")}`
                      : ""
                  }${(row.item.required ?? 1) > 1 ? ` · needs ${row.item.required} for the set` : ""}`}
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
                  const cell = (
                    <ReceiptCell
                      count={prog?.count ?? 0}
                      max={max}
                      color={col.color}
                      iconId={iconTabs ? row.item.item_id : null}
                      iconSize={iconSize}
                      wide={iconTabs}
                    />
                  );
                  return (
                    <div
                      key={col.id}
                      className={`flex items-center justify-center ${iconTabs ? "px-2 py-2" : "py-1.5"} ${
                        col.isViewer ? `${pinBase} bg-osrs-surface-1` : colBase
                      }`}
                      style={col.isViewer ? { left: RAIL_W } : undefined}
                    >
                      {preview ? (
                        cell
                      ) : (
                        <HoverCard
                          className="flex w-full cursor-help items-center justify-center"
                          width={320}
                          content={
                            <LootSweepReceiptCard
                              eventId={eventId}
                              set={row.set}
                              item={row.item}
                              team={{ id: col.id, name: col.name, color: col.color }}
                              count={prog?.count ?? 0}
                              banked={prog?.points ?? 0}
                            />
                          }
                        >
                          {cell}
                        </HoverCard>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {preview && (
        <p className="text-osrs-parchment-dark/40 text-xs">
          No teams yet — each team&apos;s progress appears as a column once teams are added.
        </p>
      )}
    </div>
  );
}
