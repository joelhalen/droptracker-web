import Link from "next/link";
import type { EventDetail } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { DEFAULT_PERIOD, resolvePeriod } from "@/lib/period";
import { type DialGroup } from "./dial";
import { toRow, type FeedRow } from "./feed-rows";
import { Hero } from "./hero";
import { toNotableDrop, type NotableDrop } from "./latest-drop";
import { LiveFeed, StatGrid } from "./live-feed";
import { Reveal } from "./motion";
import {
  BoardShowcase,
  DiscordDemo,
  EventsShowcase,
  Gallery,
  SupportersWall,
} from "./showcase";
import { ARTWORK, DROP_SHOTS, GLOBAL_GROUP_ID } from "./showcase-data";

/**
 * /test-hero — prototype homepage. Signed-in visitors only (see ./layout.tsx),
 * rendered inside the real site chrome.
 *
 * Two kinds of content, on purpose:
 *  - LIVE, fetched here on every render: monthly totals and account count from
 *    the global group, leaderboards, the recent drop feed (which the client
 *    then keeps updating over SSE), supporters, and a real public bingo board.
 *  - CURATED, in ./showcase-data.ts: the drop screenshots and the generated
 *    DropTracker artwork (lootboards, the Discord embed, the plugin panel).
 *    Real submissions, mined from the production `drops` table.
 *
 * No `revalidate` export: the layout's guard reads cookies, so this route is
 * always dynamically rendered and a segment revalidate would be dead config.
 * Freshness comes from the per-fetch `revalidate` hints inside lib/api.ts.
 */

const PIPELINE = [
  {
    title: "The plugin sees it first",
    body: "DropTracker runs inside RuneLite. When a drop lands, a boss dies, a log slot fills or an achievement completes, it captures the event and the screenshot.",
    tags: ["Drops", "Personal bests", "Collection log", "Combat achievements", "Pets", "Levels"],
  },
  {
    title: "We value it and check it",
    body: "Every item is priced against live Grand Exchange data with our own override table for untradeables. Anything over 1M is checked against the wiki to confirm it can actually drop from that source.",
    tags: ["Live GE pricing", "Value overrides", "Source verification", "Deduplication"],
  },
  {
    title: "Everything else happens by itself",
    body: "Leaderboards update, your clan's lootboard regenerates, Discord gets the announcement, event boards tick over, and your profile reflects it — within seconds.",
    tags: ["Leaderboards", "Lootboards", "Discord", "Events", "Profiles"],
  },
];

/** Clans on the dial's inner ring. */
const DIAL_GROUPS = 6;

/**
 * Resolve the top clans for the dial.
 *
 * The leaderboard gives rank/name/loot but no icon or member count, so each one
 * is topped up from its profile. Six extra cached reads at render is a fair
 * price for a ring that shows real clan identity; any that fail are simply
 * dropped rather than rendering a hole.
 */
async function dialGroups(entries: { id: number; name: string; rank: number }[]): Promise<DialGroup[]> {
  const resolved = await Promise.all(
    entries.slice(0, DIAL_GROUPS).map(async (entry) => {
      const profile = await api.group(entry.id).catch(() => null);
      if (!profile) return null;
      return {
        id: entry.id,
        name: profile.name || entry.name,
        rank: profile.global_rank ?? entry.rank,
        memberCount: profile.member_count,
        monthlyLoot: profile.monthly_loot?.value ?? 0,
        iconUrl: profile.icon_url ?? null,
      } satisfies DialGroup;
    }),
  );
  return resolved.filter((g): g is DialGroup => g !== null);
}

/**
 * Pick a public bingo event whose board is worth showing: prefer the global
 * DropTracker group's, then any other active public one with cells.
 */
async function liveBingoEvent(): Promise<EventDetail | null> {
  const events = await api.events({ status: "active" }).catch(() => []);
  const candidates = events
    .filter((e) => e.kind === "bingo" && e.visibility === "public" && e.has_bingo)
    .sort((a, b) => Number(b.group_id === GLOBAL_GROUP_ID) - Number(a.group_id === GLOBAL_GROUP_ID));

  for (const candidate of candidates.slice(0, 3)) {
    const detail = await api.event(candidate.id).catch(() => null);
    if (detail?.bingo && detail.bingo.cells.length > 0) return detail;
  }
  return null;
}

