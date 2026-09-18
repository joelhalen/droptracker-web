import type { Metadata, Route } from "next";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { resolveRef, resolveIdOrRedirect } from "@/lib/entity-ref";
import { groupSocialMetadata } from "@/lib/seo";
import { entityPath } from "@/lib/slug";
import {
  isCombinedRow,
  leaderboardHref,
  matchRange,
  normalizeQuery,
  otherAccounts,
  primaryShare,
} from "@/lib/points-leaderboard";
import { Card, EmptyState, NameTile, RankMedal } from "@/components/ui";
import { PointsLeaderboardSearch } from "@/components/points-leaderboard-search";

// Rendered dynamically: the fetch forwards the viewer's session so group
// members can see members-only boards.

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ period?: string; page?: string; q?: string }>;

const PERIOD_TABS = [
  { key: "month", label: "Monthly" },
  { key: "week", label: "Weekly" },
  { key: "day", label: "Daily" },
  { key: "all", label: "All-time" },
];

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const ref = await resolveRef("group", (await params).id).catch(() => null);
  if (!ref || ref.ambiguous) return { title: "Points leaderboard" };
  try {
    const group = await api.group(ref.id);
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
  const groupId = await resolveIdOrRedirect("group", "groups", id);
  // Keep the caller's URL form (slug or id) in this page's own nav links.
  const base = `/groups/${id}`;
  const { period = "month", page: pageParam, q: qParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const q = normalizeQuery(qParam);

  const group = await orNotFound(api.group(groupId));

  let board;
  try {
    board = await api.groupPointsLeaderboard(groupId, { period, q, page, limit: 50 });
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return (
        <div className="space-y-6">
          <Header base={base} groupName={group.name} />
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
      <Header base={base} groupName={group.name} />

      <div className="flex flex-wrap items-center gap-1">
        {PERIOD_TABS.map((p) => (
          <Link
            key={p.key}
            href={leaderboardHref(base, { period: p.key, q }) as Route}
            className={tabClass(isPresetActive(p.key))}
          >
            {p.label}
          </Link>
        ))}
        {board.seasons.map((s) => (
          <Link
            key={s.id}
            href={leaderboardHref(base, { period: `season:${s.id}`, q }) as Route}
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PointsLeaderboardSearch base={base} period={board.period} initialQuery={q} />
        <p className="text-osrs-parchment-dark/60 text-sm">
          {q ? (
            <>
              {board.meta.total.toLocaleString()} match{board.meta.total === 1 ? "" : "es"} for
              “{q}” ·{" "}
              <Link
                href={leaderboardHref(base, { period: board.period }) as Route}
                className="text-osrs-gold-bright hover:underline"
              >
                clear
              </Link>
            </>
          ) : (
            <>
              {board.meta.total.toLocaleString()} ranked
              {board.combined && " · each member's accounts are counted together"}
            </>
          )}
        </p>
      </div>

      {board.entries.length === 0 && q ? (
        <EmptyState
          icon="🔍"
          title={`No one matching “${q}”`}
          hint="Only current group members with points in this period are ranked. Check the spelling, or try another period."
        />
      ) : board.entries.length === 0 ? (
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
                      href={entityPath("players", row.id, row.name)}
                      className="hover:text-osrs-gold-bright flex items-center gap-2"
                    >
                      <NameTile name={row.name} playerId={row.id} />
                      <span className="font-medium">
                        <Highlighted name={row.name} q={q} />
                      </span>
                    </Link>
                    {/* A combined row: every RSN behind the total, with its share. */}
                    {isCombinedRow(row) && (
                      <p className="text-osrs-parchment-dark/60 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 pl-8 text-xs">
                        <span>
                          {row.name}: {primaryShare(row).toLocaleString()}
                        </span>
                        {otherAccounts(row).map((a) => (
                          <Link
                            key={a.id}
                            href={entityPath("players", a.id, a.name)}
                            className="hover:text-osrs-gold-bright"
                          >
                            <Highlighted name={a.name} q={q} />: {a.points.toLocaleString()}
                          </Link>
                        ))}
                      </p>
                    )}
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
              href={leaderboardHref(base, { period: board.period, q, page: page - 1 }) as Route}
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
              href={leaderboardHref(base, { period: board.period, q, page: page + 1 }) as Route}
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

/** A name with the part the search matched picked out. */
function Highlighted({ name, q }: { name: string; q: string }) {
  const range = matchRange(name, q);
  if (!range) return <>{name}</>;
  return (
    <>
      {name.slice(0, range[0])}
      <mark className="bg-osrs-gold/25 text-inherit rounded-sm">{name.slice(range[0], range[1])}</mark>
      {name.slice(range[1])}
    </>
  );
}

function Header({ base, groupName }: { base: string; groupName: string }) {
  return (
    <div>
      <Link
        href={base as Route}
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
