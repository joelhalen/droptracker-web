"use client";

/**
 * The activity's event screen: live bingo board + team standings + task list,
 * composed from the same components the website's event page uses.
 *
 * Realtime rides the same anonymous `event:{id}` SSE scope as the site (the
 * board and progress bars subscribe themselves). Discord's proxy is expected
 * to pass SSE through, but it isn't contractual — so this view watches the
 * stream's connection state and, if it can't stay open, silently re-fetches
 * the event every 30s and remounts the board with fresh completions.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardDetail, EventDetail, LootSweepBoard, Me } from "@droptracker/api-types";
import { BingoBoard } from "@/components/bingo-board";
import { EventBoardView, type BoardActions } from "@/components/event-board-view";
import { EventJoinPanel } from "@/components/event-join-panel";
import { LootSweepMatrix } from "@/components/loot-sweep-matrix";
import { EventTaskBoard } from "@/components/event-task-progress";
import type { BreakdownFetcher } from "@/components/task-detail";
import { EventWindow } from "@/components/local-time";
import { useEventStream } from "@/lib/use-event-stream";
import { teamColorMap } from "@/lib/events";
import { useActivityAuth } from "@/lib/activity/auth-context";
import { useActivityNav } from "@/lib/activity/nav";
import {
  activityMe,
  boardBuy,
  boardChoice,
  boardDetail,
  boardRoll,
  boardShop,
  boardUse,
  eventDetail,
  eventPendingCompletions,
  eventPot,
  joinEvent,
  leaveEvent,
  lootSweepBoard,
  lootSweepReceipts,
  markBuyinPaid,
  recordBuyin,
  taskBreakdown,
} from "@/lib/activity/api";
import { PrizePotPanel, type PrizePotActions } from "@/components/prize-pot-panel";
import type { EventPrizePot } from "@droptracker/api-types";

const STATUS_STYLES: Record<string, string> = {
  draft: "text-osrs-parchment-dark/60",
  active: "text-osrs-green",
  past: "text-osrs-parchment-dark/60",
};

/** Start polling when the stream hasn't been open for this long. */
const STREAM_GRACE_MS = 20_000;
const POLL_INTERVAL_MS = 30_000;

