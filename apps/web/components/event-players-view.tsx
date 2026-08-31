"use client";

/**
 * Event-wide player contribution leaderboard (the Players tab). A podium for
 * the top three, then ranked rows for every rostered player: split points,
 * event-window loot GP (all sources), the items they pulled (icon strip) and
 * a lazy per-player drill-down (per-task contribution + full item grid +
 * recent activity) fetched on row expand. Kind-agnostic — renders identically
 * for standard, bingo, board-game and loot-sweep events.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import type {
  EventPlayersResponse,
  EventPlayerRow,
  EventPlayerDetail,
  EventPlayerItem,
  EventEffort,
} from "@droptracker/api-types";
import { Card, EmptyState, NameTile, RankMedal, StatTile } from "@/components/ui";
import { CountUp } from "@/components/count-up";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { ItemDbIcon } from "@/components/item-db-icon";
import {
  TASK_TYPE_LABELS,
  effortKillLabel,
  effortPairNote,
  effortSummary,
  formatEheHours,
  isClueEffort,
} from "@/lib/events";
import { EheChip, EheLabel, EheValue } from "@/components/event-ehe";

const fmtPoints = (p: number) => (Math.round(p * 100) / 100).toLocaleString();
const num = (n: number) => n.toLocaleString();
const gp = (m?: { value: number; value_formatted: string } | null) =>
  m?.value_formatted ?? "0";
const gpValue = (m?: { value: number; value_formatted: string } | null) => m?.value ?? 0;

/** Loads one player's drill-down. The site default hits the cookie BFF; the
 * Discord Activity injects a bearer-token twin (lib/activity/api). */
export type PlayerDetailFetcher = (playerId: number) => Promise<EventPlayerDetail>;

type SortKey = "points" | "loot" | "completions" | "quantity" | "effort";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "points", label: "Points" },
  { key: "loot", label: "Loot" },
  { key: "completions", label: "Completions" },
  { key: "quantity", label: "Items" },
  // Bingo EHB — the only sort under which someone with zero points can lead,
  // which is the whole reason it exists.
  { key: "effort", label: "Effort" },
];

const ehb = (p: { effort?: EventEffort | null }) => p.effort?.ehb_hours ?? 0;

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

/** DOM id of a podium player's drill-down panel — shared by the card's
 * `aria-controls` and the panel itself. */
