import Link from "next/link";
import { api } from "@/lib/api";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { Card, EmptyState } from "@/components/ui";
import { DEFAULT_PERIOD, resolvePeriod } from "@/lib/period";

// Public homepage: SSR snapshot with ISR; client hydrates live updates.
export const revalidate = 15;

export default async function HomePage() {
  // Default to the current month — the tracking system works month-to-month.
  const period = resolvePeriod(DEFAULT_PERIOD);
  const [players, groups, news] = await Promise.all([
    api.playerLeaderboard({ scope: "global", limit: 10, period }),
    api.groupLeaderboard({ limit: 5, period }),
    api.announcements("global"),
  ]);

  return (
    <div className="space-y-12">
      <Card padding="p-8 sm:p-10" className="relative overflow-hidden">
        <div
          aria-hidden
          className="from-osrs-gold/10 pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent"
        />
        <div className="relative">
          <h5 className="text-osrs-gold text-sm font-medium">
            Welcome to
            </h5>
          <h1 className="text-osrs-gold text-4xl font-bold tracking-tight sm:text-5xl">
            DropTracker.io
          </h1>
          <p className="text-osrs-parchment-dark/80 mt-3 max-w-xl text-base sm:text-lg">
            An all-in-one loot and achievement tracking solution for Old School RuneScape players and groups — featuring real-time notifications, leaderboards and events.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/leaderboards"
              className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              View leaderboards
            </Link>
            <Link
              href="/docs/getting-started"
              className="border-osrs-bronze/50 hover:bg-osrs-surface-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-osrs-gold text-xl font-semibold">Top players</h2>
            <Link href="/leaderboards" className="text-osrs-parchment-dark/70 text-sm hover:text-osrs-gold-bright">
              View all →
            </Link>
          </div>
          <LeaderboardTable entries={players.entries} scope="global" kind="players" />
        </section>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-osrs-gold text-xl font-semibold">Top clans</h2>
            <Link
              href="/leaderboards?tab=groups"
              className="text-osrs-parchment-dark/70 text-sm hover:text-osrs-gold-bright"
            >
              View all →
            </Link>
          </div>
          <LeaderboardTable entries={groups.entries} scope="global" kind="groups" />
        </section>
      </div>

      <section>
        <h2 className="text-osrs-gold mb-4 text-xl font-semibold">Latest news</h2>
        {news.items.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {news.items.map((a) => (
              <li key={a.id}>
                <Card padding="p-4" className="hover:border-osrs-gold/40 h-full transition-colors">
                  <Link href={`/announcements/${a.id}`} className="text-osrs-gold-bright font-medium">
                    {a.title}
                  </Link>
                  <p className="text-osrs-parchment-dark/80 mt-1 line-clamp-2 text-sm">{a.body_md}</p>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No announcements yet" hint="Check back soon for DropTracker news and updates." />
        )}
      </section>
    </div>
  );
}
