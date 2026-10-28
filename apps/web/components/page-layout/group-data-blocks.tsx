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
import type {
  GroupProfile,
  GroupStatKey,
  HighlightType,
  PointsLeaderboard,
  PointsPeriod,
  StatTileStyle,
} from "@droptracker/api-types";
import { api } from "@/lib/api";
import { boardPeriods } from "@/lib/page-layout/catalog";
import { entityPath } from "@/lib/slug";
import type { GroupEvents } from "@/lib/group-events";
import { eventTypeLabel } from "@/lib/event-timeline";
import { ClanLogBoard } from "@/components/clan-log-board";
import { CountUp } from "@/components/count-up";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { EventWindow } from "@/components/local-time";
import { PvpKillList } from "@/components/pvp-kill-list";
import { SubmissionList } from "@/components/submission-list";
import { Badge, EntityChip, StatTile } from "@/components/ui";
import { BlockEmpty } from "./frame";
import { PeriodEmpty, PeriodTabs } from "./period-tabs";
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
  tileStyle,
}: {
  ctx: GroupPageContext;
  stats: readonly GroupStatKey[];
  columns: string;
  tileStyle: StatTileStyle;
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
  if (tiles.length === 0) return <BlockEmpty hint="Pick at least one stat." />;
  return (
    <div data-pl-stats={tileStyle} className={`stagger-children grid gap-3 ${COLS[columns] ?? autoCols(tiles.length)}`}>
      {tiles}
    </div>
  );
}

/* --- Clan Log ------------------------------------------------------------------ */

function Bar({ pct }: { pct: number }) {
  return (
    <div className="bg-osrs-surface-3 h-2 overflow-hidden rounded-full">
      <div className="bg-osrs-gold h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  gwd: "God Wars",
  group_bosses: "Group bosses",
  desert_treasure: "Desert Treasure",
  tob: "Theatre of Blood",
  cox: "Chambers of Xeric",
  toa: "Tombs of Amascut",
};

/** Clan Log category keys ("desert_treasure") as readable labels. */
function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export async function ClanLogBlock({
  groupId,
  base,
  view,
  showCategories,
  recent,
  showLink,
}: {
  groupId: number;
  base: string;
  view: "summary" | "board";
  showCategories: boolean;
  recent: number;
  showLink: boolean;
}) {
  const log = await api.clanLog(groupId).catch(() => null);
  if (!log || log.summary.total === 0) return <BlockEmpty hint="Shows once members fill the collection log." />;
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
                <span>{categoryLabel(name)}</span>
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
      {showLink && (
        <Link href={`${base}/log` as Route} className="text-osrs-gold-bright text-sm hover:underline">
          Full Clan Log →
        </Link>
      )}
    </div>
  );
}

/* --- clan points ---------------------------------------------------------------- */

const POINTS_PERIOD_LABELS: Record<PointsPeriod, string> = {
  all: "All time",
  season: "This season",
  month: "This month",
  week: "This week",
  day: "Today",
};

function PointsRows({ rows }: { rows: PointsLeaderboard["entries"] }) {
  return (
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
  );
}

