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
  BoardShopState,
  EventDetail,
  RealtimeEvent,
} from "@droptracker/api-types";
import {
  buyBoardItem,
  fetchBoardShop,
  fetchPublicEventBoard,
  rollBoardAsMember,
  useBoardItem,
} from "@/app/(site)/(public)/events/[id]/actions";
import { RUNE_ITEM_IDS } from "@/components/event-board-designer";
import { getErrorMessage } from "@/lib/errors";
import { teamColorMap } from "@/lib/events";
import { useEventStream } from "@/lib/use-event-stream";
import { Alert } from "@/components/ui";
import { ItemDbIcon } from "@/components/item-db-icon";

export function EventBoardView({
  event,
  initialBoard,
  viewerTeamId,
}: {
  event: EventDetail;
  initialBoard: BoardDetail;
  viewerTeamId: number | null;
}) {
  const [board, setBoard] = useState<BoardDetail>(initialBoard);
  const [error, setError] = useState<string | null>(null);
  const [rolling, startRoll] = useTransition();
  const [lastDice, setLastDice] = useState<number[] | null>(null);

  const refetch = useCallback(() => {
    fetchPublicEventBoard(event.id)
      .then(setBoard)
      .catch(() => {});
  }, [event.id]);

  // SSE: any board/completion frame → refetch (cheap, always consistent).
  const onFrame = useCallback(
    (frame: RealtimeEvent) => {
      if (frame.type !== "event_update") return;
      const kind = (frame.data as { kind?: string }).kind;
      if (
        kind === "board_roll" ||
        kind === "board_task_complete" ||
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
  const aspect =
    board.bg_width && board.bg_height ? board.bg_width / board.bg_height : 16 / 10;

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

  const doRoll = (teamId: number) => {
    setError(null);
    startRoll(async () => {
      try {
        const res = await rollBoardAsMember(event.id, teamId);
        setLastDice(res.dice);
        refetch();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't roll."));
      }
    });
  };

  const manual = board.settings.movement.trigger === "manual";
  const rollerRule = board.settings.movement.manual_roller;

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
          const style: React.CSSProperties = {
            left: `${t.x * 100}%`,
            top: `${t.y * 100}%`,
          };
          if (render.mode === "outline" || isEndpoint) {
            style.border = `${render.outline_width}px solid ${
              isEndpoint ? "#ffd700" : render.outline_color
            }`;
          }
          return (
            <div
              key={t.idx}
              className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-[9px] text-white/90"
              style={style}
              title={t.label ?? (t.difficulty ? `${t.difficulty} tile` : `Tile ${t.idx}`)}
            >
              {render.mode === "rune" && t.difficulty ? (
                <ItemDbIcon itemId={RUNE_ITEM_IDS[t.difficulty]} size={16} />
              ) : (
                <span>
                  {t.tile_kind === "start" ? "S" : t.tile_kind === "finish" ? "F" : t.idx}
                </span>
              )}
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
      </div>

      {lastDice && (
        <p className="text-osrs-gold text-sm">
          🎲 Rolled {lastDice.join(" + ")}
          {lastDice.length > 1 ? ` = ${lastDice.reduce((a, b) => a + b, 0)}` : ""}!
        </p>
      )}

      {/* Team panel */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[...board.positions]
          .sort((a, b) => b.tile_idx - a.tile_idx || b.coins - a.coins)
          .map((p) => {
            const mine = viewerTeamId === p.team_id;
            const canRoll =
              event.status === "active" &&
              manual &&
              p.status === "awaiting_roll" &&
              mine &&
              (rollerRule === "team" || rollerRule === "either");
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

                {canRoll && (
                  <button
                    type="button"
                    disabled={rolling}
                    onClick={() => doRoll(p.team_id)}
                    className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark mt-2 w-full rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                  >
                    {rolling ? "Rolling…" : "🎲 Roll the dice"}
                  </button>
                )}
              </div>
            );
          })}
      </div>

      {/* Shop + inventory (viewer's team only; web45a) */}
      {viewerTeamId != null && board.settings.shop.enabled && event.status === "active" && (
        <BoardShopPanel eventId={event.id} teamId={viewerTeamId} onChanged={refetch} />
      )}
    </div>
  );
}

function BoardShopPanel({
  eventId,
  teamId,
  onChanged,
}: {
  eventId: number;
  teamId: number;
  onChanged: () => void;
}) {
  const [shop, setShop] = useState<BoardShopState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const load = useCallback(() => {
    fetchBoardShop(eventId, teamId)
      .then(setShop)
      .catch(() => {});
  }, [eventId, teamId]);
  useEffect(load, [load]);

  const buy = (shopItemId: number) => {
    setError(null);
    startBusy(async () => {
      try {
        await buyBoardItem(eventId, shopItemId, teamId);
        load();
        onChanged();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't buy that."));
      }
    });
  };

  const use = (inventoryId: number) => {
    setError(null);
    startBusy(async () => {
      try {
        await useBoardItem(eventId, inventoryId, { teamId });
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
      {error && (
        <div className="mt-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {shop.items.map((item) => {
          const affordable = (shop.team?.coins ?? 0) >= item.cost_coins;
          return (
            <div key={item.id} className="border-osrs-bronze/20 rounded border p-2">
              <div className="flex items-center gap-1.5">
                <ItemDbIcon itemId={item.icon_item_id} size={18} />
                <span className="text-osrs-parchment truncate text-xs font-medium">
                  {item.name}
                </span>
              </div>
              {item.description && (
                <p className="text-osrs-parchment-dark/60 mt-1 text-[11px]">
                  {item.description}
                </p>
              )}
              <p className="text-osrs-parchment-dark/50 mt-1 text-[10px] uppercase tracking-wide">
                {item.item_type} · every {item.type_cooldown_turns} turns
              </p>
              <button
                type="button"
                disabled={busy || !affordable || !item.usable_now}
                onClick={() => buy(item.id)}
                className="bg-osrs-bronze/80 text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark mt-1.5 w-full rounded px-2 py-1 text-xs font-medium disabled:opacity-40"
                title={!affordable ? "Not enough coins" : undefined}
              >
                Buy · 🪙 {item.cost_coins}
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
              >
                <ItemDbIcon itemId={i.icon_item_id} size={16} />
                <span className="text-osrs-parchment text-xs">{i.name}</span>
                <button
                  type="button"
                  disabled={busy || !i.cooldown_ready || !i.usable_now}
                  onClick={() => use(i.inventory_id)}
                  className="text-osrs-gold hover:text-osrs-gold-bright ml-1 text-xs font-medium disabled:opacity-40"
                  title={
                    !i.cooldown_ready && i.cooldown_ready_turn != null
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
