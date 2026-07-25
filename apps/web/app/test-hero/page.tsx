import Link from "next/link";
import type { Route } from "next";
import { api } from "@/lib/api";
import { DEFAULT_PERIOD, resolvePeriod } from "@/lib/period";
import { toRow, type FeedRow } from "./feed-rows";
import { Hero, TopBar } from "./hero";
import { LiveFeed, StatGrid } from "./live-feed";
import { Reveal } from "./motion";
import {
  BoardShowcase,
  DiscordDemo,
  DropReel,
  EventsShowcase,
  Gallery,
} from "./showcase";
import { ARTWORK, CONSTELLATION_ITEMS, DROP_SHOTS, itemIcon } from "./showcase-data";

/**
 * /test-hero — admin-only prototype of a production landing page for
 * DropTracker. Guarded in ./layout.tsx.
 *
 * The page mixes two kinds of content, on purpose:
 *  - LIVE, fetched here on every render: leaderboards, ranked player/clan
 *    counts, and the recent drop feed (which the client then keeps updating
 *    over SSE).
 *  - CURATED, in ./showcase-data.ts: the media. Real high-value submissions
 *    (screenshots + replay-buffer clips) mined from the production `drops`
 *    table, plus real generated DropTracker artwork — lootboards, bingo and
 *    board-game renders, the Discord embed. Nothing on this page is stock art.
 */

/*
 * No page-level `revalidate`: the layout's superadmin guard reads cookies, so
 * this route is always dynamically rendered and a segment revalidate would be
 * dead config. Freshness comes from the per-fetch `revalidate` hints inside
 * lib/api.ts (leaderboards 15s, feed 60s), which still populate the data cache.
 */

/** Sum of the ranked players we fetched — a live, honestly-labelled headline number. */
function sumLoot(entries: { loot: { value: number } }[]): number {
  return entries.reduce((total, e) => total + e.loot.value, 0);
}

const PIPELINE = [
  {
    title: "The plugin sees it first",
    body: "DropTracker runs inside RuneLite. When a drop lands, a boss dies, a log slot fills or an achievement completes, it captures the event, the screenshot and — for the big ones — the seconds of footage around it.",
    tags: ["Drops", "Personal bests", "Collection log", "Combat achievements", "Pets", "Levels"],
  },
  {
    title: "We value it and check it",
    body: "Every item is priced against live Grand Exchange data with our own override table for untradeables. Anything over 1M is checked against the wiki to confirm the item can actually drop from that source.",
    tags: ["Live GE pricing", "Value overrides", "Source verification", "Deduplication"],
  },
  {
    title: "Everything else happens by itself",
    body: "Leaderboards update, your clan's lootboard regenerates, Discord gets the announcement, event boards tick over, and your profile page reflects it — within seconds, with no action from you.",
    tags: ["Leaderboards", "Lootboards", "Discord", "Events", "Profiles"],
  },
];

