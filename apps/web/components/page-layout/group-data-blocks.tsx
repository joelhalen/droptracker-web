/**
 * Data-driven group blocks for the page builder (web137a): the configurable
 * stats row and the blocks built straight from data we already hold (Clan
 * Log, clan points, PvP, events, highlights).
 *
 * Async server components. Each fetches only what its settings ask for, and
 * returns null when there is nothing to show so the page leaves it out
 * (the builder preview shows a placeholder instead).
 */
import type { Route } from "next";
import Link from "next/link";
import type { GroupProfile, GroupStatKey, HighlightType } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { entityPath } from "@/lib/slug";
import { ClanLogBoard } from "@/components/clan-log-board";
import { CountUp } from "@/components/count-up";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { PvpKillList } from "@/components/pvp-kill-list";
import { SubmissionList } from "@/components/submission-list";
import { Badge, EntityChip, StatTile } from "@/components/ui";
import type { GroupPageContext } from "./group-page-view";

/* --- stats row ---------------------------------------------------------------- */

const COLS: Record<string, string> = {
  "2": "grid-cols-2",
  "3": "grid-cols-2 sm:grid-cols-3",
  "4": "grid-cols-2 sm:grid-cols-4",
};

function autoCols(n: number): string {
  if (n >= 4) return "grid-cols-2 sm:grid-cols-4";
  if (n === 3) return "grid-cols-2 sm:grid-cols-3";
  return "grid-cols-2";
}

function Prose({ children }: { children: React.ReactNode }) {
  // Names, not figures: the tile's number-sized type would wrap them badly.
  return <span className="text-lg leading-snug font-semibold">{children}</span>;
}

export async function GroupStats({
  ctx,
  stats,
  columns,
}: {
  ctx: GroupPageContext;
  stats: readonly GroupStatKey[];
  columns: string;
}) {
  const { group } = ctx;
  const want = new Set(stats);
  const [clanLog, pvp, points, events] = await Promise.all([
    want.has("clan_log") ? api.clanLog(group.id).catch(() => null) : null,
    want.has("pvp_kills") || want.has("pvp_loot") ? api.groupPvp(group.id, "month").catch(() => null) : null,
    want.has("points_leader") && group.points_enabled !== false
      ? api.groupPointsLeaderboard(group.id, { limit: 1 }).catch(() => null)
      : null,
    want.has("events_running") ? api.events({ groupId: group.id, status: "active" }).catch(() => null) : null,
  ]);

  const tile = (key: GroupStatKey) => {
    switch (key) {
      case "members":
        return (
          <StatTile
            key={key}
            label="Members"
            value={<CountUp value={group.member_count} formatted={group.member_count.toLocaleString()} />}
          />
        );
      case "rank":
        return <StatTile key={key} label="Global rank" value={`#${group.global_rank ?? "—"}`} />;
      case "monthly_loot":
        return (
          <StatTile
            key={key}
            label="Monthly loot"
            value={
              group.monthly_loot ? (
                <CountUp value={group.monthly_loot.value} formatted={group.monthly_loot.value_formatted} />
              ) : (
                "—"
              )
            }
          />
        );
      case "top_player":
        return (
          <div key={key} className="bg-osrs-surface-2/70 rounded-lg px-4 py-3">
            <div className="text-osrs-parchment-dark/60 text-xs tracking-wide uppercase">Top player</div>
            {group.top_player ? (
              <EntityHoverCard kind="player" id={group.top_player.id} name={group.top_player.name} className="flex min-w-0">
                <EntityChip
                  href={entityPath("players", group.top_player.id, group.top_player.name)}
                  name={group.top_player.name}
                  size="sm"
                  className="mt-1.5"
                  subtitle={group.top_player.total_loot?.value_formatted}
                  playerId={group.top_player.id}
                />
              </EntityHoverCard>
            ) : (
              <div className="text-osrs-gold-bright mt-0.5 text-2xl font-bold">—</div>
            )}
          </div>
        );
      case "top_boss":
        return <StatTile key={key} label="Top boss this month" value={<Prose>{group.top_bosses?.[0]?.name ?? "—"}</Prose>} />;
      case "records_held":
        return <StatTile key={key} label="Clan records" value={String(group.records?.length ?? 0)} />;
      case "clan_log":
        return (
          <StatTile
            key={key}
            label="Clan Log"
            value={clanLog ? `${Math.round(clanLog.summary.pct)}%` : "—"}
            hint={clanLog ? `${clanLog.summary.obtained.toLocaleString()} / ${clanLog.summary.total.toLocaleString()} uniques` : undefined}
          />
        );
      case "pvp_kills":
        return <StatTile key={key} label="PvP kills this month" value={pvp ? pvp.totals.kills.toLocaleString() : "—"} />;
      case "pvp_loot":
        return <StatTile key={key} label="PvP loot this month" value={pvp?.totals.loot.value_formatted ?? "—"} />;
      case "points_leader": {
        const top = points?.entries[0];
        return (
          <StatTile
            key={key}
            label="Points leader"
            value={<Prose>{top?.name ?? "—"}</Prose>}
            hint={top ? `${top.points.toLocaleString()} points` : undefined}
          />
        );
      }
      case "bank_balance":
        return (
          <StatTile
            key={key}
            label="Clan bank"
            value={ctx.bank?.visible ? (ctx.bank.balance?.value_formatted ?? "0") : "—"}
          />
        );
      case "events_running":
        return <StatTile key={key} label="Events running" value={events ? String(events.length) : "—"} />;
      default:
        return null;
    }
  };

  const tiles = stats.map(tile).filter(Boolean);
  if (tiles.length === 0) return null;
  return <div className={`stagger-children grid gap-3 ${COLS[columns] ?? autoCols(tiles.length)}`}>{tiles}</div>;
}

