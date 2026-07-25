"use client";

/**
 * Showcase sections for /test-hero: the notable-drops gallery + lightbox, the
 * lootboard/leaderboard split, the Discord panel, the live bingo board, and the
 * supporters wall.
 *
 * Every image comes from ./showcase-data.ts (real submissions and real
 * generated DropTracker artwork) or straight from the API. Nothing is
 * placeholder art, and there is no video anywhere — replay-buffer capture is
 * out of the plugin pending core RuneLite client changes.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  BingoBoard,
  EventTask,
  LeaderboardEntry,
  Supporters,
} from "@droptracker/api-types";
import { formatGp } from "@/lib/format";
import { entityPath } from "@/lib/slug";
import { BingoTile } from "@/components/bingo-tile";
import { Reveal, useInView } from "./motion";
import { ARTWORK, DROP_SHOTS, itemIcon, npcIcon, type ShowcaseDrop } from "./showcase-data";

/** Rarity bucket for the value colour — same thresholds as `lootValueClass`. */
function valueTier(value: number): "1m" | "10m" | "100m" | "b" {
  if (value >= 1_000_000_000) return "b";
  if (value >= 100_000_000) return "100m";
  if (value >= 10_000_000) return "10m";
  return "1m";
}

/* -------------------------------------------------------------------------- */
/* Notable-drops gallery + lightbox                                           */
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
              <span className="th-shot-text">
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

  // Cross-fade through the real clan boards, but only while the section is on
  // screen — no background timer churn for content nobody is looking at.
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
          <Link className="th-lb-more" href="/leaderboards">
            Full leaderboards →
          </Link>
        </div>
      </Reveal>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Discord                                                                    */
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
    mark: "◎",
    title: "Boards that edit themselves",
    body: "Lootboards and live event standings are posted once and edited in place, so your channel history stays readable.",
  },
];

/** One synthetic Discord message built from a real submission. */
function ChatMessage({ drop }: { drop: ShowcaseDrop }) {
  return (
    <div className="th-msg">
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
  return (
    <div className="th-discord">
      <Reveal>
        <div className="th-chat">
          <div className="th-chat-head">
            <span style={{ color: "var(--th-ink-faint)" }}>#</span>
            <b>loot-drops</b>
          </div>
          <div className="th-chat-body">
            <ChatMessage drop={DROP_SHOTS[0]!} />
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

        {/* The panel to the left is a faithful re-creation; this is a straight
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
/* Events — a real, live bingo board                                          */
/* -------------------------------------------------------------------------- */

const EVENT_POINTS = [
  "Tiles accept any item, a full set, a KC target, an XP goal, a total-loot target or a points threshold",
  "Submissions match tiles automatically — nobody screenshots anything into a spreadsheet",
  "Teams, sign-up windows, buy-ins and a prize pot are built in",
  "Live standings posted to Discord and edited in place every two minutes",
];

/**
 * Read-only preview of a REAL public bingo board.
 *
 * Boards are composed in React from the backend's `task.tile` icon data, so
 * this renders the project's own `BingoTile` against a live event rather than
 * shipping a stale server-rendered PNG. Tiles reveal in a diagonal sweep the
 * first time the board scrolls into view.
 */
export function EventsShowcase({
  board,
  tasks,
  eventId,
  eventName,
}: {
  board: BingoBoard;
  tasks: EventTask[];
  eventId: number;
  eventName: string;
}) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.15 });
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  return (
    <div className="th-event-panel">
      <div className="th-frame">
        <div className="th-frame-bar">
          <i />
          <i />
          <i />
          Live board
          <span>{eventName}</span>
        </div>
        <div
          className="th-bingo"
          ref={ref}
          data-shown={inView}
          style={{ ["--th-cols" as string]: board.size }}
        >
          {board.cells.map((cell) => {
            const task = cell.task_id != null ? taskById.get(cell.task_id) : undefined;
            const done = cell.completed_by.length > 0;
            return (
              <div
                key={cell.index}
                className="th-bingo-cell"
                data-done={done}
                // Diagonal sweep: cells further from the top-left arrive later.
                style={{
                  transitionDelay: `${(Math.floor(cell.index / board.size) + (cell.index % board.size)) * 60}ms`,
                }}
                title={cell.label}
              >
                <BingoTile label={cell.label} task={task} />
                {done && (
                  <span className="th-bingo-done" aria-hidden>
                    ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3>Run a bingo without running a spreadsheet</h3>
        <p className="th-lede">
          That board is live — it is <strong>{eventName}</strong>, rendered from the same tile data
          the event page and the Discord board use. Bingo, board-game races and loot sweeps are all
          scored by the submission pipeline that powers everything else.
        </p>
        <ul className="th-checks">
          {EVENT_POINTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <Link className="th-btn th-btn-ghost th-btn-sm" href={`/events/${eventId}`}>
          Open this event →
        </Link>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Supporters                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The supporters wall, reworked for this page's motion language: clans and
 * players with a live paid subscription, revealed in a stagger. Same data as
 * the current homepage's `SupportersSection` (`api.supporters()`), presented in
 * the panel/tile style the rest of this page uses.
 */
export function SupportersWall({ supporters }: { supporters: Supporters }) {
  const { groups, players } = supporters;
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.1 });
  if (groups.length === 0 && players.length === 0) return null;

  return (
    <div className="th-supporters" ref={ref} data-shown={inView}>
      {groups.length > 0 && (
        <div>
          <h3 className="th-sup-heading">Supporter clans</h3>
          <div className="th-sup-grid">
            {groups.map((g, i) => (
              <Link
                key={g.id}
                href={entityPath("groups", g.id, g.name)}
                className="th-sup-card"
                style={{ transitionDelay: `${i * 45}ms` }}
              >
                <span className="th-sup-mark" aria-hidden>
                  {g.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="th-sup-body">
                  <b>{g.name}</b>
                  <span>
                    {g.tier_name} · {g.member_count.toLocaleString()}{" "}
                    {g.member_count === 1 ? "member" : "members"}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {players.length > 0 && (
        <div>
          <h3 className="th-sup-heading">Individual supporters</h3>
          <div className="th-sup-grid" data-dense="true">
            {players.map((p, i) => (
              <Link
                key={p.user_id}
                href={entityPath("players", p.player_id, p.name)}
                className="th-sup-card"
                data-compact="true"
                style={{ transitionDelay: `${i * 35}ms` }}
              >
                <span className="th-sup-star" aria-hidden>
                  ★
                </span>
                <span className="th-sup-body">
                  <b>{p.name}</b>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
