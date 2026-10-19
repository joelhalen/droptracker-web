import type { Metadata, Route } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { EntitySearch } from "@/components/entity-search";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { PvpStandingsTable } from "@/components/pvp-standings-table";
import { PVP_METRICS, PVP_METRIC_LABELS, type PvpMetric } from "@droptracker/api-types";
import { PERIOD_OPTIONS, DEFAULT_PERIOD, resolvePeriod } from "@/lib/period";

export const revalidate = 15;

export const metadata: Metadata = {
  title: "Leaderboards",
  description: "Global Old School RuneScape loot leaderboards for players and clans.",
};

type SearchParams = Promise<{ tab?: string; period?: string; page?: string; metric?: string }>;

const TABS = ["players", "groups", "pvp"] as const;
const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  players: "Players",
  groups: "Groups",
  pvp: "PvP",
};

export default async function LeaderboardsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t === sp.tab) ?? "players";
  const metric: PvpMetric = PVP_METRICS.find((m) => m === sp.metric) ?? "loot";
  const periodKey = sp.period ?? DEFAULT_PERIOD;
  const period = resolvePeriod(periodKey);
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const pvpBoard =
    tab === "pvp" ? await api.pvpLeaderboard({ period, scope: "global", metric, page, limit: 50 }) : null;
  const lootBoard =
    tab === "pvp"
      ? null
      : tab === "groups"
        ? await api.groupLeaderboard({ period, page, limit: 50 })
        : await api.playerLeaderboard({ period, scope: "global", page, limit: 50 });
  const active = pvpBoard ?? lootBoard;
  const board = {
    meta: active?.meta ?? { page, limit: 50, total: 0 },
    count: active?.entries.length ?? 0,
  };

  const limit = board.meta.limit || 50;
  const totalPages = board.meta.total > 0 ? Math.ceil(board.meta.total / limit) : 0;
  // Prefer authoritative total when present; otherwise fall back to a full page.
  const hasNext = totalPages ? page < totalPages : board.count >= limit;

  const qs = (over: Record<string, string | number>) => {
    const params = new URLSearchParams({ tab, period: periodKey, page: String(page), ...(tab === "pvp" ? { metric } : {}), ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])) });
    return `?${params}` as Route;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-osrs-gold text-3xl font-bold">Leaderboards</h1>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <Link
              key={t}
              href={qs({ tab: t, page: 1 })}
              className={`rounded px-3 py-1.5 text-sm ${
                tab === t ? "bg-osrs-bronze text-osrs-parchment" : "text-osrs-parchment-dark/80 hover:text-osrs-gold-bright"
              }`}
            >
              {TAB_LABELS[t]}
            </Link>
          ))}
        </div>
        <span className="text-osrs-bronze">|</span>
        <div className="flex flex-wrap gap-1">
          {PERIOD_OPTIONS.map((p) => (
            <Link
              key={p.key}
              href={qs({ period: p.key, page: 1 })}
              className={`rounded px-3 py-1.5 text-sm ${
                periodKey === p.key ? "bg-osrs-bronze text-osrs-parchment" : "text-osrs-parchment-dark/80 hover:text-osrs-gold-bright"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
        {tab === "pvp" && (
          <>
            <span className="text-osrs-bronze">|</span>
            <div className="flex flex-wrap gap-1">
              {PVP_METRICS.map((m) => (
                <Link
                  key={m}
                  href={qs({ metric: m, page: 1 })}
                  className={`rounded px-3 py-1.5 text-sm ${
                    metric === m ? "bg-osrs-bronze text-osrs-parchment" : "text-osrs-parchment-dark/80 hover:text-osrs-gold-bright"
                  }`}
                >
                  {PVP_METRIC_LABELS[m]}
                </Link>
              ))}
            </div>
          </>
        )}
        {/* Page-scoped live search: jump straight to a profile instead of
            paginating the table. Wraps to its own full-width row on mobile. */}
        <div className="ms-auto w-full sm:w-72">
          <EntitySearch
            key={tab}
            kinds={[tab === "groups" ? "groups" : "players"]}
            placeholder={tab === "groups" ? "Find a clan…" : "Find a player…"}
          />
        </div>
      </div>

      {tab === "pvp" ? (
        <>
          <p className="text-osrs-parchment-dark/70 text-sm">
            Loot taken from other players. Kills in LMS and other PvP minigames, and kills of
            your own accounts, don&apos;t count.
          </p>
          <PvpStandingsTable entries={pvpBoard?.entries ?? []} metric={metric} />
        </>
      ) : (
        <LeaderboardTable entries={lootBoard?.entries ?? []} scope="global" kind={tab} />
      )}

      {board.count > 0 && (
        <div className="flex items-center justify-between pt-2 text-sm">
          {page > 1 ? (
            <Link href={qs({ page: page - 1 })} className="hover:text-osrs-gold-bright">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-osrs-parchment-dark/70">
            Page {page}
            {totalPages ? ` of ${totalPages}` : ""}
          </span>
          {hasNext ? (
            <Link href={qs({ page: page + 1 })} className="hover:text-osrs-gold-bright">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
