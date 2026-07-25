"use client";

/**
 * The showcase sections for /test-hero: the replay-clip reel, the screenshot
 * gallery + lightbox, the lootboard/leaderboard split, the Discord demo, and
 * the events tabs.
 *
 * Every image and clip rendered here comes from ./showcase-data.ts — real
 * submissions and real generated DropTracker artwork. Nothing is placeholder.
 */
import { useCallback, useEffect, useState } from "react";
import type { LeaderboardEntry } from "@droptracker/api-types";
import { formatGp } from "@/lib/format";
import { entityPath } from "@/lib/slug";
import Link from "next/link";
import { Reveal, useInView, useVideoInView } from "./motion";
import {
  ARTWORK,
  DROP_CLIPS,
  DROP_SHOTS,
  LOOT_SWEEP_ROWS,
  itemIcon,
  npcIcon,
  type ShowcaseDrop,
} from "./showcase-data";

/** Rarity bucket for the value colour — same thresholds as `lootValueClass`. */
function valueTier(value: number): "1m" | "10m" | "100m" | "b" {
  if (value >= 1_000_000_000) return "b";
  if (value >= 100_000_000) return "100m";
  if (value >= 10_000_000) return "10m";
  return "1m";
}

/* -------------------------------------------------------------------------- */
/* Replay-clip reel                                                           */
/* -------------------------------------------------------------------------- */

function Clip({ drop, feature }: { drop: ShowcaseDrop; feature: boolean }) {
  const videoRef = useVideoInView();

  return (
    <figure className="th-clip" data-feature={feature}>
      <video
        ref={videoRef}
        src={drop.src}
        width={drop.width}
        height={drop.height}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={`${drop.playerName} receiving ${drop.itemName} from ${drop.npcName}`}
      />
      <span className="th-clip-tag">
        <i /> Replay buffer
      </span>
      <figcaption className="th-clip-meta">
        <span className="th-clip-icon">
          <img src={itemIcon(drop.itemId)} alt="" loading="lazy" />
        </span>
        <span className="th-clip-text">
          <b>{drop.itemName}</b>
          <span>
            {drop.playerName} · {drop.npcName}
          </span>
        </span>
        <span className="th-value" data-tier={valueTier(drop.value)}>
          {formatGp(drop.value)}
        </span>
      </figcaption>
    </figure>
  );
}

