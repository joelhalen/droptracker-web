"use client";

/**
 * Live board-game view (web44a): the board image with tile overlay + team
 * pieces, and a per-team side panel (piece, tile, coins, current task with a
 * progress bar, and the Roll button when the team is awaiting its roll).
 *
 * Realtime: listens on the event's SSE scope and refetches the board on
 * board_roll / completion frames (the board payload is small; a refetch is
 * simpler and safer than patching state client-side).
 */

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type {
  BoardDetail,
  BoardPosition,
  BoardRollResult,
  BoardShopState,
  BoardTile,
  EventDetail,
  RealtimeEvent,
} from "@droptracker/api-types";
import {
  buyBoardItem,
  fetchBoardShop,
  fetchPublicEventBoard,
  resolveBoardChoice,
  rollBoardAsMember,
  useBoardItem,
} from "@/app/(site)/(public)/events/[id]/actions";
import { RUNE_ITEM_IDS } from "@/components/event-board-designer";

/** Options accepted by the "use an item" transport (numeric + targeted effects). */
export type UseBoardItemOpts = {
  teamId?: number;
  targetTeamId?: number;
  targetTileIdx?: number;
  value?: number;
};

/**
 * The board view's data transport. Defaults to the site's cookie-backed server
 * actions; the Discord Activity injects bearer-token twins so the same
 * component renders identically inside the iframe (rule #1: browser → BFF).
 */
export type BoardActions = {
  fetchBoard: (eventId: number) => Promise<BoardDetail>;
  roll: (eventId: number, teamId?: number) => Promise<BoardRollResult>;
  fetchShop: (eventId: number, teamId?: number) => Promise<BoardShopState>;
  buy: (
    eventId: number,
    shopItemId: number,
    teamId?: number,
  ) => Promise<{ team_id: number; inventory_id: number; coins: number }>;
  use: (
    eventId: number,
    inventoryId: number,
    opts: UseBoardItemOpts,
  ) => Promise<Record<string, unknown>>;
  resolveChoice: (eventId: number, choiceIndex: number) => Promise<Record<string, unknown>>;
};

/** Site default: the cookie-session server actions. */
const SITE_BOARD_ACTIONS: BoardActions = {
  fetchBoard: fetchPublicEventBoard,
  roll: rollBoardAsMember,
  fetchShop: fetchBoardShop,
  buy: buyBoardItem,
  use: useBoardItem,
  resolveChoice: resolveBoardChoice,
};

/** The elemental rune name + the difficulty tier it stands for (mirrors the
 * board designer's air→easy … fire→elite convention). */
const RUNE_ELEMENT: Record<string, string> = {
  air: "Air",
  water: "Water",
  earth: "Earth",
  fire: "Fire",
};
const RUNE_TIER: Record<string, string> = {
  air: "easy",
  water: "medium",
  earth: "hard",
  fire: "elite",
};

/** Effects whose USE targets a rival team (reuse the team picker). */
const TEAM_TARGET_EFFECTS = new Set([
  "steal_item",
  "reroll_opponent_task",
  "knockback",
  "freeze_opponent",
]);
/** Effects whose USE takes a numeric value (choose_roll — pick your move). */
const VALUE_EFFECTS = new Set(["choose_roll"]);

/** Short, human descriptions per effect key so players understand each item.
 * Falls back to the catalog `description` when the backend sends one. */
const EFFECT_DESCRIPTIONS: Record<string, string> = {
  extra_dice: "Adds an extra die to your next roll.",
  reroll_move: "Reroll your last dice roll and move again.",
  choose_roll: "Choose exactly how many tiles to advance on your next move.",
  ward: "Shields your team from the next offensive item aimed at you.",
  cleanse: "Clears a freeze or debuff currently on your team.",
  coin_toll: "Charges rivals a coin toll when they pass your piece.",
  reroll_task: "Swap your current task for a fresh one of the same tier.",
  boost_coins: "Boosts the coins you earn from your next completed task.",
  skip_task: "Instantly completes your current task.",
  choose_task: "Draw several candidate tasks, then pick which one to attempt.",
  steal_item: "Steal a random power-up from a rival team.",
  reroll_opponent_task: "Force a rival team to reroll their current task.",
  knockback: "Knock a rival team back several tiles.",
  freeze_opponent: "Freeze a rival so their next roll doesn't move them.",
  roadblock: "Drop a roadblock on a tile to stall whoever hits it.",
};
import { getErrorMessage } from "@/lib/errors";
import { teamColorMap } from "@/lib/events";
import { useEventStream } from "@/lib/use-event-stream";
import { Alert } from "@/components/ui";
import { ItemDbIcon } from "@/components/item-db-icon";
import { HoverCard } from "@/components/hover-card";
import { TaskDetailSheet, useCoarsePointer } from "@/components/task-detail";