export function EventView({
  eventId,
  guildId: _guildId,
  onBack,
}: {
  eventId: number;
  guildId: string | null;
  onBack?: (() => void) | null;
}) {
  const nav = useActivityNav();
  const { sessionToken, user } = useActivityAuth();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Admin-only: how many completions sit in this event's review queue. */
  const [pendingCount, setPendingCount] = useState(0);
  // Bumped on each poll refetch — remounts the board/task list so their
  // internal live-patched state reseeds from the fresh payload.
  const [refreshKey, setRefreshKey] = useState(0);

  // Per-team task breakdown loads through the Activity BFF with the in-memory
  // bearer (the site's cookie BFF isn't reachable inside the iframe).
  const fetchBreakdown: BreakdownFetcher = useCallback(
    (taskId, teamId) => taskBreakdown(eventId, taskId, teamId, sessionToken),
    [eventId, sessionToken],
  );

  // Board-game events: the dice board replaces the bingo grid. Fetched
  // separately (EventBoardView needs an initialBoard) and reseeded on refresh.
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const isBoardGame = event?.kind === "board_game";

  // Loot Sweep events: the collection-log matrix replaces the task list.
  // Fetched separately (the matrix takes an initial board) and reseeded on
  // refresh; the matrix also self-refetches on SSE via its injected transport.
  const [lootSweep, setLootSweep] = useState<LootSweepBoard | null>(null);
  const isLootSweep = event?.kind === "loot_sweep";
  const lootSweepFetchBoard = useCallback(
    (id: number) => lootSweepBoard(id, sessionToken),
    [sessionToken],
  );
  const lootSweepFetchReceipts = useCallback(
    (id: number, taskId: number, item: string) =>
      lootSweepReceipts(id, taskId, item, sessionToken),
    [sessionToken],
  );

  // Bearer-token transport for the shared board view — the exact `BoardActions`
  // shape the site fills with cookie server actions, wired here to the
  // /api/activity/* BFF twins so the same component renders inside the iframe.
  const boardActions: BoardActions = useMemo(
    () => ({
      fetchBoard: (id) => boardDetail(id, sessionToken),
      roll: (id, teamId) => boardRoll(id, teamId, sessionToken ?? ""),
      fetchShop: (id, teamId) => boardShop(id, teamId, sessionToken ?? ""),
      buy: (id, shopItemId, teamId) => boardBuy(id, shopItemId, teamId, sessionToken ?? ""),
      use: (id, inventoryId, opts) => boardUse(id, inventoryId, opts, sessionToken ?? ""),
      resolveChoice: (id, choiceIndex) => boardChoice(id, choiceIndex, sessionToken ?? ""),
    }),
    [sessionToken],
  );

  const load = useCallback(
    async (isRefresh: boolean) => {
      try {
        const detail = await eventDetail(eventId, sessionToken);
        setEvent(detail);
        setError(null);
        if (isRefresh) setRefreshKey((k) => k + 1);
      } catch {
        if (!isRefresh) setError("Couldn't load this event.");
      }
    },
    [eventId, sessionToken],
  );

  // Prize pot (web52a): fetch the full pot when the event advertises one, and
  // re-fetch on each poll refresh (and after a tick). Actions are the bearer
  // twins of the site server actions, gated on can_manage inside the panel.
  const [pot, setPot] = useState<EventPrizePot | null>(null);
  const potEnabled = Boolean(event?.prize_pot?.enabled);
  const loadPot = useCallback(async () => {
    if (!potEnabled) {
      setPot(null);
      return;
    }
    try {
      setPot(await eventPot(eventId, sessionToken));
    } catch {
      /* leave the last-known pot in place */
    }
  }, [eventId, sessionToken, potEnabled]);
  useEffect(() => {
    void loadPot();
  }, [loadPot, refreshKey]);
  const potActions: PrizePotActions | null =
    event?.can_manage && sessionToken
      ? {
          markPaid: (buyinId, paid) => markBuyinPaid(eventId, buyinId, paid, sessionToken),
          recordDonation: (rsn, amount) =>
            recordBuyin(
              eventId,
              { rsn, kind: "donation", amount, status: "paid" },
              sessionToken,
            ).then(() => undefined),
        }
      : null;

  // Load the board once the event is known to be a board-game event, and
  // reseed it on each poll refresh (the board view also self-refetches on SSE).
  useEffect(() => {
    if (!isBoardGame) return;
    let cancelled = false;
    boardDetail(eventId, sessionToken)
      .then((b) => {
        if (!cancelled) setBoard(b);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isBoardGame, eventId, sessionToken, refreshKey]);

  // Same for the Loot Sweep matrix's initial board.
  useEffect(() => {
    if (!isLootSweep) return;
    let cancelled = false;
    lootSweepBoard(eventId, sessionToken)
      .then((b) => {
        if (!cancelled) setLootSweep(b);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLootSweep, eventId, sessionToken, refreshKey]);

  useEffect(() => {
    void load(false);
  }, [load]);

  // Linked players + groups for the join panel (session holders only).
  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    activityMe(sessionToken)
      .then((m) => {
        if (!cancelled) setMe(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  // Review-queue badge for event admins (can_manage comes from the detail
  // payload). Refreshes with the event so acting in the review screen and
  // popping back shows the updated count.
  const canManage = Boolean(event?.can_manage);
  useEffect(() => {
    if (!canManage || !sessionToken) return;
    let cancelled = false;
    eventPendingCompletions(eventId, sessionToken)
      .then((rows) => {
        if (!cancelled) setPendingCount(rows.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canManage, eventId, sessionToken, refreshKey]);

  const live = event?.status === "active";

  // Watch stream health on the same channel the board subscribes to; fall
  // back to polling while it can't stay open (e.g. the proxy buffers SSE).
  const { state: streamState } = useEventStream(live ? [`event:${eventId}`] : [], () => {});
  const streamOpenRef = useRef(streamState);
  streamOpenRef.current = streamState;

  useEffect(() => {
    if (!live) return;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    const graceTimer = setTimeout(() => {
      if (streamOpenRef.current === "open") return;
      pollTimer = setInterval(() => {
        if (streamOpenRef.current === "open") return;
        void load(true);
      }, POLL_INTERVAL_MS);
    }, STREAM_GRACE_MS);
    return () => {
      clearTimeout(graceTimer);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [live, load]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <p className="text-osrs-parchment-dark/80 text-sm">{error}</p>
      </div>
    );
  }
  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span
          aria-hidden
          className="border-osrs-bronze/40 border-t-osrs-gold size-8 animate-spin rounded-full border-2"
        />
      </div>
    );
  }

  const standings = [...event.teams].sort((a, b) => b.score - a.score);
  const teamColor = teamColorMap(event.teams);
  const teamRefs = event.teams.map((t) => ({ id: t.id, name: t.name, color: t.color }));

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-3 py-4">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm"
            >
              ←
            </button>
          )}
          <h1 className="text-osrs-gold text-xl font-bold">{event.name}</h1>
          <span className={`text-xs capitalize ${STATUS_STYLES[event.status] ?? ""}`}>
            ● {event.status === "draft" ? "upcoming" : event.status}
          </span>
        </div>
        <p className="text-osrs-parchment-dark/60 text-xs">
          <EventWindow startsAt={event.starts_at} endsAt={event.ends_at} status={event.status} />
        </p>
        {user && (
          <p className="text-osrs-parchment-dark/50 text-xs">
            Viewing as {user.global_name ?? user.username}
          </p>
        )}
      </header>

      {standings.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {standings.map((t, i) => (
            <span
              key={t.id}
              className="border-osrs-bronze/30 bg-osrs-brown-dark/40 inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs"
            >
              <span className="text-osrs-parchment-dark/50">#{i + 1}</span>
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: teamColor.get(t.id) }}
                aria-hidden
              />
              <span
                className={
                  t.id === event.viewer?.team_id
                    ? "text-osrs-gold-bright font-medium"
                    : "text-osrs-parchment-dark/85"
                }
              >
                {t.name}
              </span>
              <span className="text-osrs-gold tabular-nums">{t.score.toLocaleString()}</span>
            </span>
          ))}
        </div>
      )}

      {pot && pot.enabled && (
        <PrizePotPanel pot={pot} actions={potActions} onChanged={loadPot} />
      )}

      {canManage && pendingCount > 0 && (
        <button
          onClick={() => nav.push({ name: "event-review", id: eventId })}
          className="border-osrs-gold/40 bg-osrs-surface-1/70 hover:border-osrs-gold flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors"
        >
          <span aria-hidden className="text-lg">
            🔍
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-osrs-parchment block text-[13px] font-semibold">
              {pendingCount} completion{pendingCount === 1 ? "" : "s"} awaiting review
            </span>
            <span className="text-osrs-parchment-dark/55 block text-[11.5px]">
              Confirm or reject them before they count toward scores.
            </span>
          </span>
          <span className="bg-osrs-red/80 text-osrs-parchment shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums">
            {pendingCount}
          </span>
        </button>
      )}

      {event.status !== "past" && (
        <div className="border-osrs-bronze/20 bg-osrs-brown-dark/30 rounded border p-3">
          <h2 className="text-osrs-gold mb-2 text-sm font-semibold">Participate</h2>
          {sessionToken ? (
            <EventJoinPanel
              event={event}
              players={me ? me.players.map((p) => ({ id: p.id, name: p.name })) : []}
              viewerGroupIds={me?.groups.map((g) => g.id) ?? []}
              join={(eventId, input) => joinEvent(eventId, input, sessionToken)}
              leave={(eventId, playerId) => leaveEvent(eventId, playerId, sessionToken)}
              onChanged={() => void load(true)}
            />
          ) : (
            <p className="text-osrs-parchment-dark/60 text-sm">
              Approve the Discord sign-in prompt when launching the activity to join this event.
            </p>
          )}
        </div>
      )}

      {isBoardGame && board && (
        <div>
          <h2 className="heading-rule text-osrs-gold mb-2 pb-1 text-base font-semibold">
            Game board
          </h2>
          <EventBoardView
            key={`gameboard-${refreshKey}`}
            event={event}
            initialBoard={board}
            viewerTeamId={event.viewer?.team_id ?? null}
            leadership={event.leadership}
            viewerRole={event.viewer?.team_role ?? null}
            actions={boardActions}
          />
        </div>
      )}

      {isLootSweep && lootSweep && (
        <div>
          <h2 className="heading-rule text-osrs-gold mb-2 pb-1 text-base font-semibold">
            Loot Sweep
          </h2>
          <LootSweepMatrix
            key={`loot-sweep-${refreshKey}`}
            eventId={event.id}
            initial={lootSweep}
            live={live}
            viewerTeamId={event.viewer?.team_id ?? null}
            fetchBoard={lootSweepFetchBoard}
            fetchReceipts={lootSweepFetchReceipts}
            stickyTop={0}
          />
        </div>
      )}

      {event.bingo && (
        <BingoBoard
          key={`board-${refreshKey}`}
          board={event.bingo}
          teams={teamRefs}
          tasks={event.tasks}
          eventId={event.id}
          live={live}
          progress={event.progress}
          viewerTeamId={event.viewer?.team_id}
          fetchBreakdown={fetchBreakdown}
        />
      )}

      {/* Loot Sweep sets are shown by the matrix above, not as flat tasks. */}
      {!isLootSweep && event.tasks.length > 0 && (
        <div>
          <h2 className="heading-rule text-osrs-gold mb-2 pb-1 text-base font-semibold">Tasks</h2>
          <EventTaskBoard
            key={`tasks-${refreshKey}`}
            tasks={event.tasks}
            teams={teamRefs}
            progress={event.progress}
            eventId={event.id}
            live={live}
            viewerTeamId={event.viewer?.team_id}
            fetchBreakdown={fetchBreakdown}
          />
        </div>
      )}
    </div>
  );
}