export function DropReel() {
  return (
    <div className="th-reel">
      {DROP_CLIPS.map((drop, i) => (
        <Clip key={drop.dropId} drop={drop} feature={i === 0} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Screenshot gallery + lightbox                                              */
/* -------------------------------------------------------------------------- */

export function Gallery() {
  const [open, setOpen] = useState<number | null>(null);
  const shots = DROP_SHOTS;

  const step = useCallback(
    (delta: number) =>
      setOpen((current) =>
        current === null ? null : (current + delta + shots.length) % shots.length,
      ),
    [shots.length],
  );

  // Keyboard: Escape closes, arrows page through. Also locks background scroll
  // so the page behind doesn't drift while the lightbox is up.
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, step]);

  const active = open === null ? null : shots[open]!;

  return (
    <>
      <div className="th-gallery">
        {shots.map((shot, i) => (
          <button
            key={shot.dropId}
            type="button"
            className="th-shot"
            onClick={() => setOpen(i)}
            aria-label={`Open ${shot.itemName} from ${shot.npcName} — ${formatGp(shot.value)} gp`}
          >
            <img
              src={shot.src}
              alt=""
              width={shot.width}
              height={shot.height}
              loading="lazy"
              decoding="async"
            />
            <span className="th-shot-meta">
              <img src={itemIcon(shot.itemId)} alt="" loading="lazy" />
              <span className="th-clip-text">
                <b>{shot.itemName}</b>
                <span>
                  {shot.playerName} · {shot.npcName}
                </span>
              </span>
              <span className="th-value" data-tier={valueTier(shot.value)}>
                {formatGp(shot.value)}
              </span>
            </span>
          </button>
        ))}
      </div>

      {active && (
        <div
          className="th-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${active.itemName} from ${active.npcName}`}
          onClick={() => setOpen(null)}
        >
          <img
            src={active.src}
            alt={`${active.playerName}'s ${active.itemName} from ${active.npcName}`}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="th-lightbox-bar">
            <img src={itemIcon(active.itemId)} alt="" width={26} height={26} />
            <span>
              <b>{active.itemName}</b> · {active.npcName}
            </span>
            <span>
              submitted by <b>{active.playerName}</b>
            </span>
            <span className="th-value" data-tier={valueTier(active.value)}>
              {formatGp(active.value)} gp
            </span>
            <span style={{ opacity: 0.55 }}>← → to browse · Esc to close</span>
          </div>
          <button
            type="button"
            className="th-close"
            onClick={() => setOpen(null)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Lootboards + leaderboard                                                   */
/* -------------------------------------------------------------------------- */

const BOARDS = [
  { src: ARTWORK.lootboardLive, label: "Pegasus PvM — live monthly board" },
  { src: ARTWORK.lootboardAlt, label: "Realists — live monthly board" },
  { src: ARTWORK.lootboardClassic, label: "Realists — September archive" },
] as const;

export function BoardShowcase({
  players,
  totalPlayers,
}: {
  players: LeaderboardEntry[];
  totalPlayers: number;
}) {
  const [index, setIndex] = useState(0);
  const [ref, inView] = useInView<HTMLDivElement>({ once: false, threshold: 0.2 });

  // Cross-fade through the real clan boards, but only while the section is
  // actually on screen — no background timer churn for content nobody sees.
  useEffect(() => {
    if (!inView) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % BOARDS.length), 6000);
    return () => clearInterval(timer);
  }, [inView]);

  const max = players[0]?.loot.value ?? 1;

  return (
    <div className="th-board-layout" ref={ref}>
      <Reveal>
        <div className="th-frame">
          <div className="th-frame-bar">
            <i />
            <i />
            <i />
            Lootboard
            <span>{BOARDS[index]!.label}</span>
          </div>
          <div className="th-board-stack">
            {BOARDS.map((board, i) => (
              <img
                key={board.src}
                src={board.src}
                alt={board.label}
                data-active={i === index}
                loading="lazy"
                decoding="async"
              />
            ))}
          </div>
        </div>
        <p className="th-lede" style={{ marginTop: "1rem", fontSize: "0.82rem" }}>
          Regenerated every two minutes for every clan, posted straight into Discord and edited in
          place — no spam, no manual updates.
        </p>
      </Reveal>

      <Reveal delay={120}>
        <div className="th-lb">
          <div className="th-lb-head">
            <span>Global top players</span>
            <span>{totalPlayers.toLocaleString()} ranked</span>
          </div>
          {players.map((entry, i) => (
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
                <Link href={entityPath("players", entry.id, entry.name)}>{entry.name}</Link>
              </span>
              <span className="th-lb-val">{entry.loot.value_formatted}</span>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Discord demo                                                               */
/* -------------------------------------------------------------------------- */

const CHAT_FEATURES = [
  {
    mark: "#",
    title: "A channel per submission type",
    body: "Route drops, personal bests, collection log slots, combat achievements, pets, levels, quests, deaths and diaries wherever you want them — or all to one channel.",
  },
  {
    mark: "◈",
    title: "Your own value threshold",
    body: "Announce everything, or only the drops worth shouting about. Optionally require a screenshot before anything is posted.",
  },
  {
    mark: "⌁",
    title: "Embeds you control",
    body: "Every field is editable per clan: monthly totals, global and clan rank, item value, the proof image, your own footer.",
  },
  {
    mark: "◎",
    title: "Boards that edit themselves",
    body: "Lootboards and live event standings are posted once and edited in place, so your channel history stays readable.",
  },
];

/** One synthetic Discord message built from a real submission. */
function ChatMessage({ drop, delay }: { drop: ShowcaseDrop; delay: number }) {
  return (
    <div className="th-msg" style={{ animationDelay: `${delay}ms` }}>
      <span className="th-avatar">
        <img src={npcIcon(drop.npcId)} alt="" loading="lazy" />
      </span>
      <div className="th-msg-body">
        <b>DropTracker</b>
        <time>today</time>
        <div className="th-embed">
          <strong>{drop.itemName}</strong>
          <dl>
            <div>
              <dt>Player</dt>
              <dd>{drop.playerName}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{drop.npcName}</dd>
            </div>
            <div>
              <dt>G/E value</dt>
              <dd>{formatGp(drop.value)}</dd>
            </div>
            <div>
              <dt>Proof</dt>
              <dd>attached</dd>
            </div>
          </dl>
          <figure>
            <img src={drop.src} alt="" loading="lazy" decoding="async" />
          </figure>
          <footer>Powered by the DropTracker | https://www.droptracker.io</footer>
        </div>
      </div>
    </div>
  );
}

export function DiscordDemo() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.25 });
  // Replaying on every entry would be noisy; the messages animate in once, in
  // sequence, the first time the channel scrolls into view. Two different
  // bosses so the channel doesn't read as the same drop twice.
  const shots = [DROP_SHOTS[0]!, DROP_SHOTS[4]!];

  return (
    <div className="th-discord" ref={ref}>
      <Reveal>
        <div className="th-chat">
          <div className="th-chat-head">
            <span style={{ color: "var(--th-ink-faint)" }}>#</span>
            <b>loot-drops</b>
            <em>{inView ? "live" : "idle"}</em>
          </div>
          <div className="th-chat-body">
            {inView &&
              shots.map((drop, i) => (
                <ChatMessage key={drop.dropId} drop={drop} delay={i * 550} />
              ))}
          </div>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <div className="th-features">
          {CHAT_FEATURES.map((f) => (
            <div key={f.title} className="th-feature">
              <span className="th-feature-mark" aria-hidden>
                {f.mark}
              </span>
              <div>
                <b>{f.title}</b>
                <p>{f.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* The panel above is a faithful re-creation; this is a straight
            screenshot of a real announcement, so the claim is checkable. */}
        <figure className="th-frame th-real-embed">
          <div className="th-frame-bar">
            <i />
            <i />
            <i />
            Discord
            <span>an actual announcement</span>
          </div>
          <img
            src={ARTWORK.discordEmbed}
            alt="A real DropTracker Discord announcement for a Bandos chestplate, showing G/E value, monthly totals and global and group rank"
            loading="lazy"
          />
        </figure>
      </Reveal>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Loot-sweep matrix, built in the DOM from our own NPC and item sprites.
 *
 * The other two event kinds have real rendered PNGs to show; loot sweep has no
 * static board asset, so rather than dress up an unrelated image this draws the
 * actual shape of the board — a boss per row, its uniques across — from real
 * `/img/npcdb` and `/img/itemdb` art. Claim state is illustrative, and the
 * caption under it says exactly that.
 */
function LootSweepMatrix() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.2 });

  // Deterministic claim pattern (no Math.random — it would differ between the
  // server render and hydration). Three teams, some cells still open.
  const teamFor = (row: number, col: number): number | null => {
    const n = (row * 7 + col * 3) % 5;
    return n < 3 ? n + 1 : null;
  };

  return (
    <div className="th-sweep" ref={ref} data-shown={inView}>
      {LOOT_SWEEP_ROWS.map((row, r) => (
        <div className="th-sweep-row" key={row.npcId}>
          <div className="th-sweep-boss">
            <img src={npcIcon(row.npcId)} alt="" loading="lazy" />
            <span>{row.npcName}</span>
          </div>
          <div className="th-sweep-cells">
            {row.items.map((itemId, c) => {
              const team = teamFor(r, c);
              return (
                <span
                  key={itemId}
                  className="th-sweep-cell"
                  data-team={team ?? "open"}
                  style={{ transitionDelay: `${(r * 4 + c) * 45}ms` }}
                >
                  <img src={itemIcon(itemId)} alt="" loading="lazy" />
                </span>
              );
            })}
          </div>
        </div>
      ))}

      <div className="th-sweep-key">
        <span data-team="1" /> Team 1
        <span data-team="2" /> Team 2
        <span data-team="3" /> Team 3
        <span data-team="open" /> unclaimed
      </div>
    </div>
  );
}

const EVENT_KINDS = [
  {
    key: "bingo",
    tab: "Bingo",
    title: "Bingo boards that fill themselves in",
    image: ARTWORK.bingoBoard,
    alt: "A rendered DropTracker bingo board of in-game item tiles",
    caption: "Rendered board — DropTracker global bingo",
    body: "Build a board from the shared task library or write your own tiles: any item, a full set, a KC target, an XP goal, a total-loot target, or a points threshold. Submissions match tiles automatically — nobody screenshots anything into a spreadsheet.",
    points: [
      "Tiles accept OR-branches: KC, GP or points can each complete the same square",
      "Per-NPC progress state, so a multi-boss tile tracks each source separately",
      "Teams, sign-up windows, buy-ins and a prize pot are built in",
      "Live standings posted to Discord and edited in place every two minutes",
    ],
  },
  {
    key: "board_game",
    tab: "Board game",
    title: "A 100-tile race around the board",
    image: ARTWORK.boardGame,
    alt: "The DropTracker board-game event map — a 100-tile track teams roll around",
    caption: "Rendered map — 100-tile board",
    body: "Teams complete tasks to earn rolls, land on effects, buy items from a rotating shop and race for the win tile. The whole map is rendered server-side and refreshed as teams move.",
    points: [
      "Roll-earning tasks drawn from the same task library as bingo",
      "Team inventories, cooldowns and coin ledger tracked per event",
      "Shop rotations configurable per event or globally",
      "Every move is written to the event audit log",
    ],
  },
  {
    key: "loot_sweep",
    tab: "Loot sweep",
    title: "Sweep the content, claim the cell",
    image: null,
    alt: "",
    caption: "Board structure — illustrative claim state",
    body: "A matrix of bosses and item groups where each cell is claimed by the first team to hit it, with decay so late claims are worth less. Scoring runs off the same drop pipeline as everything else.",
    points: [
      "Nested item groups scoped to the canonical drop source, not the boss label",
      "Value-weighted points, so a rare is worth what it is actually worth",
      "Per-team receipts showing exactly which submission scored",
      "Ends hard on the clock — no scoring or notifications after the end time",
    ],
  },
] as const;

export function EventsShowcase() {
  const [active, setActive] = useState(0);
  const kind = EVENT_KINDS[active]!;

  return (
    <div>
      <div className="th-tabs" role="tablist" aria-label="Event kinds">
        {EVENT_KINDS.map((k, i) => (
          <button
            key={k.key}
            type="button"
            role="tab"
            className="th-tab"
            data-active={i === active}
            aria-selected={i === active}
            onClick={() => setActive(i)}
          >
            {k.tab}
          </button>
        ))}
      </div>

      {/* Keyed on the tab so the panel re-runs its entrance animation. */}
      <div className="th-event-panel" key={kind.key} role="tabpanel">
        <div className="th-frame">
          <div className="th-frame-bar">
            <i />
            <i />
            <i />
            Event board
            <span>{kind.caption}</span>
          </div>
          {kind.image ? (
            <img src={kind.image} alt={kind.alt} loading="lazy" decoding="async" />
          ) : (
            <LootSweepMatrix />
          )}
        </div>

        <div>
          <h3>{kind.title}</h3>
          <p className="th-lede">{kind.body}</p>
          <ul className="th-checks">
            {kind.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
