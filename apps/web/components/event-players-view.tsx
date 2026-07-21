"use client";

/**
 * Event-wide player contribution leaderboard (the Players tab). Ranks every
 * player who contributed at least one applied completion by split points, with
 * the items they pulled (icon strip) and a lazy per-player drill-down (per-task
 * contribution + full item grid + recent activity) fetched on row expand.
 */

import { useCallback, useState } from "react";
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

type SortKey = "points" | "completions" | "quantity";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "points", label: "Points" },
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
function ItemStrip({ items }: { items: EventPlayerItem[] }) {
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
          <ItemDbIcon itemId={it.item_id} size={22} />
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

function PlayerDetail({ detail }: { detail: EventPlayerDetail }) {
  const { tasks, items, activity } = detail;
  return (
    <div className="mt-2 space-y-4 border-t border-osrs-bronze/20 pt-3">
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
                  <span className="text-osrs-parchment">{t.task_label ?? `Task ${t.task_id}`}</span>
                  {t.task_type && (
                    <span className="text-osrs-parchment-dark/50 ml-1.5 text-xs">
                      {(TASK_TYPE_LABELS as Record<string, string>)[t.task_type] ?? t.task_type}
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
                  <span className="text-osrs-parchment-dark/60 tabular-nums">×{num(it.quantity)}</span>
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
            <li
              key={a.id}
              className="text-osrs-parchment-dark/70 flex items-center gap-2 text-xs"
            >
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

function PlayerRow({
  player,
  rank,
  eventId,
}: {
  player: EventPlayerRow;
  rank: number;
  eventId: number;
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
        const res = await fetch(`/api/events/${eventId}/players/${player.player_id}`);
        if (!res.ok) throw new Error(String(res.status));
        setDetail((await res.json()) as EventPlayerDetail);
        setState("idle");
      } catch {
        setState("error");
      }
    }
  }, [open, detail, state, eventId, player.player_id]);

  const identity = (
    <span className="min-w-0">
      <span className="group-hover:text-osrs-gold-bright block truncate font-medium">
        {player.player_name}
        {player.role === "leader" && (
          <span title="Team leader" className="ml-1">
            👑
          </span>
        )}
        {player.role === "co_leader" && (
          <span title="Co-leader" className="ml-1 opacity-80">
            🥈
          </span>
        )}
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
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <NameTile name={player.player_name} size="sm" />
            {identity}
          </div>
        )}

        <ItemStrip items={player.items} />

        <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-5">
          <div className="hidden text-right sm:block">
            <div className="text-osrs-parchment-dark/70 text-sm tabular-nums">
              {num(player.completions)}
            </div>
            <div className="text-osrs-parchment-dark/40 text-[10px] uppercase">tasks</div>
          </div>
          <div className="text-right">
            <div className="text-osrs-gold-bright text-base font-bold tabular-nums">
              {fmtPoints(player.points)}
            </div>
            <div className="text-osrs-parchment-dark/40 text-[10px] uppercase">points</div>
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

export function EventPlayersView({ data, eventId }: { data: EventPlayersResponse; eventId: number }) {
  const { players, totals } = data;
  const [sort, setSort] = useState<SortKey>("points");

  const sorted = [...players].sort((a, b) => {
    if (sort === "completions") return b.completions - a.completions || b.points - a.points;
    if (sort === "quantity") return b.quantity - a.quantity || b.points - a.points;
    return b.points - a.points || b.completions - a.completions;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Contributors" value={<CountUp value={totals.contributors} />} />
        <StatTile label="Completions" value={<CountUp value={totals.completions} />} />
        <StatTile label="Points earned" value={<CountUp value={Math.round(totals.points)} />} />
        <StatTile
          label="Participants"
          value={<CountUp value={totals.participants} />}
          hint={`${totals.tasks} tasks`}
        />
      </div>

      {players.length ? (
        <Card>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-osrs-gold text-sm font-semibold">Contribution leaderboard</h2>
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
            {sorted.map((p, i) => (
              <PlayerRow key={p.player_id ?? `hidden-${i}`} player={p} rank={i + 1} eventId={eventId} />
            ))}
          </ol>
        </Card>
      ) : (
        <EmptyState
          title="No contributions yet"
          hint="Once players start completing tasks, they'll be ranked here by the points they've earned for their team."
        />
      )}
    </div>
  );
}
