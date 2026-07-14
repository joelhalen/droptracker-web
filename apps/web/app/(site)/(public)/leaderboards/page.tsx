import type { Metadata, Route } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { PERIOD_OPTIONS, DEFAULT_PERIOD, resolvePeriod } from "@/lib/period";

export const revalidate = 15;

export const metadata: Metadata = {
  title: "Leaderboards",
  description: "Global Old School RuneScape loot leaderboards for players and clans.",
};

type SearchParams = Promise<{ tab?: string; period?: string; page?: string }>;

export default async function LeaderboardsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const tab = sp.tab === "groups" ? "groups" : "players";
  const periodKey = sp.period ?? DEFAULT_PERIOD;
  const period = resolvePeriod(periodKey);
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const board =
    tab === "groups"
      ? await api.groupLeaderboard({ period, page, limit: 50 })
      : await api.playerLeaderboard({ period, scope: "global", page, limit: 50 });

  const limit = board.meta.limit || 50;
  const totalPages = board.meta.total > 0 ? Math.ceil(board.meta.total / limit) : 0;
  // Prefer authoritative total when present; otherwise fall back to a full page.
  const hasNext = totalPages ? page < totalPages : board.entries.length >= limit;

  const qs = (over: Record<string, string | number>) => {
    const params = new URLSearchParams({ tab, period: periodKey, page: String(page), ...Object.fromEntries(Object.entries(over).map(([k, v]) => [k, String(v)])) });
    return `?${params}` as Route;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-osrs-gold text-3xl font-bold">Leaderboards</h1>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(["players", "groups"] as const).map((t) => (
            <Link
              key={t}
              href={qs({ tab: t, page: 1 })}
              className={`rounded px-3 py-1.5 text-sm capitalize ${
                tab === t ? "bg-osrs-bronze text-osrs-parchment" : "text-osrs-parchment-dark/80 hover:text-osrs-gold-bright"
              }`}
            >
              {t}
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
      </div>

      <LeaderboardTable entries={board.entries} scope="global" kind={tab} />

      {board.entries.length > 0 && (
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