export function EventBoardView({
  event,
  initialBoard,
  viewerTeamId,
  leadership,
  viewerRole,
  actions = SITE_BOARD_ACTIONS,
}: {
  event: EventDetail;
  initialBoard: BoardDetail;
  viewerTeamId: number | null;
  /** Team-leadership knobs (web48a); when enabled, plain members can't roll
   * or shop — their team's leader acts for them. */
  leadership?: { enabled: boolean; co_leaders: boolean; selection: string } | null;
  /** The viewer's leadership role on their team, if any. */
  viewerRole?: "leader" | "co_leader" | null;
  /** Data transport — defaults to the site server actions; the Activity passes
   * bearer-token BFF fetchers so the same component works inside the iframe. */
  actions?: BoardActions;
}) {
  const [board, setBoard] = useState<BoardDetail>(initialBoard);
  const [error, setError] = useState<string | null>(null);
  const [rolling, startRoll] = useTransition();
  const [lastDice, setLastDice] = useState<number[] | null>(null);
  // Touch: tapping a tile opens a bottom sheet with its detail card.
  const [sheetTileIdx, setSheetTileIdx] = useState<number | null>(null);
  const coarse = useCoarsePointer();

  const refetch = useCallback(() => {
    actions
      .fetchBoard(event.id)
      .then(setBoard)
      .catch(() => {});
  }, [actions, event.id]);

  // SSE: any board/completion frame → refetch (cheap, always consistent).
  const onFrame = useCallback(
    (frame: RealtimeEvent) => {
      if (frame.type !== "event_update") return;
      const kind = (frame.data as { kind?: string }).kind;
      if (
        kind === "board_roll" ||
        kind === "board_task_complete" ||
        kind === "board_item_used" ||
        kind === "board_blocked" ||
        kind === "completion" ||
        kind === "progress"
      ) {
        refetch();
      }
    },
    [refetch],
  );
  useEventStream([`event:${event.id}`], onFrame);

  const colors = useMemo(() => teamColorMap(event.teams ?? []), [event.teams]);
  const render = board.settings.tile_render;
  const iconSize = render.icon_size ?? 20;
  // Highest a choose_roll (Wizard's Mind Bomb) may pick.
  const diceMax =
    board.settings.movement.dice_count * board.settings.movement.dice_sides;
  // The viewer's own team position — drives the pending task-choice picker.
  const myPosition =
    viewerTeamId != null
      ? (board.positions.find((p) => p.team_id === viewerTeamId) ?? null)
      : null;
  const aspect =
    board.bg_width && board.bg_height ? board.bg_width / board.bg_height : 16 / 10;

  // Live standings for the bottom-right banner: leading team first (furthest
  // along the track, coins break ties). Same ordering as the panel below.
  const standings = useMemo(
    () => [...board.positions].sort((a, b) => b.tile_idx - a.tile_idx || b.coins - a.coins),
    [board.positions],
  );

  // Pieces stacked per tile so co-located teams fan out.
  const byTile = useMemo(() => {
    const m = new Map<number, BoardPosition[]>();
    for (const p of board.positions) {
      const list = m.get(p.tile_idx) ?? [];
      list.push(p);
      m.set(p.tile_idx, list);
    }
    return m;
  }, [board.positions]);

  const tileAt = useMemo(() => new Map(board.tiles.map((t) => [t.idx, t])), [board.tiles]);

  // Placed tile-bound effects (roadblocks/bulwarks) grouped by their tile so a
  // tile's detail card can note obstacles sitting on it.
  const effectsByTile = useMemo(() => {
    const m = new Map<number, BoardDetail["effects"]>();
    for (const eff of board.effects ?? []) {
      const list = m.get(eff.target_tile_idx) ?? [];
      list.push(eff);
      m.set(eff.target_tile_idx, list);
    }
    return m;
  }, [board.effects]);

  const [rollNote, setRollNote] = useState<string | null>(null);
  const doRoll = (teamId: number) => {
    setError(null);
    setRollNote(null);
    startRoll(async () => {
      try {
        const res = await actions.roll(event.id, teamId);
        setLastDice(res.dice);
        if (res.frozen) setRollNote("❄️ Frozen — the piece didn't move!");
        else if (res.roadblock)
          setRollNote(`🚧 Stopped short by a roadblock on tile ${res.roadblock.tile_idx}!`);
        refetch();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't roll."));
      }
    });
  };

  const manual = board.settings.movement.trigger === "manual";
  const rollerRule = board.settings.movement.manual_roller;

  // web48a: with team leadership on, only the team's leader/co-leader (or an
  // event admin — `event.can_manage`) may roll and shop for the team.
  const leaderGated =
    (leadership?.enabled ?? false) && event.can_manage !== true && viewerRole == null;
  const leaderNoun = leadership?.co_leaders ? "leader or co-leader" : "leader";

  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}

      <div
        className="border-osrs-bronze/30 relative w-full overflow-hidden rounded border bg-black/30"
        style={{ aspectRatio: `${aspect}` }}
      >
        {board.background_url && (
          <img
            src={board.background_url}
            alt={`${event.name} board`}
            className="pointer-events-none absolute inset-0 h-full w-full object-fill"
            draggable={false}
          />
        )}

        {/* Tiles */}
        {board.tiles.map((t) => {
          const isEndpoint = t.tile_kind === "start" || t.tile_kind === "finish";
          if (render.mode === "invisible" && !isEndpoint) return null;
          // The rune-icon tiles grow with the configured icon size; every
          // other tile keeps the fixed 28px circle.
          const showsRune = render.mode === "rune" && !!t.difficulty;
          const dim = showsRune ? iconSize + 12 : 28;
          // Positioning lives on the interactive anchor; the visual circle
          // fills it. `z-10` keeps the hit target above the background image.
          const anchorStyle: React.CSSProperties = {
            position: "absolute",
            left: `${t.x * 100}%`,
            top: `${t.y * 100}%`,
            width: dim,
            height: dim,
          };
          const circleStyle: React.CSSProperties = {};
          if (render.mode === "outline" || isEndpoint) {
            circleStyle.border = `${render.outline_width}px solid ${
              isEndpoint ? "#ffd700" : render.outline_color
            }`;
          }
          const circle = (
            <div
              className="flex size-full cursor-pointer items-center justify-center rounded-full bg-black/35 text-[9px] text-white/90"
              style={circleStyle}
            >
              {render.mode === "rune" && t.difficulty ? (
                <ItemDbIcon itemId={RUNE_ITEM_IDS[t.difficulty]} size={iconSize} />
              ) : (
                <span>
                  {t.tile_kind === "start" ? "S" : t.tile_kind === "finish" ? "F" : t.idx}
                </span>
              )}
            </div>
          );
          const card = (
            <TileCard
              tile={t}
              teamsHere={byTile.get(t.idx) ?? []}
              effectsHere={effectsByTile.get(t.idx) ?? []}
              finishIdx={board.finish_idx ?? null}
              colors={colors}
            />
          );
          // Touch: tap opens a bottom sheet. Pointer: in-place hover card.
          if (coarse) {
            return (
              <button
                key={t.idx}
                type="button"
                className="z-10 -translate-x-1/2 -translate-y-1/2"
                style={anchorStyle}
                onClick={() => setSheetTileIdx(t.idx)}
                aria-label={t.label ?? `Tile ${t.idx}`}
              >
                {circle}
              </button>
            );
          }
          return (
            <HoverCard
              key={t.idx}
              className="z-10 -translate-x-1/2 -translate-y-1/2"
              style={anchorStyle}
              width={280}
              content={card}
            >
              {circle}
            </HoverCard>
          );
        })}

        {/* Placed tile effects (web49a): roadblocks/bulwarks shown to
            everyone so the board reflects live obstacles. */}
        {(board.effects ?? []).map((eff) => {
          const tile = tileAt.get(eff.target_tile_idx);
          if (!tile) return null;
          const placedBy = board.positions.find(
            (p) => p.team_id === eff.placed_by_team_id,
          )?.team_name;
          return (
            <div
              key={`eff-${eff.id}`}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${tile.x * 100}%`,
                top: `calc(${tile.y * 100}% + 15px)`,
              }}
              title={`${eff.name ?? "Roadblock"}${
                placedBy ? ` — placed by ${placedBy}` : ""
              }`}
            >
              <div className="flex items-center justify-center rounded-full border-2 border-red-500/80 bg-black/70 p-0.5 shadow">
                {eff.icon_item_id ? (
                  <ItemDbIcon itemId={eff.icon_item_id} size={18} />
                ) : (
                  <span className="text-xs leading-none">⛔</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Team pieces */}
        {[...byTile.entries()].map(([tileIdx, positions]) => {
          const tile = tileAt.get(tileIdx);
          if (!tile) return null;
          return positions.map((p, i) => (
            <div
              key={p.team_id}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-700"
              style={{
                left: `calc(${tile.x * 100}% + ${(i - (positions.length - 1) / 2) * 14}px)`,
                top: `calc(${tile.y * 100}% - 16px)`,
              }}
              title={`${p.team_name} — tile ${p.tile_idx}`}
            >
              {p.piece_item_id ? (
                <ItemDbIcon itemId={p.piece_item_id} size={26} />
              ) : (
                <span
                  className="block size-4 rounded-full border border-black/60 shadow"
                  style={{ backgroundColor: p.color ?? colors.get(p.team_id) ?? "#c8a25a" }}
                />
              )}
            </div>
          ));
        })}

        {/* Live standings banner — parchment scroll styled to match the
            server-side title scroll baked into the Discord board export.
            Hidden on the smallest screens; the standings grid below covers
            those. */}
        {standings.length > 0 && (
          <div
            className="absolute bottom-2 right-2 z-30 hidden w-[200px] max-w-[45%] overflow-hidden rounded-sm sm:block"
            style={{
              background: "linear-gradient(180deg, #efe0bd 0%, #d8c194 100%)",
              border: "1px solid #7c6132",
              boxShadow: "0 2px 10px rgba(0,0,0,0.45)",
              fontFamily: "Georgia, 'Palatino Linotype', 'Times New Roman', serif",
              color: "#3a2c14",
              opacity: 0.96,
            }}
          >
            {/* Roller bars */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0"
              style={{ width: 6, background: "#b8965a", borderRight: "1px solid #7c6132" }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0"
              style={{ width: 6, background: "#b8965a", borderLeft: "1px solid #7c6132" }}
            />
            <div className="px-3 py-1.5">
              <div
                className="text-center text-xs font-bold uppercase"
                style={{ letterSpacing: "0.09em" }}
              >
                Standings
              </div>
              <ol className="mt-1 space-y-0.5 overflow-y-auto pr-0.5" style={{ maxHeight: 168 }}>
                {standings.map((p, i) => (
                  <li
                    key={p.team_id}
                    className="flex items-center gap-1.5 text-[11px] leading-tight"
                    title={`${p.team_name} — ${
                      p.status === "finished" ? "finished" : `tile ${p.tile_idx}`
                    }`}
                  >
                    <span className="w-3.5 shrink-0 text-right font-bold tabular-nums">
                      {i + 1}
                    </span>
                    {p.piece_item_id ? (
                      <ItemDbIcon itemId={p.piece_item_id} size={14} />
                    ) : p.piece_icon_url ? (
                      <img
                        src={p.piece_icon_url}
                        alt=""
                        width={14}
                        height={14}
                        className="inline-block shrink-0 object-contain"
                      />
                    ) : (
                      <span
                        className="inline-block size-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: p.color ?? colors.get(p.team_id) ?? "#c8a25a",
                        }}
                      />
                    )}
                    <span className="flex-1 truncate">{p.team_name}</span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {p.status === "finished"
                        ? "🏁"
                        : `#${p.tile_idx}${board.finish_idx != null ? `/${board.finish_idx}` : ""}`}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>

      {lastDice && (
        <p className="text-osrs-gold text-sm">
          🎲 Rolled {lastDice.join(" + ")}
          {lastDice.length > 1 ? ` = ${lastDice.reduce((a, b) => a + b, 0)}` : ""}!
          {rollNote && <span className="text-osrs-parchment-dark/80 ml-2">{rollNote}</span>}
        </p>
      )}

      {/* Team panel */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[...board.positions]
          .sort((a, b) => b.tile_idx - a.tile_idx || b.coins - a.coins)
          .map((p) => {
            const mine = viewerTeamId === p.team_id;
            // The roll button's slot: everything but the leadership gate.
            const couldRoll =
              event.status === "active" &&
              manual &&
              p.status === "awaiting_roll" &&
              mine &&
              (rollerRule === "team" || rollerRule === "either");
            const canRoll = couldRoll && !leaderGated;
            return (
              <div
                key={p.team_id}
                className={`border-osrs-bronze/25 rounded border p-3 ${
                  mine ? "bg-osrs-brown-dark/50" : "bg-osrs-brown-dark/25"
                }`}
              >
                <div className="flex items-center gap-2">
                  {p.piece_item_id ? (
                    <ItemDbIcon itemId={p.piece_item_id} size={20} />
                  ) : (
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: p.color ?? colors.get(p.team_id) ?? "#c8a25a" }}
                    />
                  )}
                  <span className="text-osrs-parchment truncate text-sm font-medium">
                    {p.team_name}
                  </span>
                  <span className="text-osrs-parchment-dark/60 ml-auto text-xs">
                    Tile {p.tile_idx}
                    {board.finish_idx != null ? ` / ${board.finish_idx}` : ""} · 🪙 {p.coins}
                  </span>
                </div>

                {p.status === "finished" ? (
                  <p className="text-osrs-gold mt-2 text-sm font-semibold">
                    🏆 Crossed the finish line!
                  </p>
                ) : p.current_task ? (
                  <div className="mt-2">
                    <p className="text-osrs-parchment-dark/80 flex items-center gap-1.5 text-xs">
                      {p.current_task.difficulty && (
                        <ItemDbIcon
                          itemId={
                            RUNE_ITEM_IDS[
                              p.current_task.difficulty as keyof typeof RUNE_ITEM_IDS
                            ] ?? null
                          }
                          size={13}
                        />
                      )}
                      {p.current_task.label}
                    </p>
                    <div className="bg-osrs-brown-dark/60 mt-1 h-1.5 w-full overflow-hidden rounded">
                      <div
                        className="h-full rounded transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            (p.current_task.progress / Math.max(1, p.current_task.target)) * 100,
                          )}%`,
                          backgroundColor: p.color ?? colors.get(p.team_id) ?? "#c8a25a",
                        }}
                      />
                    </div>
                    <p className="text-osrs-parchment-dark/50 mt-0.5 text-[11px]">
                      {p.current_task.progress} / {p.current_task.target} · turn{" "}
                      {p.turns_completed}
                    </p>
                  </div>
                ) : p.status === "awaiting_roll" ? (
                  <p className="text-osrs-parchment-dark/70 mt-2 text-xs">
                    Task complete — waiting for the dice roll.
                  </p>
                ) : (
                  <p className="text-osrs-parchment-dark/60 mt-2 text-xs">No active task.</p>
                )}

                {couldRoll && (
                  <>
                    <button
                      type="button"
                      disabled={rolling || !canRoll}
                      onClick={() => doRoll(p.team_id)}
                      className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark mt-2 w-full rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                    >
                      {rolling ? "Rolling…" : "🎲 Roll the dice"}
                    </button>
                    {!canRoll && (
                      <p className="text-osrs-parchment-dark/60 mt-1 text-[11px]">
                        Your team&apos;s {leaderNoun} rolls for you
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
      </div>

      {/* Pending task choice (web50a — choose_task items): the team must pick
          one of the drawn candidates before it can proceed. */}
      {viewerTeamId != null &&
        event.status === "active" &&
        myPosition?.pending_choice &&
        myPosition.pending_choice.length > 0 && (
          <BoardChoicePanel
            eventId={event.id}
            teamName={myPosition.team_name}
            choices={myPosition.pending_choice}
            onResolved={refetch}
            leaderGated={leaderGated}
            resolveChoice={actions.resolveChoice}
          />
        )}

      {/* Shop + inventory (viewer's team only; web45a) */}
      {viewerTeamId != null && board.settings.shop.enabled && event.status === "active" && (
        <BoardShopPanel
          eventId={event.id}
          teamId={viewerTeamId}
          otherTeams={board.positions
            .filter((p) => p.team_id !== viewerTeamId && p.status !== "finished")
            .map((p) => ({ id: p.team_id, name: p.team_name }))}
          maxTile={board.finish_idx ?? 0}
          diceMax={diceMax}
          onChanged={refetch}
          leaderGated={leaderGated}
          actions={actions}
        />
      )}

      {/* Touch: the tapped tile's detail card in a bottom sheet. */}
      {coarse && (
        <TaskDetailSheet open={sheetTileIdx != null} onClose={() => setSheetTileIdx(null)}>
          {sheetTileIdx != null &&
            tileAt.get(sheetTileIdx) &&
            (() => {
              const t = tileAt.get(sheetTileIdx)!;
              return (
                <TileCard
                  tile={t}
                  teamsHere={byTile.get(t.idx) ?? []}
                  effectsHere={effectsByTile.get(t.idx) ?? []}
                  finishIdx={board.finish_idx ?? null}
                  colors={colors}
                />
              );
            })()}
        </TaskDetailSheet>
      )}
    </div>
  );
}

/** Tile detail card (hover on desktop / bottom sheet on touch): the tile's rune
 * tier explained as its task difficulty, plus every team currently parked on
 * it with their assigned task, live progress, and status. */
function TileCard({
  tile,
  teamsHere,
  effectsHere,
  finishIdx,
  colors,
}: {
  tile: BoardTile;
  teamsHere: BoardPosition[];
  effectsHere: NonNullable<BoardDetail["effects"]>;
  finishIdx: number | null;
  colors: Map<number, string>;
}) {
  const title =
    tile.label ??
    (tile.tile_kind === "start"
      ? "Start"
      : tile.tile_kind === "finish"
        ? "Finish"
        : `Tile ${tile.idx}`);
  const diff = tile.difficulty ?? null;

  return (
    <div className="p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-osrs-gold font-medium">{title}</span>
        <span className="text-osrs-parchment-dark/50 text-xs tabular-nums">
          #{tile.idx}
          {finishIdx != null ? ` / ${finishIdx}` : ""}
        </span>
      </div>

      {/* Rune / difficulty tier */}
      {diff ? (
        <div className="border-osrs-bronze/25 mt-2 flex items-center gap-2 border-t pt-2">
          <ItemDbIcon itemId={RUNE_ITEM_IDS[diff]} size={20} />
          <span className="min-w-0">
            <span className="text-osrs-parchment block text-xs font-medium">
              {RUNE_ELEMENT[diff] ?? diff} rune · {RUNE_TIER[diff] ?? ""} difficulty
            </span>
            <span className="text-osrs-parchment-dark/55 block text-[11px]">
              Landing here draws a random {RUNE_TIER[diff] ?? diff} task.
            </span>
          </span>
        </div>
      ) : tile.task_id != null ? (
        <p className="text-osrs-parchment-dark/60 mt-2 text-xs">
          Pinned task{tile.task_label ? `: ${tile.task_label}` : ""}.
        </p>
      ) : tile.tile_kind === "normal" ? (
        <p className="text-osrs-parchment-dark/50 mt-2 text-xs">Rest tile — no task.</p>
      ) : null}

      {/* Placed obstacles on this tile */}
      {effectsHere.length > 0 && (
        <ul className="border-osrs-bronze/25 mt-2 space-y-1 border-t pt-2">
          {effectsHere.map((eff) => (
            <li key={eff.id} className="flex items-center gap-1.5 text-[11px] text-red-300/90">
              {eff.icon_item_id ? (
                <ItemDbIcon itemId={eff.icon_item_id} size={14} />
              ) : (
                <span aria-hidden>⛔</span>
              )}
              <span>{eff.name ?? "Roadblock"}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Teams parked on this tile */}
      <div className="border-osrs-bronze/25 mt-2 border-t pt-2">
        <p className="text-osrs-parchment-dark/50 mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
          {teamsHere.length > 0
            ? `Team${teamsHere.length === 1 ? "" : "s"} here`
            : "No teams here"}
        </p>
        {teamsHere.length === 0 ? (
          <p className="text-osrs-parchment-dark/50 text-[11px]">
            No pieces are on this tile right now.
          </p>
        ) : (
          <ul className="space-y-2">
            {teamsHere.map((p) => (
              <TileTeamRow key={p.team_id} p={p} color={colors.get(p.team_id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** One team's line inside a tile card: color, name, status, and the task it's
 * working on with a live progress bar (or the reason it's idle). */
function TileTeamRow({ p, color }: { p: BoardPosition; color?: string }) {
  const dot = p.color ?? color ?? "#c8a25a";
  const choosing = (p.pending_choice?.length ?? 0) > 0;
  const status = choosing
    ? "🔮 Choosing a task"
    : p.status === "finished"
      ? "🏁 Finished"
      : p.status === "awaiting_roll"
        ? "🎲 Awaiting roll"
        : p.status === "blocked"
          ? "🚧 Blocked"
          : null;

  return (
    <li>
      <div className="flex items-center gap-1.5">
        {p.piece_item_id ? (
          <ItemDbIcon itemId={p.piece_item_id} size={16} />
        ) : (
          <span
            className="inline-block size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: dot }}
            aria-hidden
          />
        )}
        <span className="text-osrs-parchment min-w-0 flex-1 truncate text-xs font-medium">
          {p.team_name}
        </span>
        {status && (
          <span className="text-osrs-parchment-dark/60 shrink-0 text-[10px]">{status}</span>
        )}
      </div>

      {p.current_task ? (
        <div className="mt-1 pl-[22px]">
          <p className="text-osrs-parchment-dark/80 flex items-center gap-1.5 text-[11px]">
            {p.current_task.difficulty &&
              RUNE_ITEM_IDS[p.current_task.difficulty as keyof typeof RUNE_ITEM_IDS] != null && (
                <ItemDbIcon
                  itemId={RUNE_ITEM_IDS[p.current_task.difficulty as keyof typeof RUNE_ITEM_IDS]}
                  size={12}
                />
              )}
            <span className="min-w-0 truncate">{p.current_task.label}</span>
          </p>
          <div className="bg-osrs-brown-dark/60 mt-1 h-1.5 w-full overflow-hidden rounded">
            <div
              className="h-full rounded transition-all"
              style={{
                width: `${Math.min(
                  100,
                  (p.current_task.progress / Math.max(1, p.current_task.target)) * 100,
                )}%`,
                backgroundColor: dot,
              }}
            />
          </div>
          <p className="text-osrs-parchment-dark/50 mt-0.5 text-[10px] tabular-nums">
            {p.current_task.progress} / {p.current_task.target}
          </p>
        </div>
      ) : !status ? (
        <p className="text-osrs-parchment-dark/50 mt-0.5 pl-[22px] text-[10px]">No active task.</p>
      ) : null}
    </li>
  );
}

/** The drawn-candidate picker for a choose_task item (Cache of Runes / Binding
 * Necklace): the team chooses which task to attempt; the pick is committed
 * server-side and the board refetched. */
function BoardChoicePanel({
  eventId,
  teamName,
  choices,
  onResolved,
  leaderGated = false,
  resolveChoice,
}: {
  eventId: number;
  teamName: string;
  choices: NonNullable<BoardPosition["pending_choice"]>;
  onResolved: () => void;
  leaderGated?: boolean;
  resolveChoice: BoardActions["resolveChoice"];
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const choose = (choiceIndex: number) => {
    setError(null);
    startBusy(async () => {
      try {
        await resolveChoice(eventId, choiceIndex);
        onResolved();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't lock in that choice."));
      }
    });
  };

  return (
    <div className="border-osrs-gold/40 bg-osrs-brown-dark/40 rounded border p-3">
      <h3 className="text-osrs-gold text-sm font-semibold">🔮 Choose your next task</h3>
      <p className="text-osrs-parchment-dark/70 mt-1 text-xs">
        {teamName} drew {choices.length} candidate task{choices.length === 1 ? "" : "s"} — pick
        the one to attempt.
      </p>
      {leaderGated && (
        <p className="text-osrs-parchment-dark/60 mt-1 text-[11px]">
          Leaders only — your team&apos;s leader makes the pick.
        </p>
      )}
      {error && (
        <div className="mt-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      <ul className="mt-2 space-y-2">
        {choices.map((c) => (
          <li
            key={c.index}
            className="border-osrs-bronze/25 flex items-center gap-2 rounded border p-2"
          >
            {c.difficulty && RUNE_ITEM_IDS[c.difficulty as keyof typeof RUNE_ITEM_IDS] != null && (
              <ItemDbIcon
                itemId={RUNE_ITEM_IDS[c.difficulty as keyof typeof RUNE_ITEM_IDS]}
                size={16}
              />
            )}
            <span className="text-osrs-parchment flex-1 text-sm">{c.label}</span>
            <button
              type="button"
              disabled={busy || leaderGated}
              onClick={() => choose(c.index)}
              className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1 text-xs font-medium disabled:opacity-40"
              title={leaderGated ? "Leaders only" : undefined}
            >
              Choose
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BoardShopPanel({
  eventId,
  teamId,
  otherTeams,
  maxTile,
  diceMax,
  onChanged,
  leaderGated = false,
  actions,
}: {
  eventId: number;
  teamId: number;
  otherTeams: { id: number; name: string }[];
  maxTile: number;
  /** Highest tiles a choose_roll may pick (dice_count × dice_sides). */
  diceMax: number;
  onChanged: () => void;
  /** web48a: team leadership is on and the viewer holds no role — buy/use
   * stay visible but disabled. */
  leaderGated?: boolean;
  /** Data transport (site server actions or Activity BFF fetchers). */
  actions: BoardActions;
}) {
  const [shop, setShop] = useState<BoardShopState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  // Inline targeting state for interference items (offensive → a team,
  // roadblock → a tile, choose_roll → a number). Keyed by inventory_id.
  const [targetTeam, setTargetTeam] = useState<Record<number, number>>({});
  const [targetTile, setTargetTile] = useState<Record<number, string>>({});
  const [targetValue, setTargetValue] = useState<Record<number, string>>({});

  const load = useCallback(() => {
    actions
      .fetchShop(eventId, teamId)
      .then(setShop)
      .catch(() => {});
  }, [actions, eventId, teamId]);
  useEffect(load, [load]);

  const buy = (shopItemId: number) => {
    setError(null);
    setNotice(null);
    startBusy(async () => {
      try {
        await actions.buy(eventId, shopItemId, teamId);
        load();
        onChanged();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't buy that."));
      }
    });
  };

  const use = (inventoryId: number, effect: string) => {
    setError(null);
    setNotice(null);
    const opts: {
      teamId: number;
      targetTeamId?: number;
      targetTileIdx?: number;
      value?: number;
    } = { teamId };
    if (TEAM_TARGET_EFFECTS.has(effect)) {
      const t = targetTeam[inventoryId] ?? otherTeams[0]?.id;
      if (t == null) {
        setError("No other team to target.");
        return;
      }
      opts.targetTeamId = t;
    }
    if (effect === "roadblock") {
      // Optional now — omit to default to the team's current tile server-side.
      const raw = (targetTile[inventoryId] ?? "").trim();
      if (raw) {
        const tile = Number(raw);
        if (!Number.isInteger(tile) || tile <= 0 || tile >= maxTile) {
          setError(`Pick a tile between 1 and ${Math.max(1, maxTile - 1)}.`);
          return;
        }
        opts.targetTileIdx = tile;
      }
    }
    if (VALUE_EFFECTS.has(effect)) {
      const raw = (targetValue[inventoryId] ?? "").trim();
      const v = Number(raw);
      if (!raw || !Number.isInteger(v) || v < 1 || v > diceMax) {
        setError(`Pick a number between 1 and ${diceMax}.`);
        return;
      }
      opts.value = v;
    }
    startBusy(async () => {
      try {
        const res = await actions.use(eventId, inventoryId, opts);
        if (res && (res as { blocked_by_shield?: boolean }).blocked_by_shield) {
          setNotice("Their shield absorbed it!");
        }
        load();
        onChanged();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't use that."));
      }
    });
  };

  if (!shop) return null;
  const owned = (shop.team?.inventory ?? []).filter((i) => i.status === "owned");

  return (
    <div className="border-osrs-bronze/25 bg-osrs-brown-dark/30 rounded border p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-osrs-gold text-sm font-semibold">🛒 Power-up shop</h3>
        {shop.team && (
          <span className="text-osrs-parchment-dark/70 text-xs">
            🪙 {shop.team.coins} coins · turn {shop.team.turns_completed}
          </span>
        )}
      </div>
      {leaderGated && (
        <p className="text-osrs-parchment-dark/60 mt-1 text-[11px]">
          Leaders only — your team&apos;s leader buys and uses power-ups.
        </p>
      )}
      {error && (
        <div className="mt-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      {notice && <p className="text-osrs-gold mt-2 text-xs">{notice}</p>}

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {shop.items.map((item) => {
          const affordable = (shop.team?.coins ?? 0) >= item.cost_coins;
          const cap = item.per_team_cap ?? null;
          const bought = item.bought_by_team ?? 0;
          const capReached = cap != null && bought >= cap;
          const soldOut = item.stock === 0;
          const canBuy = affordable && item.usable_now && !capReached && !soldOut;
          const desc = item.description ?? EFFECT_DESCRIPTIONS[item.effect];
          return (
            <div key={item.id} className="border-osrs-bronze/20 rounded border p-2">
              <div className="flex items-center gap-1.5">
                <ItemDbIcon itemId={item.icon_item_id} size={18} />
                <span className="text-osrs-parchment truncate text-xs font-medium">
                  {item.name}
                </span>
              </div>
              {desc && (
                <p className="text-osrs-parchment-dark/60 mt-1 text-[11px]">{desc}</p>
              )}
              <p className="text-osrs-parchment-dark/50 mt-1 text-[10px] uppercase tracking-wide">
                {item.item_type} · every {item.type_cooldown_turns} turns
              </p>
              {(item.stock != null || cap != null) && (
                <p className="text-osrs-parchment-dark/50 mt-0.5 text-[10px]">
                  {item.stock != null && (
                    <span>{item.stock} in stock</span>
                  )}
                  {item.stock != null && cap != null && " · "}
                  {cap != null && (
                    <span>
                      {bought}/{cap} per team
                    </span>
                  )}
                </p>
              )}
              <button
                type="button"
                disabled={busy || leaderGated || !canBuy}
                onClick={() => buy(item.id)}
                className="bg-osrs-bronze/80 text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark mt-1.5 w-full rounded px-2 py-1 text-xs font-medium disabled:opacity-40"
                title={
                  leaderGated
                    ? "Leaders only"
                    : soldOut
                      ? "Sold out"
                      : capReached
                        ? "Your team's limit is reached"
                        : !affordable
                          ? "Not enough coins"
                          : undefined
                }
              >
                {soldOut
                  ? "Sold out"
                  : capReached
                    ? `Limit reached (${bought}/${cap})`
                    : `Buy · 🪙 ${item.cost_coins}`}
              </button>
            </div>
          );
        })}
        {shop.items.length === 0 && (
          <p className="text-osrs-parchment-dark/60 text-xs sm:col-span-3">
            The shop is empty right now.
          </p>
        )}
      </div>

      {owned.length > 0 && (
        <div className="mt-3">
          <h4 className="text-osrs-parchment text-xs font-semibold">Your bag</h4>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {owned.map((i) => (
              <li
                key={i.inventory_id}
                className="border-osrs-bronze/25 flex items-center gap-1.5 rounded border px-2 py-1"
                title={EFFECT_DESCRIPTIONS[i.effect]}
              >
                <ItemDbIcon itemId={i.icon_item_id} size={16} />
                <span className="text-osrs-parchment text-xs">{i.name}</span>
                {TEAM_TARGET_EFFECTS.has(i.effect) && otherTeams.length > 0 && (
                  <select
                    value={targetTeam[i.inventory_id] ?? otherTeams[0]?.id}
                    onChange={(e) =>
                      setTargetTeam((prev) => ({
                        ...prev,
                        [i.inventory_id]: Number(e.target.value),
                      }))
                    }
                    className="border-osrs-bronze/40 bg-osrs-brown-dark/60 rounded border px-1 py-0.5 text-[11px]"
                    aria-label="Target team"
                  >
                    {otherTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
                {i.effect === "roadblock" && (
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, maxTile - 1)}
                    placeholder="current tile"
                    title="Leave blank to block your team's current tile"
                    value={targetTile[i.inventory_id] ?? ""}
                    onChange={(e) =>
                      setTargetTile((prev) => ({
                        ...prev,
                        [i.inventory_id]: e.target.value,
                      }))
                    }
                    className="border-osrs-bronze/40 bg-osrs-brown-dark/60 w-24 rounded border px-1 py-0.5 text-[11px]"
                    aria-label="Roadblock tile (blank = current tile)"
                  />
                )}
                {VALUE_EFFECTS.has(i.effect) && (
                  <input
                    type="number"
                    min={1}
                    max={diceMax}
                    placeholder={`1–${diceMax}`}
                    title={`Move exactly this many tiles (1–${diceMax})`}
                    value={targetValue[i.inventory_id] ?? ""}
                    onChange={(e) =>
                      setTargetValue((prev) => ({
                        ...prev,
                        [i.inventory_id]: e.target.value,
                      }))
                    }
                    className="border-osrs-bronze/40 bg-osrs-brown-dark/60 w-16 rounded border px-1 py-0.5 text-[11px]"
                    aria-label="Tiles to advance"
                  />
                )}
                <button
                  type="button"
                  disabled={busy || leaderGated || !i.cooldown_ready || !i.usable_now}
                  onClick={() => use(i.inventory_id, i.effect)}
                  className="text-osrs-gold hover:text-osrs-gold-bright ml-1 text-xs font-medium disabled:opacity-40"
                  title={
                    leaderGated
                      ? "Leaders only"
                      : !i.cooldown_ready && i.cooldown_ready_turn != null
                        ? `${i.item_type} items ready from turn ${i.cooldown_ready_turn}`
                        : undefined
                  }
                >
                  Use
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
