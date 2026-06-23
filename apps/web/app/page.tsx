import Link from "next/link";
import { api } from "@/lib/api";
import { LeaderboardTable } from "@/components/leaderboard-table";

// Public homepage: SSR snapshot with ISR; client hydrates live updates.
export const revalidate = 15;

export default async function HomePage() {
  const [players, groups, news] = await Promise.all([
    api.playerLeaderboard({ scope: "global", limit: 10 }),
    api.groupLeaderboard({ limit: 5 }),
    api.announcements("global"),
  ]);

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-osrs-gold mb-1 text-3xl font-bold">Loot leaderboards</h1>
        <p className="text-osrs-parchment-dark/80">
          Live Old School RuneScape drop tracking. Updated in real time as drops come in.
        </p>
      </section>

      <div className="grid gap-10 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="heading-rule mb-4 flex items-baseline justify-between pb-1">
            <h2 className="text-osrs-gold text-xl font-semibold">Top players</h2>
            <Link href="/leaderboards" className="text-osrs-parchment-dark/70 text-sm hover:text-osrs-gold-bright">
              View all →
            </Link>
          </div>
          <LeaderboardTable entries={players.entries} scope="global" kind="players" />
        </section>

        <section>
          <div className="heading-rule mb-4 flex items-baseline justify-between pb-1">
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
        <div className="heading-rule mb-4 pb-1">
          <h2 className="text-osrs-gold text-xl font-semibold">Latest news</h2>
        </div>
        <ul className="space-y-3">
          {news.items.map((a) => (
            <li key={a.id} className="border-osrs-bronze/20 rounded border p-4">
              <Link href={`/announcements/${a.id}`} className="text-osrs-gold-bright font-medium">
                {a.title}
              </Link>
              <p className="text-osrs-parchment-dark/80 mt-1 line-clamp-2 text-sm">{a.body_md}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
