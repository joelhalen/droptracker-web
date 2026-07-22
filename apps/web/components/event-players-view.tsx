"use client";

/**
 * Event-wide player contribution leaderboard (the Players tab). A podium for
 * the top three, then ranked rows for every rostered player: split points,
 * event-window loot GP (all sources), the items they pulled (icon strip) and
 * a lazy per-player drill-down (per-task contribution + full item grid +
 * recent activity) fetched on row expand. Kind-agnostic — renders identically
 * for standard, bingo, board-game and loot-sweep events.
 */

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import type {
  EventPlayersResponse,
  EventPlayerRow,
  EventPlayerDetail,
  EventPlayerItem,
} from "@droptracker/api-types";
import { Card, EmptyState, NameTile, RankMedal, StatTile } from "@/components/ui";
import { CountUp } from "@/components/count-up";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { ItemDbIcon } from "@/components/item-db-icon";
import { TASK_TYPE_LABELS } from "@/lib/events";

const fmtPoints = (p: number) => (Math.round(p * 100) / 100).toLocaleString();
const num = (n: number) => n.toLocaleString();
const gp = (m?: { value: number; value_formatted: string } | null) =>
  m?.value_formatted ?? "0";
const gpValue = (m?: { value: number; value_formatted: string } | null) => m?.value ?? 0;

/** Loads one player's drill-down. The site default hits the cookie BFF; the
 * Discord Activity injects a bearer-token twin (lib/activity/api). */
export type PlayerDetailFetcher = (playerId: number) => Promise<EventPlayerDetail>;

type SortKey = "points" | "loot" | "completions" | "quantity";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "points", label: "Points" },
  { key: "loot", label: "Loot" },
  { key: "completions", label: "Completions" },
  { key: "quantity", label: "Items" },
];

function teamDot(color?: string | null) {
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ background: color || "#9aa3b0" }}
    />
  );
}

