import type { Route } from "next";
import Link from "next/link";
import { api, type FeedEvent } from "@/lib/api";
import { groupDocsByCategory } from "@/lib/docs";
import { HeroSearch } from "@/components/hero-search";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { SupportersSection } from "@/components/supporters-section";
import { Card, EmptyState } from "@/components/ui";
import { DEFAULT_PERIOD, resolvePeriod } from "@/lib/period";

// Public homepage: SSR snapshot with ISR; client hydrates live updates.
export const revalidate = 15;

/**
 * Fixed slots for the hero's recent-drop icon collage — hand-placed so icons
 * drift toward the right edge, away from the headline and search field.
 * Purely decorative: low opacity under a surface-colored gradient.
 */
const COLLAGE_SLOTS = [
  { top: "8%", left: "58%", size: 40, rotate: -8 },
  { top: "62%", left: "55%", size: 34, rotate: 12 },
  { top: "30%", left: "64%", size: 52, rotate: 5 },
  { top: "74%", left: "68%", size: 38, rotate: -14 },
  { top: "12%", left: "72%", size: 36, rotate: 18 },
  { top: "48%", left: "74%", size: 46, rotate: -5 },
  { top: "80%", left: "80%", size: 34, rotate: 8 },
  { top: "6%", left: "85%", size: 44, rotate: -12 },
  { top: "38%", left: "86%", size: 38, rotate: 15 },
  { top: "66%", left: "90%", size: 50, rotate: -6 },
  { top: "16%", left: "94%", size: 36, rotate: 6 },
  { top: "44%", left: "96%", size: 32, rotate: -16 },
] as const;

/** Unique item-icon URLs from the recent global drop feed, capped to the collage size. */
function collageIcons(feed: FeedEvent[]): string[] {
  const seen = new Set<string>();
  for (const event of feed) {
    if (event.type !== "drop") continue;
    const url = event.data.icon_url;
    if (typeof url === "string" && url) seen.add(url);
    if (seen.size >= COLLAGE_SLOTS.length) break;
  }
  return [...seen];
}

const GETTING_STARTED_STEPS = [
  {
    step: "1",
    title: "Install the plugin",
    body: "Grab DropTracker from the RuneLite Plugin Hub — drops start tracking immediately, no signup needed.",
    href: "/docs/runelite-plugin" as Route,
    linkText: "Plugin guide",
  },
  {
    step: "2",
    title: "Link your account",
    body: "Sign in with Discord and claim your RuneScape accounts to unlock profiles, badges and notifications.",
    href: "/docs/link-account" as Route,
    linkText: "Linking guide",
  },
  {
    step: "3",
    title: "Bring your clan",
    body: "Create a group to get shared lootboards, leaderboards, Discord announcements and events.",
    href: "/docs/create-group" as Route,
    linkText: "Group setup",
  },
];

