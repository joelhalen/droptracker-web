import type { Metadata, Route } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { resolveRef, resolveIdOrRedirect } from "@/lib/entity-ref";
import { groupSocialMetadata } from "@/lib/seo";
import { Alert, EmptyState } from "@/components/ui";
import { GroupStatsView } from "@/components/group-stats-view";
import { GroupStatsPeriod } from "@/components/group-stats-period";
import { periodLabel } from "@/lib/group-stats";

export const revalidate = 60;

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ period?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const ref = await resolveRef("group", id).catch(() => null);
  if (!ref || ref.ambiguous) return { title: "Clan stats" };
  try {
    const group = await api.group(ref.id);
    return groupSocialMetadata(group, {
      title: `${group.name} - Clan stats`,
      description: `Every member's loot, XP, kill counts, collection log slots, pets, PBs and more for ${group.name} on The DropTracker.`,
    });
  } catch {
    return { title: "Clan stats" };
  }
}

function thisMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Clan stats (suggestion #224): what every member did over a month, a year or
 * all time. One cached backend payload; the view slices it client-side.
 */
export default async function GroupStatsPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { id } = await params;
  const groupId = await resolveIdOrRedirect("group", "groups", id);
  const sp = await searchParams;
  const period = (sp.period ?? thisMonth()).toLowerCase();

  const [group, stats] = await Promise.all([orNotFound(api.group(groupId)), api.groupStats(groupId, period)]);
  const base = group.canonical_slug ? `/groups/${group.canonical_slug}` : `/groups/${groupId}`;

  const womNote =
    stats?.coverage.wom === "unlinked"
      ? "XP, levels and kill counts come from Wise Old Man. Link your clan's Wise Old Man group to add them."
      : stats?.coverage.wom === "missing"
        ? "Wise Old Man has no XP or kill count data for this clan in this period yet."
        : stats?.coverage.wom === "partial"
          ? "XP and kill counts cover only some of these months."
          : null;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={base as Route} className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm">
            ← {group.name}
          </Link>
          <h1 className="text-osrs-gold mt-1 text-2xl font-bold">Clan stats</h1>
          <p className="text-osrs-parchment-dark/70 text-sm">
            {periodLabel(stats?.period ?? period)}
            {stats?.in_progress && stats.kind !== "all" ? ", so far" : ""}. Click any member to see everything they did.
          </p>
        </div>
        <GroupStatsPeriod base={base} period={stats?.period ?? period} dataSince={stats?.data_since ?? "2024-10"} />
      </div>
      {womNote && <Alert variant="info">{womNote}</Alert>}
      {stats ? (
        <GroupStatsView key={stats.period} stats={stats} />
      ) : (
        <EmptyState title="No stats for that period" hint="Pick a month from the list, or try All time." />
      )}
    </div>
  );
}