/** The item-icon strip on a leaderboard row (top contributed items). */
function ItemStrip({ items, size = 22 }: { items: EventPlayerItem[]; size?: number }) {
  const withIcons = items.filter((i) => i.item_id != null);
  if (!withIcons.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {withIcons.map((it) => (
        <span
          key={it.name}
          className="relative"
          title={`${it.name}${it.quantity > 1 ? ` ×${num(it.quantity)}` : ""}`}
        >
          <ItemDbIcon itemId={it.item_id} size={size} />
          {it.quantity > 1 && (
            <span className="text-osrs-parchment-dark/70 absolute -bottom-1 -right-1 rounded bg-osrs-brown-dark/90 px-0.5 text-[9px] font-bold leading-tight">
              {it.quantity > 999 ? "999+" : it.quantity}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function relTime(ts: number | null): string {
  if (!ts) return "";
  const secs = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function roleBadge(role?: string | null) {
  if (role === "leader")
    return (
      <span title="Team leader" className="ml-1">
        👑
      </span>
    );
  if (role === "co_leader")
    return (
      <span title="Co-leader" className="ml-1 opacity-80">
        🥈
      </span>
    );
  return null;
}

/* ------------------------------------------------------------------ */
/* Podium — the top three under the active sort                        */
/* ------------------------------------------------------------------ */

const PODIUM_FRAME = [
  // rank 1 — gold, elevated on sm+ via order + slight lift
  "border-osrs-gold/60 sm:order-2 sm:-translate-y-1.5 shadow-osrs-card",
  "border-osrs-parchment-dark/40 sm:order-1", // rank 2 — silver
  "border-osrs-bronze/60 sm:order-3", // rank 3 — bronze
];

function PodiumCard({
  player,
  rank,
  onOpenPlayer,
}: {
  player: EventPlayerRow;
  rank: number;
  onOpenPlayer?: (playerId: number) => void;
}) {
  const inner = (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <RankMedal rank={rank} />
      <NameTile name={player.player_name} size={rank === 1 ? "md" : "sm"} />
      <div className="min-w-0 max-w-full">
        <div className="text-osrs-parchment truncate font-semibold">
          {player.player_name}
          {roleBadge(player.role)}
        </div>
        {player.team_name && (
          <div className="text-osrs-parchment-dark/60 flex items-center justify-center gap-1 truncate text-xs">
            {teamDot(player.team_color)}
            {player.team_name}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-3">
        <span className="text-osrs-gold-bright text-lg font-bold tabular-nums">
          {fmtPoints(player.points)}
          <span className="text-osrs-parchment-dark/50 ml-1 text-[10px] font-normal uppercase">
            pts
          </span>
        </span>
        <span className="text-osrs-gold text-sm font-semibold tabular-nums">
          {gp(player.loot_gp)}
          <span className="text-osrs-parchment-dark/50 ml-1 text-[10px] font-normal uppercase">
            gp
          </span>
        </span>
      </div>
      <ItemStrip items={player.items.slice(0, 6)} size={20} />
    </div>
  );
  return (
    <div
      className={`bg-osrs-surface-1 rounded-xl border p-4 ${PODIUM_FRAME[rank - 1] ?? ""}`}
    >
      {player.player_id != null ? (
        onOpenPlayer ? (
          <button
            type="button"
            onClick={() => onOpenPlayer(player.player_id!)}
            className="block w-full"
          >
            {inner}
          </button>
        ) : (
          <Link href={`/players/${player.player_id}` as Route} className="block">
            {inner}
          </Link>
        )
      ) : (
        inner
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Per-player drill-down                                               */
/* ------------------------------------------------------------------ */

function PlayerDetail({ detail }: { detail: EventPlayerDetail }) {
  const { player, tasks, items, activity } = detail;
  return (
    <div className="border-osrs-bronze/20 mt-2 space-y-4 border-t pt-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Loot this event" value={gp(player.loot_gp)} />
        <StatTile label="Points" value={fmtPoints(player.points)} />
        <StatTile label="Contributions" value={num(player.completions)} />
        <StatTile label="Tasks helped" value={num(player.tasks_contributed)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="text-osrs-parchment-dark/70 mb-1.5 text-xs font-semibold uppercase tracking-wide">
            Contribution by task
          </div>
          {tasks.length ? (
            <ul className="grid gap-1">
              {tasks.map((t) => (
                <li
                  key={t.task_id}
                  className="bg-osrs-surface-2/40 flex items-center gap-2 rounded px-2 py-1 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-osrs-parchment">
                      {t.task_label ?? `Task ${t.task_id}`}
                    </span>
                    {t.task_type && (
                      <span className="text-osrs-parchment-dark/50 ml-1.5 text-xs">
                        {(TASK_TYPE_LABELS as Record<string, string>)[t.task_type] ??
                          t.task_type}
                      </span>
                    )}
                  </span>
                  <span className="text-osrs-parchment-dark/60 shrink-0 text-xs tabular-nums">
                    ×{num(t.quantity)}
                  </span>
                  {t.points > 0 && (
                    <span className="text-osrs-gold-bright shrink-0 text-xs font-semibold tabular-nums">
                      {fmtPoints(t.points)} pts
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-osrs-parchment-dark/50 text-xs">No task contributions recorded.</p>
          )}
        </div>
        <div>
          <div className="text-osrs-parchment-dark/70 mb-1.5 text-xs font-semibold uppercase tracking-wide">
            Items obtained
          </div>
          {items.length ? (
            <div className="flex flex-wrap gap-1.5">
              {items.map((it) => (
                <span
                  key={it.name}
                  className="bg-osrs-surface-2/40 flex items-center gap-1 rounded px-1.5 py-1 text-xs"
                  title={it.name}
                >
                  {it.item_id != null ? (
                    <ItemDbIcon itemId={it.item_id} size={18} />
                  ) : (
                    <span className="text-osrs-parchment-dark/40">•</span>
                  )}
                  <span className="text-osrs-parchment max-w-[9rem] truncate">{it.name}</span>
                  {it.quantity > 1 && (
                    <span className="text-osrs-parchment-dark/60 tabular-nums">
                      ×{num(it.quantity)}
                    </span>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-osrs-parchment-dark/50 text-xs">
              No item drops — contributions came from kills, XP, or manual awards.
            </p>
          )}
        </div>
      </div>

      {activity.length > 0 && (
        <div>
          <div className="text-osrs-parchment-dark/70 mb-1.5 text-xs font-semibold uppercase tracking-wide">
            Recent activity
          </div>
          <ul className="grid gap-1">
            {activity.slice(0, 8).map((a) => (
              <li key={a.id} className="text-osrs-parchment-dark/70 flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-osrs-parchment">
                    {a.matched_target ?? a.task_label ?? `Task ${a.task_id}`}
                  </span>
                  {a.quantity > 1 && <span className="ml-1">×{num(a.quantity)}</span>}
                </span>
                <span className="text-osrs-parchment-dark/40 shrink-0">{relTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Leaderboard rows                                                    */
/* ------------------------------------------------------------------ */

function PlayerRow({
  player,
  rank,
  eventId,
  fetchDetail,
  onOpenPlayer,
}: {
  player: EventPlayerRow;
  rank: number;
  eventId: number;
  fetchDetail?: PlayerDetailFetcher;
  onOpenPlayer?: (playerId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<EventPlayerDetail | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const toggle = useCallback(async () => {
    if (player.player_id == null) return; // masked (hidden) player — no drill-down
    const next = !open;
    setOpen(next);
    if (next && detail === null && state !== "loading") {
      setState("loading");
      try {
        if (fetchDetail) {
          setDetail(await fetchDetail(player.player_id));
        } else {
          const res = await fetch(`/api/events/${eventId}/players/${player.player_id}`);
          if (!res.ok) throw new Error(String(res.status));
          setDetail((await res.json()) as EventPlayerDetail);
        }
        setState("idle");
      } catch {
        setState("error");
      }
    }
  }, [open, detail, state, eventId, player.player_id, fetchDetail]);

  const identity = (
    <span className="min-w-0">
      <span className="group-hover:text-osrs-gold-bright block truncate font-medium">
        {player.player_name}
        {roleBadge(player.role)}
      </span>
      {player.team_name && (
        <span className="text-osrs-parchment-dark/60 flex items-center gap-1 truncate text-xs">
          {teamDot(player.team_color)}
          {player.team_name}
        </span>
      )}
    </span>
  );

  return (
    <li className="border-osrs-bronze/15 border-b last:border-b-0">
      <div className="flex items-center gap-3 py-2">
        <RankMedal rank={rank} />
        {player.player_id != null ? (
          onOpenPlayer ? (
            <button
              type="button"
              onClick={() => onOpenPlayer(player.player_id!)}
              className="group flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <NameTile name={player.player_name} size="sm" />
              {identity}
            </button>
          ) : (
            <EntityHoverCard
              kind="player"
              id={player.player_id}
              name={player.player_name}
              className="min-w-0 flex-1"
            >
              <Link
                href={`/players/${player.player_id}` as Route}
                className="group flex min-w-0 items-center gap-2"
              >
                <NameTile name={player.player_name} size="sm" />
                {identity}
              </Link>
            </EntityHoverCard>
          )
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <NameTile name={player.player_name} size="sm" />
            {identity}
          </div>
        )}

        <div className="hidden md:block">
          <ItemStrip items={player.items} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-5">
          <div className="hidden text-right sm:block">
            <div className="text-osrs-parchment-dark/70 text-sm tabular-nums">
              {num(player.completions)}
            </div>
            <div className="text-osrs-parchment-dark/40 text-[10px] uppercase">tasks</div>
          </div>
          <div className="hidden text-right sm:block">
            <div className="text-osrs-gold text-sm font-semibold tabular-nums">
              {gp(player.loot_gp)}
            </div>
            <div className="text-osrs-parchment-dark/40 text-[10px] uppercase">loot</div>
          </div>
          <div className="text-right">
            <div className="text-osrs-gold-bright text-base font-bold tabular-nums">
              {fmtPoints(player.points)}
            </div>
            <div className="text-osrs-parchment-dark/40 text-[10px] uppercase">points</div>
            <div className="text-osrs-gold text-[11px] font-semibold tabular-nums sm:hidden">
              {gp(player.loot_gp)} gp
            </div>
          </div>
          {player.player_id != null ? (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright shrink-0 rounded px-1 text-sm"
              title={open ? "Hide detail" : "Show contribution detail"}
            >
              <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>
                ▸
              </span>
            </button>
          ) : (
            <span className="w-5 shrink-0" aria-hidden />
          )}
        </div>
      </div>
      {open && (
        <div className="pb-3">
          {state === "loading" && detail === null ? (
            <p className="text-osrs-parchment-dark/50 px-2 pb-2 text-xs">Loading detail…</p>
          ) : state === "error" ? (
            <p className="text-osrs-red/80 px-2 pb-2 text-xs">Couldn&apos;t load detail.</p>
          ) : detail ? (
            <PlayerDetail detail={detail} />
          ) : null}
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function EventPlayersView({
  data,
  eventId,
  fetchDetail,
  onOpenPlayer,
}: {
  data: EventPlayersResponse;
  eventId: number;
  /** Discord Activity injects a bearer fetcher; the site default is the
   * cookie BFF. */
  fetchDetail?: PlayerDetailFetcher;
  /** Discord Activity swaps player links (which would 404 in the iframe) for
   * in-app view pushes. */
  onOpenPlayer?: (playerId: number) => void;
}) {
  const { players, totals } = data;
  const [sort, setSort] = useState<SortKey>("points");

  const sorted = useMemo(() => {
    const rows = [...players];
    rows.sort((a, b) => {
      if (sort === "completions") return b.completions - a.completions || b.points - a.points;
      if (sort === "quantity") return b.quantity - a.quantity || b.points - a.points;
      if (sort === "loot")
        return gpValue(b.loot_gp) - gpValue(a.loot_gp) || b.points - a.points;
      return (
        b.points - a.points ||
        b.completions - a.completions ||
        gpValue(b.loot_gp) - gpValue(a.loot_gp)
      );
    });
    return rows;
  }, [players, sort]);

  // Podium: the top three under the active sort, only once there's something
  // to celebrate (any points or tracked loot).
  const showPodium =
    sorted.length >= 3 &&
    (sorted[0]!.points > 0 || gpValue(sorted[0]!.loot_gp) > 0);
  const podium = showPodium ? sorted.slice(0, 3) : [];
  const rest = showPodium ? sorted.slice(3) : sorted;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="Contributors" value={<CountUp value={totals.contributors} />} />
        <StatTile label="Completions" value={<CountUp value={totals.completions} />} />
        <StatTile label="Points earned" value={<CountUp value={Math.round(totals.points)} />} />
        <StatTile label="Loot tracked" value={gp(totals.loot_gp)} hint="all sources, this event" />
        <StatTile
          label="Participants"
          value={<CountUp value={totals.participants} />}
          hint={`${totals.tasks} tasks`}
        />
      </div>

      {showPodium && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end sm:pt-2">
          {podium.map((p, i) => (
            <PodiumCard
              key={p.player_id ?? `hidden-podium-${i}`}
              player={p}
              rank={i + 1}
              onOpenPlayer={onOpenPlayer}
            />
          ))}
        </div>
      )}

      {players.length ? (
        <Card>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-osrs-gold text-sm font-semibold">
              {showPodium ? "Full standings" : "Contribution leaderboard"}
            </h2>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-osrs-parchment-dark/50">Sort</span>
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSort(s.key)}
                  aria-pressed={sort === s.key}
                  className={`rounded px-2 py-0.5 ${
                    sort === s.key
                      ? "bg-osrs-bronze text-osrs-parchment"
                      : "text-osrs-parchment-dark/70 hover:bg-osrs-bronze/30"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <ol>
            {rest.map((p, i) => (
              <PlayerRow
                key={p.player_id ?? `hidden-${i}`}
                player={p}
                rank={(showPodium ? 3 : 0) + i + 1}
                eventId={eventId}
                fetchDetail={fetchDetail}
                onOpenPlayer={onOpenPlayer}
              />
            ))}
          </ol>
          {showPodium && rest.length === 0 && (
            <p className="text-osrs-parchment-dark/50 py-2 text-center text-xs">
              Just the podium so far — more players appear here as they join in.
            </p>
          )}
        </Card>
      ) : (
        <EmptyState
          title="No participants yet"
          hint="Once players join and start completing tasks, they'll be ranked here with their points and event loot."
        />
      )}
    </div>
  );
}