export default async function TestHeroPage() {
  const period = resolvePeriod(DEFAULT_PERIOD);

  // Everything decorative is fetched defensively — a slow or unhappy backend
  // must degrade the page, never break it.
  const [players, groups, feed] = await Promise.all([
    api
      .playerLeaderboard({ scope: "global", limit: 100, period })
      .catch(() => ({ entries: [], meta: { page: 1, limit: 0, total: 0 } })),
    api
      .groupLeaderboard({ limit: 8, period })
      .catch(() => ({ entries: [], meta: { page: 1, limit: 0, total: 0 } })),
    api.recentFeed().catch(() => []),
  ]);

  const monthlyGp = sumLoot(players.entries);
  const topPlayers = players.entries.slice(0, 8);

  // Seed rows for the live panel; the client takes over from here via SSE.
  const seedRows: FeedRow[] = feed
    .map((event, i) => toRow(event.type, event.data, `seed-${i}`, false))
    .filter((row): row is FeedRow => row !== null)
    .slice(0, 14);

  // Biggest drop currently in the feed — powers the hero's "latest big one" pill.
  const topFeedDrop = feed
    .filter((e) => e.type === "drop")
    .map((e) => ({
      itemId: Number(e.data.item_id ?? 0),
      itemName: typeof e.data.item_name === "string" ? e.data.item_name : "an item",
      value: Number(e.data.value ?? 0),
    }))
    .filter((d) => d.itemId > 0 && d.value > 0)
    .sort((a, b) => b.value - a.value)[0];

  return (
    <>
      <TopBar />

      <main className="th-main">
        <Hero
          wallImages={DROP_SHOTS.map((s) => s.src)}
          monthlyGp={monthlyGp}
          rankedPlayers={players.meta.total}
          rankedClans={groups.meta.total}
          topDrop={topFeedDrop ?? null}
        />

        {/* --- 1. How it works ------------------------------------------- */}
        <section className="th-section" id="capture">
          <div className="th-shell">
            <Reveal className="th-split-head">
              <div className="th-section-head" style={{ marginBottom: 0 }}>
                <span className="th-eyebrow">How it works</span>
                <h2 className="th-display">You play. We do the paperwork.</h2>
                <p className="th-lede">
                  There is no form to fill in and no screenshot to paste. Install the plugin once
                  and every meaningful thing that happens in your account is captured, valued,
                  ranked and announced.
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
          </div>
        </section>

        {/* --- 2. Proof: clips + screenshots ------------------------------ */}
        <section className="th-section" id="proof">
          <div className="th-shell">
            <Reveal className="th-section-head">
              <span className="th-eyebrow">Receipts</span>
              <h2 className="th-display">Proof, not &ldquo;trust me bro&rdquo;.</h2>
              <p className="th-lede">
                The plugin keeps a rolling replay buffer. When something big drops we flush the
                seconds around it, convert it, and attach it to the submission — so the kill, the
                loot and the chat line are all on the record. Every clip and screenshot below is a
                real submission from a real account.
              </p>
            </Reveal>

            <Reveal>
              <DropReel />
            </Reveal>

            <Reveal className="th-section-head" delay={80}>
              <h2 className="th-display" style={{ fontSize: "clamp(1.5rem,1.1rem+1.6vw,2.2rem)" }}>
                And the screenshots the bot posts.
              </h2>
              <p className="th-lede">
                Click any of them. These are the exact images attached to the announcement in
                Discord — chat box, kill timer, party damage and all.
              </p>
            </Reveal>

            <Gallery />
          </div>
        </section>

        {/* --- 3. Boards + leaderboards ---------------------------------- */}
        <section className="th-section" id="boards">
          <div className="th-shell">
            <Reveal className="th-section-head">
              <span className="th-eyebrow">Your clan&apos;s front page</span>
              <h2 className="th-display">One board. Everyone&apos;s month.</h2>
              <p className="th-lede">
                Lootboards are rendered in the game&apos;s own interface font from your clan&apos;s
                real submissions — top looters, the month&apos;s best items, the most recent drops —
                and refreshed automatically. Global and per-clan leaderboards run off the same data,
                in Redis, in real time.
              </p>
            </Reveal>

            <BoardShowcase players={topPlayers} totalPlayers={players.meta.total} />
          </div>
        </section>

        {/* --- 4. Discord ------------------------------------------------- */}
        <section className="th-section" id="discord">
          <div className="th-shell">
            <Reveal className="th-section-head">
              <span className="th-eyebrow">Discord integration</span>
              <h2 className="th-display">Where your clan already lives.</h2>
              <p className="th-lede">
                Invite the bot, pick your channels, set a value threshold. From then on every
                qualifying submission is announced with the item, the source, its value, the
                player&apos;s monthly total and their rank — with the proof attached.
              </p>
            </Reveal>

            <DiscordDemo />
          </div>
        </section>

        {/* --- 5. Events -------------------------------------------------- */}
        <section className="th-section" id="events">
          <div className="th-shell">
            <Reveal className="th-section-head">
              <span className="th-eyebrow">Events</span>
              <h2 className="th-display">Run a bingo without running a spreadsheet.</h2>
              <p className="th-lede">
                Three event kinds, all scored by the same submission pipeline that powers everything
                else — so progress is credited the instant the drop happens, and there is nothing to
                verify by hand.
              </p>
            </Reveal>

            <Reveal>
              <EventsShowcase />
            </Reveal>
          </div>
        </section>

        {/* --- 6. Live ---------------------------------------------------- */}
        <section className="th-section" id="live">
          <div className="th-shell">
            <Reveal className="th-section-head">
              <span className="th-eyebrow">Right now</span>
              <h2 className="th-display">This is happening while you read.</h2>
              <p className="th-lede">
                The panel below is a live server-sent stream of submissions landing across every
                tracked account. It is the same feed that drives the ticker on the site and the
                in-game notifications in your client.
              </p>
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
                          <Link href={`/groups/${entry.id}` as Route}>{entry.name}</Link>
                        </span>
                        <span className="th-lb-val">{entry.loot.value_formatted}</span>
                      </div>
                    );
                  })}
                </div>
              </Reveal>
            </div>

            <Reveal delay={80}>
              <div style={{ marginTop: "clamp(1.5rem, 3vw, 2.5rem)" }}>
                <StatGrid
                  rankedPlayers={players.meta.total}
                  rankedClans={groups.meta.total}
                  monthlyGp={monthlyGp}
                />
              </div>
            </Reveal>
          </div>
        </section>

        {/* --- 7. Close --------------------------------------------------- */}
        <section className="th-section">
          <div className="th-shell">
            <Reveal>
              <div className="th-cta">
                <div className="th-cta-bg" aria-hidden>
                  {[...CONSTELLATION_ITEMS, ...CONSTELLATION_ITEMS].map((id, i) => (
                    <img key={`${id}-${i}`} src={itemIcon(id)} alt="" loading="lazy" />
                  ))}
                </div>
                <div>
                  <h2>Start tracking in about two minutes.</h2>
                  <p className="th-lede">
                    Install the plugin and your drops start recording immediately — no account
                    needed. Sign in with Discord to claim your accounts, then bring the clan for
                    lootboards, leaderboards, announcements and events.
                  </p>
                  <div className="th-cta-row">
                    <a
                      className="th-btn th-btn-primary"
                      href="https://runelite.net/plugin-hub/show/droptracker"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Install from the Plugin Hub
                    </a>
                    <Link className="th-btn th-btn-ghost" href="/docs/getting-started">
                      Read the setup guide
                    </Link>
                    <a className="th-btn th-btn-ghost" href="/discord">
                      Join the Discord
                    </a>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <footer className="th-foot">
          <div className="th-shell th-foot-row">
            <span>
              DropTracker — not affiliated with Jagex. Item and NPC art © Jagex Ltd. All
              submissions shown are real, published by their owners through the plugin.
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.75rem" }}>
              <span className="th-badge-admin">Prototype · superadmin only</span>
              <Link href="/">← Back to the live site</Link>
            </span>
          </div>
        </footer>
      </main>

      {/* Preload the two heaviest above-the-fold assets used by the hero wall
          and the Discord demo so the first paint isn't a stack of empty frames. */}
      <link rel="preload" as="image" href={DROP_SHOTS[0]!.src} />
      <link rel="preload" as="image" href={ARTWORK.lootboardLive} />
    </>
  );
}