export async function PointsBlock({
  group,
  base,
  limit,
  period,
  switchable,
  periods,
  showLink,
}: {
  group: GroupProfile;
  base: string;
  limit: number;
  period: PointsPeriod;
  switchable: boolean;
  periods: readonly PointsPeriod[];
  showLink: boolean;
}) {
  if (group.points_enabled === false) return <BlockEmpty hint="Clan points are switched off for this group." />;
  const wanted = boardPeriods(period, switchable, periods);
  const load = (p: string, n = limit) => api.groupPointsLeaderboard(group.id, { period: p, limit: n }).catch(() => null);

  const boards = new Map<PointsPeriod, PointsLeaderboard | null>();
  await Promise.all(
    wanted.filter((p) => p !== "season").map(async (p) => boards.set(p, await load(p))),
  );
  // "This season" needs the season's id, which every board payload carries.
  let seasonName: string | null = null;
  if (wanted.includes("season")) {
    const seasons = [...boards.values()].find((b) => b)?.seasons ?? (await load("month", 1))?.seasons ?? [];
    const season = seasons.find((x) => x.active) ?? seasons[0];
    if (season) {
      seasonName = season.name;
      boards.set("season", await load(`season:${season.id}`));
    }
  }

  const panels = wanted
    .filter((p) => boards.has(p))
    .map((p) => ({ key: p, rows: boards.get(p)?.entries.slice(0, limit) ?? [] }));
  if (panels.every((p) => p.rows.length === 0)) return <BlockEmpty hint="Shows once members have clan points." />;

  const link = showLink && (
    <Link href={`${base}/points/leaderboard` as Route} className="text-osrs-gold-bright mt-3 inline-block text-sm hover:underline">
      Full points board →
    </Link>
  );
  if (panels.length === 1) {
    return (
      <div>
        <PointsRows rows={panels[0]!.rows} />
        {link}
      </div>
    );
  }
  return (
    <div>
      <PeriodTabs
        initial={period}
        panels={panels.map((p) => ({
          key: p.key,
          label: p.key === "season" && seasonName ? seasonName : POINTS_PERIOD_LABELS[p.key],
          content:
            p.rows.length > 0 ? (
              <PointsRows rows={p.rows} />
            ) : (
              <PeriodEmpty>No clan points {p.key === "all" ? "yet" : "in this period yet"}.</PeriodEmpty>
            ),
        }))}
      />
      {link}
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
  showLink,
}: {
  groupId: number;
  base: string;
  period: "month" | "all";
  limit: number;
  showRecent: boolean;
  showLink: boolean;
}) {
  const pvp = await api.groupPvp(groupId, period).catch(() => null);
  if (!pvp || (pvp.totals.kills === 0 && pvp.recent.length === 0)) {
    return <BlockEmpty hint="Shows after a member's first PvP kill in this period." />;
  }
  return (
    <div className="space-y-4">
      <div data-pl-stats="auto" className="grid grid-cols-3 gap-3">
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
      {showLink && (
        <Link href={`${base}/pvp` as Route} className="text-osrs-gold-bright text-sm hover:underline">
          PvP standings →
        </Link>
      )}
    </div>
  );
}

/* --- events ------------------------------------------------------------------------- */

export function EventsListBlock({
  events,
  show,
  limit,
  allHref,
}: {
  events: GroupEvents;
  show: "active" | "active_and_past";
  limit: number;
  /** The group's full event list (/events?group=...). */
  allHref: string;
}) {
  const rows = [...events.live, ...(show === "active_and_past" ? events.past : [])].slice(0, limit);
  if (rows.length === 0) return null;
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {rows.map((e) => {
          const live = e.status === "active";
          const counts = [
            e.team_count ? `${e.team_count} ${e.team_count === 1 ? "team" : "teams"}` : null,
            e.player_count ? `${e.player_count} ${e.player_count === 1 ? "player" : "players"}` : null,
          ].filter(Boolean);
          return (
            <li key={e.id}>
              <Link
                href={`/events/${e.id}` as Route}
                className={`block rounded border px-3 py-2.5 transition-colors ${
                  live
                    ? "border-osrs-gold/60 hover:border-osrs-gold event-glow-live"
                    : "border-osrs-bronze/20 hover:border-osrs-gold/50"
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{e.name}</span>
                  <Badge variant={live ? "gold" : "neutral"} size="sm">
                    {live ? "⚡ Live" : "Finished"}
                  </Badge>
                </span>
                <span className="text-osrs-parchment-dark/60 mt-0.5 block text-xs">
                  {eventTypeLabel(e)}
                  {counts.length > 0 && ` · ${counts.join(", ")}`}
                </span>
                <span className="text-osrs-parchment-dark/50 block text-xs">
                  <EventWindow startsAt={e.starts_at} endsAt={e.ends_at} status={e.status} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href={allHref as Route} className="text-osrs-gold-bright inline-block text-sm hover:underline">
        All events →
      </Link>
    </div>
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
  if (types.length === 0) return <BlockEmpty hint="Pick at least one kind of highlight." />;
  const items = await api.highlights(scope, id, types, limit).catch(() => []);
  if (items.length === 0) return <BlockEmpty hint="Shows once the chosen kinds of loot come in." />;
  return <SubmissionList submissions={items} showPlayer={scope === "group"} />;
}