/* --- Clan Log ------------------------------------------------------------------ */

function Bar({ pct }: { pct: number }) {
  return (
    <div className="bg-osrs-surface-3 h-2 overflow-hidden rounded-full">
      <div className="bg-osrs-gold h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export async function ClanLogBlock({
  groupId,
  base,
  view,
  showCategories,
  recent,
}: {
  groupId: number;
  base: string;
  view: "summary" | "board";
  showCategories: boolean;
  recent: number;
}) {
  const log = await api.clanLog(groupId).catch(() => null);
  if (!log || log.summary.total === 0) return null;
  if (view === "board") {
    return <ClanLogBoard board={log} />;
  }
  const cats = Object.entries(log.summary.per_category).filter(([, c]) => c.total > 0);
  const latest = (log.recent ?? []).slice(0, recent);
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-osrs-gold-bright text-2xl font-bold">{Math.round(log.summary.pct)}%</span>
          <span className="text-osrs-parchment-dark/70 text-sm">
            {log.summary.obtained.toLocaleString()} of {log.summary.total.toLocaleString()} uniques
          </span>
        </div>
        <Bar pct={log.summary.pct} />
      </div>
      {showCategories && cats.length > 0 && (
        <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {cats.map(([name, c]) => (
            <li key={name}>
              <div className="mb-1 flex justify-between text-xs">
                <span>{name}</span>
                <span className="text-osrs-parchment-dark/70 tabular-nums">
                  {c.obtained}/{c.total}
                </span>
              </div>
              <Bar pct={(c.obtained / c.total) * 100} />
            </li>
          ))}
        </ul>
      )}
      {latest.length > 0 && (
        <div>
          <div className="text-osrs-parchment-dark/60 mb-1.5 text-xs tracking-wide uppercase">Latest unlocks</div>
          <ul className="flex flex-wrap gap-2">
            {latest.map((r) => (
              <li
                key={`${r.item_id}-${r.at}`}
                className="border-osrs-bronze/30 flex items-center gap-1.5 rounded border px-2 py-1 text-xs"
                title={r.by ? `${r.name}, by ${r.by}` : r.name}
              >
                <img src={`/img/itemdb/${r.item_id}.png`} alt="" className="size-5 object-contain" loading="lazy" />
                {r.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link href={`${base}/log` as Route} className="text-osrs-gold-bright text-sm hover:underline">
        Full Clan Log →
      </Link>
    </div>
  );
}

/* --- clan points ---------------------------------------------------------------- */

export async function PointsBlock({ group, base, limit }: { group: GroupProfile; base: string; limit: number }) {
  if (group.points_enabled === false) return null;
  const board = await api.groupPointsLeaderboard(group.id, { limit }).catch(() => null);
  const rows = board?.entries.slice(0, limit) ?? [];
  if (rows.length === 0) return null;
  return (
    <div>
      <ol className="divide-osrs-bronze/20 divide-y">
        {rows.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="text-osrs-parchment-dark/60 w-6 text-right">{e.rank}.</span>
              <span className="truncate font-medium">{e.name}</span>
            </span>
            <span className="text-osrs-gold-bright font-semibold tabular-nums">{e.points.toLocaleString()}</span>
          </li>
        ))}
      </ol>
      <Link href={`${base}/points/leaderboard` as Route} className="text-osrs-gold-bright mt-3 inline-block text-sm hover:underline">
        Full points board →
      </Link>
    </div>
  );
}

/* --- PvP --------------------------------------------------------------------------- */

export async function PvpSummaryBlock({
  groupId,
  base,
  period,
  limit,
  showRecent,
}: {
  groupId: number;
  base: string;
  period: "month" | "all";
  limit: number;
  showRecent: boolean;
}) {
  const pvp = await api.groupPvp(groupId, period).catch(() => null);
  if (!pvp || (pvp.totals.kills === 0 && pvp.recent.length === 0)) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Kills" value={pvp.totals.kills.toLocaleString()} />
        <StatTile label="PvP loot" value={pvp.totals.loot.value_formatted} />
        <StatTile label="Killers" value={pvp.totals.players.toLocaleString()} />
      </div>
      {pvp.top_kills.length > 0 && (
        <ol className="divide-osrs-bronze/20 divide-y">
          {pvp.top_kills.slice(0, limit).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="text-osrs-parchment-dark/60 w-6 text-right">{r.rank}.</span>
                <Link href={entityPath("players", r.id, r.name) as Route} className="truncate font-medium hover:underline">
                  {r.name}
                </Link>
              </span>
              <span className="text-osrs-gold-bright font-semibold tabular-nums">{r.kills} kills</span>
            </li>
          ))}
        </ol>
      )}
      {showRecent && pvp.recent.length > 0 && <PvpKillList kills={pvp.recent.slice(0, limit)} />}
      <Link href={`${base}/pvp` as Route} className="text-osrs-gold-bright text-sm hover:underline">
        PvP standings →
      </Link>
    </div>
  );
}