export default async function TestHeroPage() {
  const period = resolvePeriod(DEFAULT_PERIOD);

  // Everything here is decorative to some degree — a slow or unhappy backend
  // must degrade the page, never break it.
  const [globalGroup, players, groups, feed, supporters, bingoEvent] = await Promise.all([
    api.group(GLOBAL_GROUP_ID).catch(() => null),
    api
      .playerLeaderboard({ scope: "global", limit: 8, period })
      .catch(() => ({ entries: [], meta: { page: 1, limit: 0, total: 0 } })),
    api
      .groupLeaderboard({ limit: 8, period })
      .catch(() => ({ entries: [], meta: { page: 1, limit: 0, total: 0 } })),
    api.recentFeed().catch(() => []),
    api.supporters().catch(() => ({ groups: [], players: [] })),
    liveBingoEvent(),
  ]);

  // Seed rows for the live panel; the client takes over from here via SSE.
  const seedRows: FeedRow[] = feed
    .map((event, i) => toRow(event.type, event.data, `seed-${i}`, false))
    .filter((row): row is FeedRow => row !== null)
    .slice(0, 14);

  // Seed for the hero's "latest notable drop" line: the NEWEST drop over the
  // notable bar, not the biggest. Picking the biggest meant one 1.4B Twisted
  // bow could sit there for hours; the client then keeps this current over SSE.
  const latestDrop: NotableDrop | null =
    feed
      .map((e) => toNotableDrop(e.type, e.data, Number(e.data.ts ?? 0)))
      .filter((d): d is NotableDrop => d !== null)
      .sort((a, b) => b.ts - a.ts)[0] ?? null;

  const topGroups = await dialGroups(groups.entries);

  return (
    <>
      <Hero
        monthlyLoot={globalGroup?.monthly_loot?.value ?? 0}
        playersTracked={globalGroup?.member_count ?? 0}
        rankedPlayers={players.meta.total}
        rankedClans={groups.meta.total}
        latestDrop={latestDrop}
        topGroups={topGroups}
      />

      {/* --- 1. How it works --------------------------------------------- */}
      <section className="th-section" id="capture">
        <Reveal className="th-split-head">
          <div className="th-section-head" style={{ marginBottom: 0 }}>
            <span className="th-eyebrow">How it works</span>
            <h2 className="th-display">You play. We do the paperwork.</h2>
            <p className="th-lede">
              There is no form to fill in and no screenshot to paste. Install the plugin once and
              everything meaningful that happens in your account is captured, valued, ranked and
              announced.
            </p>
          </div>

          {/* The actual in-client side panel, not a mock-up. */}
          <figure className="th-frame th-panel-shot">
            <div className="th-frame-bar">
              <i />
              <i />
              <i />
              RuneLite
              <span>DropTracker side panel</span>
            </div>
            <img
              src={ARTWORK.plugin}
              alt="The DropTracker panel inside RuneLite, showing clan, minimum value, personal total and clan total"
              loading="lazy"
            />
          </figure>
        </Reveal>

        <div className="th-pipeline">
          {PIPELINE.map((step, i) => (
            <Reveal key={step.title} delay={i * 110} className="th-step">
              <span className="th-step-n" aria-hidden />
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              <ul>
                {step.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </section>

      {/* --- 2. Notable drops --------------------------------------------- */}
      <section className="th-section" id="proof">
        <Reveal className="th-section-head">
          <span className="th-eyebrow">Notable drops</span>
          <h2 className="th-display">Proof, attached automatically.</h2>
          <p className="th-lede">
            Every screenshot below is the exact image a real submission carried into Discord — chat
            box, kill timer, party damage and all. Click any of them.
          </p>
        </Reveal>

        <Gallery />
      </section>

      {/* --- 3. Boards + leaderboards ------------------------------------- */}
      <section className="th-section" id="boards">
        <Reveal className="th-section-head">
          <span className="th-eyebrow">Your clan&apos;s front page</span>
          <h2 className="th-display">One board. Everyone&apos;s month.</h2>
          <p className="th-lede">
            Lootboards are rendered in the game&apos;s own interface font from your clan&apos;s real
            submissions and refreshed automatically. Global and per-clan leaderboards run off the
            same data, in real time.
          </p>
        </Reveal>

        <BoardShowcase players={players.entries} totalPlayers={players.meta.total} />
      </section>

      {/* --- 4. Discord ---------------------------------------------------- */}
      <section className="th-section" id="discord">
        <Reveal className="th-section-head">
          <span className="th-eyebrow">Discord integration</span>
          <h2 className="th-display">Where your clan already lives.</h2>
          <p className="th-lede">
            Invite the bot, pick your channels, set a value threshold. Every qualifying submission
            is announced with the item, its source and value, the player&apos;s monthly total and
            their rank — with the proof attached.
          </p>
        </Reveal>

        <DiscordDemo />
      </section>

      {/* --- 5. Events ----------------------------------------------------- */}
      {bingoEvent?.bingo && (
        <section className="th-section" id="events">
          <Reveal className="th-section-head">
            <span className="th-eyebrow">Events</span>
            <h2 className="th-display">Boards that fill themselves in.</h2>
          </Reveal>

          <Reveal>
            <EventsShowcase
              board={bingoEvent.bingo}
              tasks={bingoEvent.tasks}
              eventId={bingoEvent.id}
              eventName={bingoEvent.name}
            />
          </Reveal>
        </section>
      )}

      {/* --- 6. Supporters -------------------------------------------------- */}
      <section className="th-section" id="supporters">
        <Reveal className="th-section-head">
          <span className="th-eyebrow">Thank you</span>
          <h2 className="th-display">Kept running by these clans.</h2>
          <p className="th-lede">
            DropTracker is funded by the clans and players who subscribe. If your clan gets value
            out of it,{" "}
            <Link href="/premium" className="th-inline-link">
              a subscription
            </Link>{" "}
            keeps the lights on — and unlocks premium features for everyone in it.
          </p>
        </Reveal>

        <SupportersWall supporters={supporters} />
      </section>

      {/* --- 7. Live ------------------------------------------------------- */}
      <section className="th-section" id="live">
        <Reveal className="th-section-head">
          <span className="th-eyebrow">Right now</span>
          <h2 className="th-display">This is happening while you read.</h2>
        </Reveal>

        <div className="th-live">
          <Reveal>
            <LiveFeed seed={seedRows} />
          </Reveal>

          <Reveal delay={120}>
            <div className="th-lb">
              <div className="th-lb-head">
                <span>Top clans</span>
                <span>{groups.meta.total.toLocaleString()} ranked</span>
              </div>
              {groups.entries.map((entry, i) => {
                const max = groups.entries[0]?.loot.value ?? 1;
                return (
                  <div key={entry.id} className="th-lb-row" data-top={i === 0}>
                    <span
                      className="th-lb-bar"
                      style={{
                        ["--th-w" as string]: `${Math.max(6, (entry.loot.value / max) * 100)}%`,
                        ["--th-delay" as string]: `${i * 70}ms`,
                      }}
                    />
                    <span className="th-lb-rank">{entry.rank}</span>
                    <span className="th-lb-name">
                      <Link href={`/groups/${entry.id}`}>{entry.name}</Link>
                    </span>
                    <span className="th-lb-val">{entry.loot.value_formatted}</span>
                  </div>
                );
              })}
              <Link className="th-lb-more" href="/leaderboards?tab=groups">
                All clans →
              </Link>
            </div>
          </Reveal>
        </div>

        <Reveal delay={80}>
          <div style={{ marginTop: "clamp(1.5rem, 3vw, 2.5rem)" }}>
            <StatGrid
              monthlyLoot={globalGroup?.monthly_loot?.value ?? 0}
              playersTracked={globalGroup?.member_count ?? 0}
              rankedClans={groups.meta.total}
            />
          </div>
        </Reveal>
      </section>

      {/* --- 8. Close ------------------------------------------------------ */}
      <section className="th-section">
        <Reveal>
          <div className="th-cta">
            <div className="th-cta-bg" aria-hidden>
              {[...DROP_SHOTS, ...DROP_SHOTS].map((drop, i) => (
                <img
                  key={`${drop.dropId}-${i}`}
                  src={`https://www.droptracker.io/img/itemdb/${drop.itemId}.png`}
                  alt=""
                  loading="lazy"
                />
              ))}
            </div>
            <div>
              <h2>Start tracking in about two minutes.</h2>
              <p className="th-lede">
                Install the plugin and your drops start recording immediately. Sign in with Discord
                to claim your accounts, then bring the clan for lootboards, leaderboards,
                announcements and events.
              </p>
              <div className="th-cta-row">
                <Link className="th-btn th-btn-primary" href="/docs/getting-started">
                  Get started
                </Link>
                <Link className="th-btn th-btn-ghost" href="/leaderboards">
                  View leaderboards
                </Link>
                <a className="th-btn th-btn-ghost" href="/discord">
                  Join the Discord
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
