import { Suspense, cache } from "react";
import type { Route } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { AuthErrorBanner } from "@/components/auth-error-banner";
import { HeroSearch } from "@/components/hero-search";
import { EntityChip } from "@/components/ui";
import { toPlayerCard } from "@/lib/entity-card";
import { resolvePeriod } from "@/lib/period";
import { entityPath } from "@/lib/slug";
import { HeroRain, LivePill, Odometer, OdometerSkeleton } from "./hero";
import {
  EVENT_KIND_LABEL,
  GLOBAL_GROUP_ID,
  ONLINE_WINDOW_LABEL,
  formatCount,
  formatCountdown,
  liveEvents,
  monthName,
  notableDrops,
  npcIcon,
  toBoard,
  toFeedItem,
  toPlatformPulse,
  type BoardSet,
  type FeedItem,
} from "./home-data";
import { Leaderboard, LiveFeed, ServerResync, SessionPulse } from "./live-board";
import { DiscordPreview, LiveLootboard, type LootboardChoice } from "./showcase";

/**
 * The homepage (`/`), rendered inside the real site chrome. It was built and
 * reviewed as the signed-in-only candidate at /test-hero, which now redirects
 * here (next.config.ts).
 *
 * The rule for this page: every number, name and image on it is LIVE. Nothing
 * is curated, measured once and pasted in, or mocked up —
 *
 *   server render   leaderboards (day / week / month × players / clans), the
 *                   notable-drop feed history, intake counters and players
 *                   online from /status, public events, supporters, and the
 *                   platform summary: month total, account count, top bosses
 *   SSE `global`    one frame per credited drop platform-wide (~7/s): drives
 *                   the rain, the odometer, live overtakes on the player
 *                   boards and the since-you-arrived counters
 *   SSE `feed`      notable happenings: the feed list, the highlight tags in
 *                   the rain and the Discord announcement preview
 *   image server    lootboard PNGs the generator rewrites every few minutes
 *
 * The only static content is the explanatory copy.
 *
 * Static with ISR: nothing here reads cookies, headers or searchParams (every
 * api call is unauthenticated), so one render serves every visitor and is
 * refreshed at most every `revalidate` seconds. Keep it that way: a single
 * `cookies()` on this path would make the busiest page on the site render per
 * request. Anything visitor-specific belongs in a client island, like the
 * sign-in error banner below.
 */

export const revalidate = 15;

/** How often open tabs re-run this server component (see `useServerResync`). */
const RESYNC_SECONDS = 120;

/** Rows per leaderboard: a top ten, which also stands level with the feed beside it. */
const BOARD_ROWS = 10;

/**
 * Resolve within `ms`, else null. The underlying request is left to finish —
 * it still lands in Next's data cache, so the NEXT render gets it instantly.
 */
function within<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/**
 * Month total, account count and top bosses, platform-wide.
 *
 * This used to be `api.group(2)` — the global group's profile, which walks ~27k
 * members per uncached request: 3s warm, ~20s whenever a worker's cache was cold. The
 * summary endpoint reads the total the global lootboard already publishes and
 * a snapshot the backend keeps in Redis, so it answers in milliseconds.
 *
 * It is still memoised per render, capped, and awaited only inside <Suspense>:
 * the page must thin out rather than stall if the backend is having a bad day,
 * however fast the happy path is.
 */
const getPlatformSummary = cache(() => within(api.platformSummary(), 4_000));

/* -------------------------------------------------------------------------- */
/* Suspended sections (the ones fed by the platform summary)                  */
/* -------------------------------------------------------------------------- */

async function HeroOdometer({ month }: { month: string }) {
  const summary = await getPlatformSummary();
  return (
    <Odometer
      seed={summary?.monthly_loot?.value ?? null}
      month={month}
      accounts={summary?.member_count ?? null}
    />
  );
}