/* --- events ------------------------------------------------------------------------- */

function when(ts: number | null | undefined): string {
  return ts ? new Date(ts * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
}

export async function EventsListBlock({
  groupId,
  show,
  limit,
}: {
  groupId: number;
  show: "active" | "active_and_past";
  limit: number;
}) {
  const [active, past] = await Promise.all([
    api.events({ groupId, status: "active" }).catch(() => []),
    show === "active_and_past" ? api.events({ groupId, status: "past" }).catch(() => []) : Promise.resolve([]),
  ]);
  const rows = [
    ...active.filter((e) => e.visibility !== "private"),
    ...past.filter((e) => e.visibility !== "private").sort((a, b) => (b.ends_at ?? 0) - (a.ends_at ?? 0)),
  ].slice(0, limit);
  if (rows.length === 0) return null;
  return (
    <ul className="divide-osrs-bronze/20 divide-y">
      {rows.map((e) => (
        <li key={e.id}>
          <Link
            href={`/events/${e.id}` as Route}
            className="hover:bg-osrs-bronze/10 -mx-2 flex items-center justify-between gap-3 rounded px-2 py-2.5"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{e.name}</span>
              <span className="text-osrs-parchment-dark/60 text-xs">
                {e.status === "active"
                  ? e.ends_at
                    ? `Ends ${when(e.ends_at)}`
                    : "Running"
                  : `Ended ${when(e.ends_at)}`}
              </span>
            </span>
            <Badge variant={e.status === "active" ? "gold" : "neutral"} size="sm">
              {e.status === "active" ? "Live" : "Finished"}
            </Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* --- highlights ---------------------------------------------------------------------- */

export async function HighlightsBlock({
  scope,
  id,
  types,
  limit,
}: {
  scope: "group" | "player";
  id: number;
  types: readonly HighlightType[];
  limit: number;
}) {
  if (types.length === 0) return null;
  const items = await api.highlights(scope, id, types, limit).catch(() => []);
  if (items.length === 0) return null;
  return <SubmissionList submissions={items} showPlayer={scope === "group"} />;
}