const podiumPanelId = (playerId: number) => `podium-detail-${playerId}`;

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
  expanded,
  onToggleDetail,
  onOpenPlayer,
}: {
  player: EventPlayerRow;
  rank: number;
  /** Whether this card's drill-down panel (rendered under the podium) is open. */
  expanded: boolean;
  onToggleDetail: (playerId: number) => void;
  onOpenPlayer?: (playerId: number) => void;
}) {
  const inner = (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <RankMedal rank={rank} />
      <NameTile
        name={player.player_name}
        size={rank === 1 ? "md" : "sm"}
        playerId={player.player_id ?? undefined}
      />
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
        {(player.effort?.kills ?? 0) > 0 && (
          <span className="text-osrs-parchment-dark/70 text-sm font-semibold">
            <EheChip effort={player.effort} />
          </span>
        )}
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
      {/* The podium used to be a dead end: the identity above navigates away,
          so the drill-down every ranked row offers needs its own control. It
          opens a full-width panel beneath the podium (see EventPlayersView) —
          this card is far too narrow to hold the detail grid. */}
      {player.player_id != null && (
        <button
          type="button"
          onClick={() => onToggleDetail(player.player_id!)}
          aria-expanded={expanded}
          aria-controls={podiumPanelId(player.player_id)}
          className={`border-osrs-bronze/25 hover:border-osrs-gold/50 hover:text-osrs-gold-bright mt-3 flex w-full items-center justify-center gap-1 rounded border py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
            expanded ? "text-osrs-gold-bright border-osrs-gold/50" : "text-osrs-parchment-dark/60"
          }`}
        >
          <span className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}>
            ▸
          </span>
          {expanded ? "Hide detail" : "Contribution detail"}
        </button>
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatTile label="Loot this event" value={gp(player.loot_gp)} />
        <StatTile label="Points" value={fmtPoints(player.points)} />
        <StatTile label="Contributions" value={num(player.completions)} />
        <StatTile label="Tasks helped" value={num(player.tasks_contributed)} />
        <StatTile
          label="EHE"
          value={
            <EheValue
              hours={player.effort?.ehb_hours}
              estimatedHours={player.effort?.ehb_estimated_hours}
              ratesKnown={player.effort?.rates_known}
            />
          }
          hint={
            (player.effort?.kills ?? 0) > 0 ? effortSummary(player.effort) : undefined
          }
        />
      </div>

      {(player.effort?.bosses?.length ?? 0) > 0 && (
        <div>
          <div className="text-osrs-parchment-dark/70 mb-1.5 text-xs font-semibold tracking-wide uppercase">
            Effort by boss
          </div>
          <ul className="grid gap-1">
            {player.effort!.bosses.map((b) => (
              <li
                key={b.npc_id ?? b.name}
                className="bg-osrs-surface-2/40 flex items-center gap-2 rounded px-2 py-1 text-sm"
              >
                <span className="text-osrs-parchment min-w-0 flex-1 truncate">
                  {b.name ?? "Unknown"}
                  {b.frozen && (
                    <span
                      className="text-osrs-parchment-dark/40 ml-1.5 text-xs"
                      title="Every task this boss counted toward is done, so it stopped accruing"
                    >
                      done
                    </span>
                  )}
                </span>
                <span
                  className="text-osrs-parchment-dark/60 shrink-0 text-xs tabular-nums"
                  title={effortPairNote(b)}
                >
                  {effortKillLabel(b)}
                  {isClueEffort(b) && (
                    <span className="text-osrs-parchment-dark/40">
                      {" · "}
                      {num(b.paired ?? 0)} paired
                    </span>
                  )}
                </span>
                <span className="text-osrs-parchment-dark/80 w-14 shrink-0 text-right text-xs tabular-nums">
                  {formatEheHours(b.ehb_hours, b.estimated)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

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

/** Fetches one player's drill-down and renders it. Mounted lazily by both the
 * ranked rows and the podium panel, and kept mounted (hidden) once opened so
 * collapsing and re-expanding doesn't refetch. */
function PlayerDetailSection({
  playerId,
  eventId,
  fetchDetail,
}: {
  playerId: number;
  eventId: number;
  fetchDetail?: PlayerDetailFetcher;
}) {
  const [detail, setDetail] = useState<EventPlayerDetail | null>(null);
  const [state, setState] = useState<"loading" | "idle" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setState("loading");
    const load = fetchDetail
      ? fetchDetail(playerId)
      : fetch(`/api/events/${eventId}/players/${playerId}`).then(async (res) => {
          if (!res.ok) throw new Error(String(res.status));
          return (await res.json()) as EventPlayerDetail;
        });
    load
      .then((d) => {
        if (!cancelled) {
          setDetail(d);
          setState("idle");
        }
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [playerId, eventId, fetchDetail]);

  if (state === "loading")
    return <p className="text-osrs-parchment-dark/50 px-2 pb-2 text-xs">Loading detail…</p>;
  if (state === "error")
    return <p className="text-osrs-red/80 px-2 pb-2 text-xs">Couldn&apos;t load detail.</p>;
  return detail ? <PlayerDetail detail={detail} /> : null;
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
  // Sticky: once opened, the detail stays mounted (hidden while collapsed) so
  // re-expanding costs nothing.
  const [everOpened, setEverOpened] = useState(false);

  const toggle = useCallback(() => {
    if (player.player_id == null) return; // masked (hidden) player — no drill-down
    setEverOpened(true);
    setOpen((o) => !o);
  }, [player.player_id]);

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
              <NameTile
                name={player.player_name}
                size="sm"
                playerId={player.player_id ?? undefined}
              />
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
                <NameTile
                  name={player.player_name}
                  size="sm"
                  playerId={player.player_id ?? undefined}
                />
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
          <div className="hidden text-right sm:block">
            <div className="text-osrs-parchment-dark/70 text-sm">
              <EheValue
                hours={player.effort?.ehb_hours}
                estimatedHours={player.effort?.ehb_estimated_hours}
                ratesKnown={player.effort?.rates_known}
              />
            </div>
            <div className="text-osrs-parchment-dark/40 text-[10px] uppercase">
              <EheLabel />
            </div>
          </div>
          <div className="text-right">
            <div className="text-osrs-gold-bright text-base font-bold tabular-nums">
              {fmtPoints(player.points)}
            </div>
            <div className="text-osrs-parchment-dark/40 text-[10px] uppercase">points</div>
            <div className="text-osrs-gold text-[11px] font-semibold tabular-nums sm:hidden">
              {gp(player.loot_gp)} gp
            </div>
            {/* Phones drop the sm+ columns entirely, so EHE rides along under
                the points figure — the same trick the loot value uses. */}
            {(player.effort?.kills ?? 0) > 0 && (
              <div className="text-osrs-parchment-dark/60 text-[11px] tabular-nums sm:hidden">
                <EheChip effort={player.effort} />
              </div>
            )}
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
      {everOpened && player.player_id != null && (
        <div className={open ? "pb-3" : "hidden"}>
          <PlayerDetailSection
            playerId={player.player_id}
            eventId={eventId}
            fetchDetail={fetchDetail}
          />
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
  // Podium drill-down: one open at a time, but every player opened so far stays
  // mounted (hidden) so switching back is instant.
  const [openPodiumId, setOpenPodiumId] = useState<number | null>(null);
  const [openedPodiumIds, setOpenedPodiumIds] = useState<number[]>([]);

  const togglePodiumDetail = useCallback((playerId: number) => {
    setOpenedPodiumIds((ids) => (ids.includes(playerId) ? ids : [...ids, playerId]));
    setOpenPodiumId((cur) => (cur === playerId ? null : playerId));
  }, []);

  const sorted = useMemo(() => {
    const rows = [...players];
    rows.sort((a, b) => {
      if (sort === "completions") return b.completions - a.completions || b.points - a.points;
      if (sort === "quantity") return b.quantity - a.quantity || b.points - a.points;
      if (sort === "loot")
        return gpValue(b.loot_gp) - gpValue(a.loot_gp) || b.points - a.points;
      if (sort === "effort")
        return ehb(b) - ehb(a) || (b.effort?.kills ?? 0) - (a.effort?.kills ?? 0);
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

  // Re-sorting reshuffles the podium; an open panel for someone who dropped off
  // it (or a podium that vanished entirely) collapses rather than dangling.
  const podiumIds = podium.map((p) => p.player_id);
  const activePodiumId =
    openPodiumId != null && podiumIds.includes(openPodiumId) ? openPodiumId : null;
  const podiumPanels = podium.filter(
    (p) => p.player_id != null && openedPodiumIds.includes(p.player_id),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Contributors" value={<CountUp value={totals.contributors} />} />
        <StatTile label="Completions" value={<CountUp value={totals.completions} />} />
        <StatTile label="Points earned" value={<CountUp value={Math.round(totals.points)} />} />
        <StatTile label="Loot tracked" value={gp(totals.loot_gp)} hint="all sources, this event" />
        <StatTile
          label="EHE"
          value={
            <EheValue
              hours={totals.ehb_hours}
              estimatedHours={totals.ehb_estimated_hours}
            />
          }
          hint="effort towards this event"
        />
        <StatTile
          label="Participants"
          value={<CountUp value={totals.participants} />}
          hint={`${totals.tasks} tasks`}
        />
      </div>

      {showPodium && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end sm:pt-2">
            {podium.map((p, i) => (
              <PodiumCard
                key={p.player_id ?? `hidden-podium-${i}`}
                player={p}
                rank={i + 1}
                expanded={activePodiumId != null && activePodiumId === p.player_id}
                onToggleDetail={togglePodiumDetail}
                onOpenPlayer={onOpenPlayer}
              />
            ))}
          </div>
          {podiumPanels.map((p) => (
            <Card
              key={p.player_id}
              id={podiumPanelId(p.player_id!)}
              padding="p-4"
              className={activePodiumId === p.player_id ? undefined : "hidden"}
            >
              <div className="flex items-center gap-2">
                <RankMedal rank={podium.indexOf(p) + 1} />
                <span className="text-osrs-parchment min-w-0 truncate font-semibold">
                  {p.player_name}
                </span>
                <button
                  type="button"
                  onClick={() => togglePodiumDetail(p.player_id!)}
                  className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright ml-auto shrink-0 rounded px-1 text-xs"
                >
                  Hide
                </button>
              </div>
              <PlayerDetailSection
                playerId={p.player_id!}
                eventId={eventId}
                fetchDetail={fetchDetail}
              />
            </Card>
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