async function BossHeat() {
  const summary = await getPlatformSummary();
  const bosses = summary?.top_bosses ?? [];
  if (bosses.length === 0) {
    return <p className="hp-empty">Boss totals are being tallied. Check back in a minute.</p>;
  }
  const max = bosses[0]!.loot.value || 1;

  return (
    <ol className="hp-heat">
      {bosses.map((boss, i) => (
        <li key={boss.npc_id} className="hp-heat-row">
          <img src={npcIcon(boss.npc_id)} alt="" width={56} height={56} loading="lazy" />
          <div className="hp-heat-body">
            <div className="hp-heat-line">
              <Link href={entityPath("npcs", boss.npc_id, boss.name)} className="hp-link">
                <b>{boss.name}</b>
              </Link>
              <span className="hp-heat-value">{boss.loot.value_formatted}</span>
            </div>
            <div className="hp-heat-track" aria-hidden>
              <i
                style={{
                  width: `${Math.max(4, (boss.loot.value / max) * 100)}%`,
                  animationDelay: `${i * 90}ms`,
                }}
              />
            </div>
            <span className="hp-heat-sub">{formatCount(boss.drops)} drops recorded</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function HeatSkeleton() {
  return (
    <ol className="hp-heat" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="hp-heat-row" data-pending="true">
          <span className="hp-heat-ghost" />
          <div className="hp-heat-body">
            <div className="hp-heat-track">
              <i style={{ width: `${88 - i * 14}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Static copy                                                                */
/* -------------------------------------------------------------------------- */

const TRACKED = [
  { name: "Drops", note: "valued at live Grand Exchange prices" },
  { name: "Personal bests", note: "ranked per boss and team size" },
  { name: "Collection log", note: "every new slot as it fills" },
  { name: "Combat achievements", note: "task by task, tier by tier" },
  { name: "Pets", note: "the moment one follows you out" },
  { name: "Levels & quests", note: "milestones, announced if you like" },
  { name: "Diaries", note: "each tier as it completes" },
  { name: "Deaths", note: "optional, with your clan’s own messages" },
];

const DISCORD_POINTS = [
  {
    title: "A channel for everything",
    body: "Send drops, personal bests, collection logs and pets to separate channels, or keep it all in one.",
  },
  {
    title: "Your threshold, your rules",
    body: "Announce every drop or only the big ones. You can ask for a screenshot too.",
  },
  {
    title: "Boards that update themselves",
    body: "Lootboards and event standings are posted once, then edited in place. Your channel stays tidy.",
  },
];

const STEPS: { title: string; body: string; href: Route; link: string }[] = [
  {
    title: "Install the plugin",
    body: "Find DropTracker on the RuneLite Plugin Hub. Tracking starts right away, no account needed.",
    href: "/docs/runelite-plugin" as Route,
    link: "Plugin guide",
  },
  {
    title: "Link your account",
    body: "Sign in with Discord and claim your RuneScape names to unlock your profile, badges and notifications.",
    href: "/docs/link-account" as Route,
    link: "Linking guide",
  },
  {
    title: "Bring your clan",
    body: "Create a group for a shared lootboard, clan leaderboards, Discord announcements and events.",
    href: "/docs/create-group" as Route,
    link: "Group setup",
  },
];

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function HomePage() {
  const nowDate = new Date();
  const renderedAt = Math.floor(nowDate.getTime() / 1000);
  const month = monthName(nowDate);

  // Every read below decorates the page to some degree — a slow or unhappy
  // backend must thin the page out, never break it.
  const board = (period: string, kind: "players" | "clans") =>
    (kind === "players"
      ? api.playerLeaderboard({ scope: "global", limit: BOARD_ROWS, period })
      : api.groupLeaderboard({ limit: BOARD_ROWS, period })
    ).catch(() => null);

  const day = resolvePeriod("day");
  const week = resolvePeriod("week");
  const thisMonth = resolvePeriod("month");

  const feedPromise = api.recentFeed().catch(() => []);

  // The Discord preview's first announcement, stats included, so it paints
  // complete instead of fetching on mount.
  const announcedPromise = feedPromise.then(async (feed) => {
    const latest = notableDrops(feed, 1)[0] ?? null;
    if (!latest || latest.playerId === null) return { latest, card: null };
    const card = await within(api.player(latest.playerId).then(toPlayerCard), 2_500);
    return { latest, card };
  });

  const [
    dayPlayers,
    dayClans,
    weekPlayers,
    weekClans,
    monthPlayers,
    monthClans,
    feed,
    announced,
    status,
    supporters,
    events,
  ] = await Promise.all([
    board(day, "players"),
    board(day, "clans"),
    board(week, "players"),
    board(week, "clans"),
    board(thisMonth, "players"),
    board(thisMonth, "clans"),
    feedPromise,
    announcedPromise,
    api.statusSummary({ revalidate: 30 }).catch(() => null),
    api.supporters().catch(() => ({ groups: [], players: [] })),
    api.events({ status: "active" }).catch(() => []),
  ]);

  const boards: BoardSet = {
    day: { players: toBoard(dayPlayers), clans: toBoard(dayClans) },
    week: { players: toBoard(weekPlayers), clans: toBoard(weekClans) },
    month: { players: toBoard(monthPlayers), clans: toBoard(monthClans) },
  };

  const feedItems: FeedItem[] = feed
    .map((e) => toFeedItem(e.type, e.data, 0))
    .filter((item): item is FeedItem => item !== null && item.ts > 0)
    .sort((a, b) => b.ts - a.ts);

  const reel = notableDrops(feed, 10);
  const pulse = toPlatformPulse(status);
  const running = liveEvents(events, renderedAt, 3);
  const hasSupporters = supporters.groups.length > 0 || supporters.players.length > 0;

  const lootboards: LootboardChoice[] = [
    {
      groupId: GLOBAL_GROUP_ID,
      label: "All players",
      detail: `every tracked account’s ${month} on one board`,
    },
    ...boards.month.clans.rows.slice(0, 3).map((clan) => ({
      groupId: clan.id,
      label: clan.name,
      detail: `#${clan.rank} clan this month`,
    })),
  ];

  return (
    <>
      <ServerResync everySeconds={RESYNC_SECONDS} />

      {/* Failed Discord sign-ins land on `/?auth=<code>`. A client island, so
          the page itself never reads searchParams (which would break ISR). */}
      <AuthErrorBanner className="my-4" />

      {/* --- Hero: the rain, the counter it falls into, then the pitch ------- */}
      <section className="hp-hero hp-bleed" aria-labelledby="hp-title">
        <div className="hp-stage">
          <HeroRain reel={reel} />
          <div className="hp-shell hp-stage-meta">
            <LivePill />
            {/* A chart needs a key: what a streak is, and what its colour means
                (the same value tiers the feed and lootboards use). */}
            <span className="hp-legend">
              each streak is one real drop, as it lands
              <span aria-hidden>
                <i data-tier="1m" />
                1M+
                <i data-tier="10m" />
                10M+
                <i data-tier="100m" />
                100M+
              </span>
            </span>
            {pulse && pulse.playersOnline !== null && (
              <span className="hp-stage-stat">
                <b>{formatCount(pulse.playersOnline)}</b> players online ({ONLINE_WINDOW_LABEL})
              </span>
            )}
          </div>
        </div>

        <div className="hp-ledger">
          <div className="hp-shell">
            <Suspense fallback={<OdometerSkeleton />}>
              <HeroOdometer month={month} />
            </Suspense>
          </div>
        </div>

        <div className="hp-shell hp-pitch">
          <p className="hp-kicker">Welcome to</p>
          {/* No whitespace before the span: the suffix butts up against the
              wordmark, "DropTracker(.io)". */}
          <h1 id="hp-title">
            The DropTracker<span className="hp-title-tld">(.io)</span>
          </h1>
          <p className="hp-lede">
            An all-in-one loot and achievement tracker for Old School RuneScape players and
            groups. Real-time Discord notifications, live leaderboards and clan events, all
            powered by one RuneLite plugin.
          </p>

          {/* The site's own homepage search — same component, same behaviour. */}
          <div className="hp-search">
            <HeroSearch />
          </div>

          <div className="hp-cta">
            <Link className="hp-btn hp-btn-primary" href="/docs/getting-started">
              Get started
            </Link>
            <Link className="hp-btn" href="/leaderboards">
              View leaderboards
            </Link>
            <Link className="hp-btn hp-btn-quiet" href="/docs">
              Browse the docs →
            </Link>
          </div>
        </div>
      </section>

      {/* --- What you get -------------------------------------------------------- */}
      <section className="hp-section" aria-labelledby="hp-product">
        <header className="hp-section-head">
          <p className="hp-kicker">What you get</p>
          <h2 id="hp-product">Install one plugin. The rest happens by itself.</h2>
          <p>
            No forms to fill in and no screenshots to paste. The plugin spots your drop, we value
            and verify it, and everything updates within seconds.
          </p>
        </header>

        <div className="hp-grid hp-grid-product">
          <div className="hp-stack">
            <DiscordPreview seed={announced.latest} seedCard={announced.card} month={month} />

            <ul className="hp-points">
              {DISCORD_POINTS.map((point) => (
                <li key={point.title}>
                  <b>{point.title}</b>
                  <span>{point.body}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="hp-stack">
            <section className="hp-panel" aria-labelledby="hp-tracked-title">
              <header className="hp-panel-head">
                <h3 id="hp-tracked-title">Everything your account does</h3>
              </header>
              <ul className="hp-tracked">
                {TRACKED.map((t) => (
                  <li key={t.name}>
                    <b>{t.name}</b>
                    <span>{t.note}</span>
                  </li>
                ))}
              </ul>
              <p className="hp-panel-note">
                Drops over 1M are checked against the OSRS Wiki to confirm they can really come
                from that source.
              </p>
            </section>

            <section className="hp-panel" aria-labelledby="hp-events-title">
              <header className="hp-panel-head">
                <h3 id="hp-events-title">Events that score themselves</h3>
                <span className="hp-stream" data-state={running.length > 0 ? "open" : undefined}>
                  {running.length > 0 && <i aria-hidden />}
                  {running.length > 0 ? `${running.length} public, running now` : "none public right now"}
                </span>
              </header>

              {running.length > 0 ? (
                <ul className="hp-events">
                  {running.map((event) => {
                    const left = event.ends_at ? formatCountdown(event.ends_at, renderedAt) : null;
                    return (
                      <li key={event.id}>
                        <Link href={`/events/${event.id}` as Route} className="hp-link">
                          <b>{event.name}</b>
                        </Link>
                        <span>
                          {EVENT_KIND_LABEL[event.kind]}
                          {left && ` · ${left} left`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              <p className="hp-panel-note">
                Bingo, board-game races, loot sweeps and Skill or Boss of the Week, with teams,
                sign-ups and prize pots built in. Tiles complete automatically from your
                submissions, so nobody needs a spreadsheet.{" "}
                <Link href="/events" className="hp-link">
                  Browse events →
                </Link>
              </p>
            </section>
          </div>
        </div>
      </section>

      {/* --- Get started ------------------------------------------------------------ */}
      <section className="hp-section" aria-labelledby="hp-start">
        <header className="hp-section-head">
          <p className="hp-kicker">Get started</p>
          <h2 id="hp-start">From install to your first tracked drop in minutes.</h2>
        </header>

        <ol className="hp-steps">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="hp-step-n" aria-hidden>
                {i + 1}
              </span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              <Link href={step.href} className="hp-more">
                {step.link} →
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* --- Supporters: the thank-you, and the ask ---------------------------------------
          Always rendered: the wall only appears once someone subscribes, but the
          ask to support the project stands on its own. */}
      <section className="hp-section" aria-labelledby="hp-supporters">
        <header className="hp-section-head">
          <p className="hp-kicker">Thank you</p>
          <h2 id="hp-supporters">Kept running by the people who use it.</h2>
          <p>
            {hasSupporters && "DropTracker is funded by the clans and players below. "}A
            subscription keeps the servers running and unlocks premium features for your whole
            clan.
          </p>
          <div className="hp-cta">
            <Link className="hp-btn hp-btn-primary" href="/premium">
              Become a supporter
            </Link>
          </div>
        </header>

        {supporters.groups.length > 0 && (
          <ul className="hp-supporters">
            {supporters.groups.map((g) => (
              <li key={g.id}>
                <EntityChip
                  href={entityPath("groups", g.id, g.name)}
                  name={g.name}
                  subtitle={`${g.tier_name} · ${formatCount(g.member_count)} ${
                    g.member_count === 1 ? "member" : "members"
                  }`}
                  flair={g.flair?.style}
                  flairTitle={g.flair?.tier_name ?? g.tier_name}
                />
              </li>
            ))}
          </ul>
        )}

        {supporters.players.length > 0 && (
          <ul className="hp-supporters" data-compact="true">
            {supporters.players.map((p) => (
              <li key={p.user_id}>
                <EntityChip
                  href={entityPath("players", p.player_id, p.name)}
                  name={p.name}
                  size="sm"
                  playerId={p.player_id}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Right now -------------------------------------------------------- */}
      <section className="hp-section" aria-labelledby="hp-now">
        <header className="hp-section-head">
          <p className="hp-kicker">Happening now</p>
          <h2 id="hp-now">This page is live.</h2>
          <p>
            Every number, feed and leaderboard here updates automatically as drops come in. No
            refresh needed.
          </p>
        </header>

        <div className="hp-grid hp-grid-now">
          <LiveFeed seed={feedItems} renderedAt={renderedAt} />
          <Leaderboard boards={boards} />
        </div>
      </section>

      {/* --- By the numbers ---------------------------------------------------- */}
      <section className="hp-band" aria-label="DropTracker by the numbers">
        {/* dt before dd, as a <dl> requires — the stylesheet puts the figure on top. */}
        <dl className="hp-figures">
          {pulse && (
            <div>
              <dt>
                submissions processed <span>in the last 24 hours</span>
              </dt>
              <dd>{formatCount(pulse.processed24h)}</dd>
            </div>
          )}
          {pulse && (
            <div>
              <dt>
                processed just now <span>in the last 5 minutes</span>
              </dt>
              <dd>{formatCount(pulse.processed5m)}</dd>
            </div>
          )}
          <div>
            <dt>
              players ranked <span>in {month}</span>
            </dt>
            <dd>{formatCount(boards.month.players.ranked)}</dd>
          </div>
          <div>
            <dt>
              clans competing <span>in {month}</span>
            </dt>
            <dd>{formatCount(boards.month.clans.ranked)}</dd>
          </div>
        </dl>
      </section>

      {/* --- The month so far --------------------------------------------------- */}
      <section className="hp-section" aria-labelledby="hp-month">
        <header className="hp-section-head">
          <p className="hp-kicker">{month} so far</p>
          <h2 id="hp-month">Where the loot is coming from.</h2>
          <p>
            Totals reset on the 1st of every month. These are the bosses paying out the most so
            far, and the lootboards being drawn from it all.
          </p>
        </header>

        <div className="hp-grid hp-grid-month">
          <div className="hp-stack">
            <section className="hp-panel" aria-labelledby="hp-heat-title">
              <header className="hp-panel-head">
                <h3 id="hp-heat-title">Richest bosses this month</h3>
                <span className="hp-stream">all tracked accounts</span>
              </header>
              <Suspense fallback={<HeatSkeleton />}>
                <BossHeat />
              </Suspense>
            </section>

            <SessionPulse />
          </div>

          <section className="hp-panel" aria-labelledby="hp-board-title">
            <header className="hp-panel-head">
              <h3 id="hp-board-title">Lootboards</h3>
              <span className="hp-stream">redrawn every few minutes</span>
            </header>
            <LiveLootboard choices={lootboards} renderedAt={renderedAt} />
            <p className="hp-panel-note">
              A lootboard is your clan&rsquo;s month in one image: top looters, best items and the
              latest drops. We keep it up to date in a Discord channel of your choice.
            </p>
          </section>
        </div>
      </section>

      {/* --- Close: status + call to action ---------------------------------------------- */}
      <section className="hp-close" aria-labelledby="hp-close-title">
        <div>
          <h2 id="hp-close-title">Your next drop could be on this page.</h2>
          <p>
            Install the plugin and you are tracked from the first kill. Sign in with Discord to
            claim your account, then bring your clan along.
          </p>
          <div className="hp-cta">
            <Link className="hp-btn hp-btn-primary" href="/docs/getting-started">
              Get started
            </Link>
            <a className="hp-btn" href="/discord">
              Join the Discord
            </a>
          </div>
        </div>

        {pulse && (
          <p className="hp-status" data-state={pulse.state}>
            <i aria-hidden />
            <b>
              {pulse.state === "operational"
                ? "All systems operational"
                : pulse.state === "degraded"
                  ? "Running degraded"
                  : "Intake is offline"}
            </b>
            <span>
              {formatCount(pulse.processed30m)} submissions in the last 30 minutes
              {pulse.openIssues > 0 &&
                ` · ${pulse.openIssues} known ${pulse.openIssues === 1 ? "issue" : "issues"}`}
            </span>
          </p>
        )}
      </section>
    </>
  );
}
