/**
 * /leaderboards2: card-style redesign of /leaderboards, as a PREVIEW for the
 * owner to review. Not linked from the nav and not indexed.
 *
 * Differences from /leaderboards:
 *   - clans are the default tab (monthly stays the default period);
 *   - the top three sit on a podium, everyone else is a card in a grid;
 *   - clan cards show icon, custom description, roster size, members with loot
 *     this period, top earner, and supporter tier flair; player cards show
 *     avatar, badges and clans.
 *
 * To make it the real page: move this folder over leaderboards/ (keep its
 * `metadata`, drop `robots`), fold `CardEntrySchema` (board-data.ts) into
 * `LeaderboardEntrySchema` in @droptracker/api-types, point the nav's default
 * at `?tab=groups` or leave the new default to do it, and give the Activity's
 * leaderboard view the same cards (components/activity/, via prop-injected
 * links, see the site-activity parity notes).
 */
import type { Metadata, Route } from "next";
import Link from "next/link";
import { EntitySearch } from "@/components/entity-search";
import { EmptyState } from "@/components/ui";
import { PERIOD_OPTIONS, DEFAULT_PERIOD, resolvePeriod, type PeriodKey } from "@/lib/period";
import { GroupCard } from "./cards";
import { LivePlayers } from "./live-players";
import { periodPhrase, resetsIn, PAGE_SIZE, type BoardKind } from "./board-data";
import { fetchBoard } from "./fetch-board";
import "./leaderboards2.css";

export const revalidate = 15;

export const metadata: Metadata = {
  title: "Leaderboards (preview)",
  description: "Global Old School RuneScape loot leaderboards for clans and players.",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ tab?: string; period?: string; page?: string }>;

const TABS: { key: BoardKind; label: string }[] = [
  { key: "groups", label: "Clans" },
  { key: "players", label: "Players" },
];

export default async function LeaderboardsPreview({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const tab: BoardKind = sp.tab === "players" ? "players" : "groups";
  const periodKey = (PERIOD_OPTIONS.some((p) => p.key === sp.period) ? sp.period : DEFAULT_PERIOD) as PeriodKey;
  const period = resolvePeriod(periodKey);
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  // The other board is fetched at limit 1 only for its ranked count.
  const [board, other] = await Promise.all([
    fetchBoard(tab, period, page),
    fetchBoard(tab === "groups" ? "players" : "groups", period, 1, 1),
  ]);
  const counts = {
    groups: tab === "groups" ? board.meta.total : other.meta.total,
    players: tab === "players" ? board.meta.total : other.meta.total,
  };

  const limit = board.meta.limit || PAGE_SIZE;
  const totalPages = board.meta.total > 0 ? Math.ceil(board.meta.total / limit) : 0;
  const hasNext = totalPages ? page < totalPages : board.entries.length >= limit;

  // The bars compare against #1 of the whole board, not of this page.
  const leader =
    page === 1
      ? (board.entries[0]?.loot.value ?? 0)
      : ((await fetchBoard(tab, period, 1, 1)).entries[0]?.loot.value ?? 0);

  const phrase = periodPhrase(periodKey);
  const reset = resetsIn(periodKey);
  const withPodium = page === 1;
  const podium = withPodium ? board.entries.slice(0, 3) : [];
  const rest = withPodium ? board.entries.slice(3) : board.entries;

  const qs = (over: Record<string, string | number>) => {
    const params = new URLSearchParams({ tab, period: periodKey, page: String(page) });
    for (const [k, v] of Object.entries(over)) params.set(k, String(v));
    return `/leaderboards2?${params}` as Route;
  };

  return (
    <div className="lb2-page">
      <header className="lb2-hero">
        <p className="lb2-kicker">Leaderboards</p>
        <h1 className="lb2-title">
          Top {tab === "groups" ? "clans" : "players"} {phrase}
        </h1>
        <p className="lb2-lede">
          {tab === "groups"
            ? "Ranked by the loot their members tracked. Tap a clan to see its members, bosses and records."
            : "Ranked by the loot they tracked. Totals update live as drops come in."}
        </p>

        <ul className="lb2-facts">
          <li>
            <strong>{counts.groups.toLocaleString("en-US")}</strong> clans ranked
          </li>
          <li>
            <strong>{counts.players.toLocaleString("en-US")}</strong> players with loot
          </li>
          {reset && (
            <li>
              Resets in <strong>{reset}</strong>
            </li>
          )}
        </ul>
      </header>

      <nav className="lb2-controls" aria-label="Leaderboard options">
        <div className="lb2-tabs" role="tablist">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={qs({ tab: t.key, page: 1 })}
              role="tab"
              aria-selected={tab === t.key}
              className="lb2-tab"
            >
              {t.label}
            </Link>
          ))}
        </div>
        <div className="lb2-seg">
          {PERIOD_OPTIONS.map((p) => (
            <Link
              key={p.key}
              href={qs({ period: p.key, page: 1 })}
              aria-current={periodKey === p.key ? "true" : undefined}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <div className="lb2-search">
          <EntitySearch
            key={tab}
            kinds={[tab]}
            placeholder={tab === "groups" ? "Find a clan…" : "Find a player…"}
          />
        </div>
      </nav>

      {board.entries.length === 0 ? (
        <EmptyState
          title={tab === "players" ? "No ranked players yet" : "No ranked clans yet"}
          hint="Leaderboards fill up as drops are tracked for this period."
        />
      ) : tab === "players" ? (
        <LivePlayers entries={board.entries} leader={leader} withPodium={withPodium} />
      ) : (
        <>
          {podium.length > 0 && (
            <div className="lb2-podium">
              {podium.map((e) => (
                <GroupCard key={e.id} entry={e} leader={leader} phrase={phrase} podium />
              ))}
            </div>
          )}
          {rest.length > 0 && (
            <div className="lb2-grid">
              {rest.map((e) => (
                <GroupCard key={e.id} entry={e} leader={leader} phrase={phrase} />
              ))}
            </div>
          )}
        </>
      )}

      {board.entries.length > 0 && (totalPages > 1 || page > 1) && (
        <nav className="lb2-pager" aria-label="Pages">
          {page > 1 ? <Link href={qs({ page: page - 1 })}>Previous</Link> : <span />}
          <span>
            Page {page}
            {totalPages ? ` of ${totalPages}` : ""}
          </span>
          {hasNext ? <Link href={qs({ page: page + 1 })}>Next</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
