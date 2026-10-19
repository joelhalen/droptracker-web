import type { Metadata, Route } from "next";
import Link from "next/link";
import { PVP_METRICS, PVP_METRIC_LABELS, type PvpMetric } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { resolveRef, resolveIdOrRedirect } from "@/lib/entity-ref";
import { PERIOD_OPTIONS, DEFAULT_PERIOD } from "@/lib/period";
import { groupSocialMetadata } from "@/lib/seo";
import { Card, StatTile } from "@/components/ui";
import { PvpKillList } from "@/components/pvp-kill-list";
import { PvpStandingsTable } from "@/components/pvp-standings-table";

export const revalidate = 30;

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ period?: string; metric?: string; page?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const ref = await resolveRef("group", id).catch(() => null);
  if (!ref || ref.ambiguous) return { title: "PvP" };
  try {
    const group = await api.group(ref.id);
    return groupSocialMetadata(group, {
      title: `${group.name} - PvP`,
      description: `PvP kills, loot taken and standings for ${group.name} on The DropTracker.`,
    });
  } catch {
    return { title: "PvP" };
  }
}

export default async function GroupPvpPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const groupId = await resolveIdOrRedirect("group", "groups", id);
  const sp = await searchParams;
  const periodKey = PERIOD_OPTIONS.find((p) => p.key === sp.period)?.key ?? DEFAULT_PERIOD;
  const metric: PvpMetric = PVP_METRICS.find((m) => m === sp.metric) ?? "loot";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const [group, pvp, board] = await Promise.all([
    orNotFound(api.group(groupId)),
    api.groupPvp(groupId, periodKey),
    api.pvpLeaderboard({ period: periodKey, scope: `group:${groupId}`, metric, page, limit: 25 }),
  ]);
  const base = group.canonical_slug ? `/groups/${group.canonical_slug}` : `/groups/${groupId}`;
  const href = (over: Record<string, string | number>) => {
    const q = new URLSearchParams({ period: periodKey, metric, page: String(page) });
    for (const [k, v] of Object.entries(over)) q.set(k, String(v));
    return `${base}/pvp?${q}` as Route;
  };
  const totalPages = board.meta.total > 0 ? Math.ceil(board.meta.total / board.meta.limit) : 0;
  const pill = (active: boolean) =>
    `rounded px-3 py-1.5 text-sm ${
      active ? "bg-osrs-bronze text-osrs-parchment" : "text-osrs-parchment-dark/80 hover:text-osrs-gold-bright"
    }`;

  return (
    <div className="space-y-6">
      <div>
        <Link href={base as Route} className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright">
          ← {group.name}
        </Link>
        <h1 className="text-osrs-gold mt-1 text-2xl font-bold">PvP</h1>
        <p className="text-osrs-parchment-dark/70 mt-1 max-w-2xl text-sm">
          Loot your members took from other players. Kills in LMS and other PvP minigames, kills of
          their own accounts, and kills past the group&apos;s daily limit on one player don&apos;t count.
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {PERIOD_OPTIONS.map((p) => (
          <Link key={p.key} href={href({ period: p.key, page: 1 })} className={pill(periodKey === p.key)}>
            {p.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Loot taken" value={pvp.totals.loot.value_formatted} />
        <StatTile label="Kills" value={pvp.totals.kills.toLocaleString()} />
        <StatTile label="Members with kills" value={pvp.totals.players.toLocaleString()} className="max-sm:col-span-2" />
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-osrs-gold text-lg font-semibold">Standings</h2>
            <div className="flex flex-wrap gap-1">
              {PVP_METRICS.map((m) => (
                <Link key={m} href={href({ metric: m, page: 1 })} className={pill(metric === m)}>
                  {PVP_METRIC_LABELS[m]}
                </Link>
              ))}
            </div>
          </div>
          <PvpStandingsTable entries={board.entries} metric={metric} />
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              {page > 1 ? (
                <Link href={href({ page: page - 1 })} className="hover:text-osrs-gold-bright">
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-osrs-parchment-dark/70">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={href({ page: page + 1 })} className="hover:text-osrs-gold-bright">
                  Next →
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </section>

        <section className="min-w-0 space-y-3">
          <h2 className="text-osrs-gold text-lg font-semibold">Recent kills</h2>
          <Card padding="px-4 py-1">
            <PvpKillList kills={pvp.recent} />
          </Card>
        </section>
      </div>

      {pvp.board && (
        <section className="space-y-3">
          <h2 className="text-osrs-gold text-lg font-semibold">PvP lootboard</h2>
          <p className="text-osrs-parchment-dark/60 text-xs">This month&apos;s board, as posted in Discord.</p>
          {/* Plain <img>: a generated PNG served by the image host. */}
          <img
            src={pvp.board.url}
            alt={`${group.name} PvP lootboard`}
            className="border-osrs-bronze/30 w-full max-w-4xl rounded-lg border"
            loading="lazy"
          />
        </section>
      )}
    </div>
  );
}