export default async function HomePage() {
  // Default to the current month — the tracking system works month-to-month.
  const period = resolvePeriod(DEFAULT_PERIOD);
  const [players, groups, news, docs, feed, supporters] = await Promise.all([
    api.playerLeaderboard({ scope: "global", limit: 10, period }),
    api.groupLeaderboard({ limit: 5, period }),
    api.announcements("global"),
    // Docs, the drop feed and the supporters wall only decorate the page —
    // never let them break it.
    api.docs().catch(() => []),
    api.recentFeed().catch(() => []),
    api.supporters().catch(() => ({ groups: [], players: [] })),
  ]);
  const icons = collageIcons(feed);
  const docCategories = groupDocsByCategory(docs);

  return (
    <div className="space-y-12">
      <Card padding="p-8 sm:p-12" className="relative overflow-hidden">
        {/* Decorative backdrop: item icons from recent global drops, washed
            out under a left-to-right surface gradient so the copy and search
            field stay fully readable. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {icons.map((url, i) => {
            const slot = COLLAGE_SLOTS[i]!;
            return (
              <img
                key={url}
                src={url}
                alt=""
                loading="lazy"
                className="absolute opacity-25"
                style={{
                  top: slot.top,
                  left: slot.left,
                  width: slot.size,
                  height: slot.size,
                  transform: `rotate(${slot.rotate}deg)`,
                  objectFit: "contain",
                }}
              />
            );
          })}
          <div className="from-osrs-surface-1 via-osrs-surface-1/85 absolute inset-0 bg-gradient-to-r to-transparent" />
          <div className="from-osrs-gold/10 absolute inset-0 bg-gradient-to-br via-transparent to-transparent" />
        </div>

        <div className="relative">
          <h5 className="text-osrs-gold text-sm font-medium">Welcome to</h5>
          <h1 className="text-osrs-gold text-4xl font-bold tracking-tight sm:text-5xl">
            DropTracker.io
          </h1>
          <p className="text-osrs-parchment-dark/80 mt-3 max-w-xl text-base sm:text-lg">
            An all-in-one loot and achievement tracking solution for Old School RuneScape players
            and groups — featuring real-time notifications, leaderboards and events.
          </p>

          <div className="mt-6">
            <HeroSearch />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/docs/getting-started"
              className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              Get started
            </Link>
            <Link
              href="/leaderboards"
              className="border-osrs-bronze/50 hover:bg-osrs-surface-2 rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors"
            >
              View leaderboards
            </Link>
            <Link
              href="/docs"
              className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright px-1 py-2.5 text-sm font-medium transition-colors"
            >
              Browse the docs →
            </Link>
          </div>
        </div>
      </Card>

      <section aria-labelledby="get-started-heading">
        <h2 id="get-started-heading" className="text-osrs-gold mb-4 text-xl font-semibold">
          Get started in minutes
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {GETTING_STARTED_STEPS.map((s) => (
            <Card key={s.step} padding="p-5" className="flex flex-col">
              <span
                aria-hidden
                className="bg-osrs-bronze/20 text-osrs-gold border-osrs-bronze/40 flex size-8 items-center justify-center rounded-full border text-sm font-bold"
              >
                {s.step}
              </span>
              <h3 className="text-osrs-parchment mt-3 font-semibold">{s.title}</h3>
              <p className="text-osrs-parchment-dark/75 mt-1 flex-1 text-sm">{s.body}</p>
              <Link
                href={s.href}
                className="text-osrs-gold-bright mt-3 text-sm font-medium hover:underline"
              >
                {s.linkText} →
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* min-w-0: without it the tables' intrinsic min-content width propagates
          through the grid items and stretches the page past the viewport on
          mobile (overflow-x-auto alone doesn't cap intrinsic size). */}
      <div className="grid gap-8 lg:grid-cols-3">
        <section className="min-w-0 lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-osrs-gold text-xl font-semibold">Top players</h2>
            <Link href="/leaderboards" className="text-osrs-parchment-dark/70 text-sm hover:text-osrs-gold-bright">
              View all →
            </Link>
          </div>
          <LeaderboardTable entries={players.entries} scope="global" kind="players" />
        </section>

        <section className="min-w-0">
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

      <SupportersSection supporters={supporters} />

      {docCategories.length > 0 && (
        <section aria-labelledby="docs-heading">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 id="docs-heading" className="text-osrs-gold text-xl font-semibold">
              Documentation
            </h2>
            <Link href="/docs" className="text-osrs-parchment-dark/70 text-sm hover:text-osrs-gold-bright">
              Browse all →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {docCategories.map((g) => (
              <Card key={g.category} padding="p-5">
                <h3 className="heading-rule text-osrs-gold mb-2 pb-1 text-sm font-semibold">
                  {g.category}
                </h3>
                <ul className="space-y-1.5">
                  {g.docs.slice(0, 4).map((d) => (
                    <li key={d.slug}>
                      <Link
                        href={`/docs/${d.slug}` as Route}
                        className="text-osrs-parchment-dark/85 hover:text-osrs-gold-bright text-sm"
                      >
                        {d.title}
                      </Link>
                    </li>
                  ))}
                  {g.docs.length > 4 && (
                    <li>
                      <Link
                        href="/docs"
                        className="text-osrs-parchment-dark/50 hover:text-osrs-gold-bright text-xs"
                      >
                        +{g.docs.length - 4} more
                      </Link>
                    </li>
                  )}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      )}

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
