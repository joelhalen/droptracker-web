import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { groupSocialMetadata } from "@/lib/seo";
import { Card, EmptyState, NameTile, RankMedal } from "@/components/ui";

// Rendered dynamically: the fetch forwards the viewer's session so group
// members can see members-only boards.

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ period?: string; page?: string }>;

const PERIOD_TABS = [
  { key: "month", label: "Monthly" },
  { key: "week", label: "Weekly" },
  { key: "day", label: "Daily" },
  { key: "all", label: "All-time" },
];

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  try {
    const group = await api.group(Number(id));
    return groupSocialMetadata(group, {
      title: `${group.name} — Points leaderboard`,
      description: `Points standings for ${group.name} on DropTracker.`,
    });
  } catch {
    return { title: "Points leaderboard" };
  }
}

export default async function GroupPointsLeaderboardPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();
  const { period = "month", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const group = await orNotFound(api.group(groupId));

  let board;
  try {
    board = await api.groupPointsLeaderboard(groupId, { period, page, limit: 50 });
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return (
        <div className="space-y-6">
          <Header groupId={groupId} groupName={group.name} />
          <EmptyState
            icon="🔒"
            title="This leaderboard is private"
            hint={`${group.name} has made its points leaderboard visible to group members only. Sign in with a member account to view it.`}
          />
        </div>
      );
    }
    throw err;
  }

  const totalPages = Math.max(1, Math.ceil(board.meta.total / board.meta.limit));
  const activeSeason = board.period.startsWith("season:")
    ? board.seasons.find((s) => `season:${s.id}` === board.period)
    : null;
  const isPresetActive = (key: string) =>
    !board.period.startsWith("season:") &&
    ((key === "all" && board.period === "all") ||
      (key === "month" && /^\d{6}$/.test(board.period)) ||
      (key === "week" && /W/.test(board.period)) ||
      (key === "day" && /^\d{8}$/.test(board.period)));

  const tabClass = (active: boolean) =>
    `rounded px-3 py-1.5 text-sm ${
      active
        ? "bg-osrs-bronze text-osrs-parchment"
        : "text-osrs-parchment-dark/70 hover:text-osrs-gold-bright"
    }`;

  return (
    <div className="space-y-6">
      <Header groupId={groupId} groupName={group.name} />

      <div className="flex flex-wrap items-center gap-1">
        {PERIOD_TABS.map((p) => (
          <Link
            key={p.key}
            href={`/groups/${groupId}/points/leaderboard?period=${p.key}` as Route}
            className={tabClass(isPresetActive(p.key))}
          >
            {p.label}
          </Link>
        ))}
        {board.seasons.map((s) => (
          <Link
            key={s.id}
            href={`/groups/${groupId}/points/leaderboard?period=season:${s.id}` as Route}
            className={tabClass(board.period === `season:${s.id}`)}
            title={
              s.start_at && s.end_at
                ? `${new Date(s.start_at).toLocaleDateString()} – ${new Date(s.end_at).toLocaleDateString()}`
                : undefined
            }
          >
            {s.name}
            {s.active && <span className="text-osrs-gold-bright ml-1">●</span>}
          </Link>
        ))}
      </div>

      {activeSeason?.start_at && activeSeason?.end_at && (
        <p className="text-osrs-parchment-dark/60 text-sm">
          {activeSeason.name}: {new Date(activeSeason.start_at).toLocaleString()} →{" "}
          {new Date(activeSeason.end_at).toLocaleString()}
        </p>
      )}

      {board.entries.length === 0 ? (
        <EmptyState
          title="No points earned in this period"
          hint="Points appear here as group members earn them through drops, personal bests, pets, collection log slots and combat achievements."
        />
      ) : (
        <Card padding="p-0" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-osrs-bronze/25 text-osrs-parchment-dark/60 border-b text-left text-xs uppercase">
                <th className="w-16 px-4 py-2.5">Rank</th>
                <th className="px-4 py-2.5">Player</th>
                <th className="px-4 py-2.5 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {board.entries.map((row) => (
                <tr key={row.id} className="border-osrs-bronze/15 border-b last:border-0">
                  <td className="px-4 py-2">
                    <RankMedal rank={row.rank} />
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/players/${row.id}` as Route}
                      className="hover:text-osrs-gold-bright flex items-center gap-2"
                    >
                      <NameTile name={row.name} />
                      <span className="font-medium">{row.name}</span>
                    </Link>
                  </td>
                  <td className="text-osrs-gold-bright px-4 py-2 text-right font-semibold">
                    {row.points.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link
              href={
                `/groups/${groupId}/points/leaderboard?period=${board.period}&page=${page - 1}` as Route
              }
              className="text-osrs-gold-bright hover:underline"
            >
              ← Previous
            </Link>
          )}
          <span className="text-osrs-parchment-dark/60">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={
                `/groups/${groupId}/points/leaderboard?period=${board.period}&page=${page + 1}` as Route
              }
              className="text-osrs-gold-bright hover:underline"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Header({ groupId, groupName }: { groupId: number; groupName: string }) {
  return (
    <div>
      <Link
        href={`/groups/${groupId}`}
        className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
      >
        ← {groupName}
      </Link>
      <h1 className="text-osrs-gold mt-1 text-2xl font-bold">Points leaderboard</h1>
      <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
        Points awarded by {groupName}&apos;s custom point rules.
      </p>
    </div>
  );
}
