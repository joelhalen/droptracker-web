"use client";

/**
 * Hero for /test-hero.
 *
 * Backdrop: a wall of REAL drop screenshots (see showcase-data.ts) drifting in
 * four columns at different speeds, blurred and scrimmed until it reads as
 * texture. Foreground: the site's own `HeroSearch`, the two homepage CTAs, the
 * live "latest notable drop" line, and the notable-drops dial (./dial.tsx).
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HeroSearch } from "@/components/hero-search";
import { Dial, type DialGroup } from "./dial";
import { type NotableDrop } from "./feed-rows";
import { LatestDrop } from "./latest-drop";
import { useReducedMotion } from "./motion";
import { DROP_SHOTS, uniqueByItem } from "./showcase-data";

/* -------------------------------------------------------------------------- */
/* Media wall                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Build the wall columns.
 *
 * Each column gets the WHOLE image list, rotated by the column index so no two
 * columns line up, then that sequence duplicated exactly once. The duplication
 * is what makes the -50% marquee seamless: when the animation reaches its end
 * the second copy sits precisely where the first started, so the reset is
 * invisible. (Tripling the list — which this first did — puts the halfway point
 * in the middle of the second copy, which is what made it jump.)
 */
function wallColumns(images: string[], count: number): string[][] {
  if (images.length === 0) return [];
  return Array.from({ length: count }, (_, col) => {
    const offset = (col * Math.ceil(images.length / count)) % images.length;
    const rotated = [...images.slice(offset), ...images.slice(0, offset)];
    return [...rotated, ...rotated];
  });
}

function MediaWall({ images }: { images: string[] }) {
  const cols = wallColumns(images, 4);
  return (
    // The clip wrapper, not the hero, contains the oversized rotated wall —
    // the hero itself must stay overflow-visible so the search dropdown can
    // extend past its bottom edge.
    <div className="th-wall-clip" aria-hidden>
      <div className="th-wall">
        {cols.map((col, i) => (
          <div
            key={i}
            className="th-wall-col"
            // Duration scales with tile count so every column drifts at a similar
            // px/sec, with a per-column offset so they never sync into one sheet.
            style={{ animationDuration: `${col.length * 7 + i * 9}s` }}
          >
            {col.map((src, j) => (
              <img key={`${src}-${j}`} src={src} alt="" loading="lazy" decoding="async" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

export function Hero({
  monthlyLoot,
  playersTracked,
  rankedPlayers,
  rankedClans,
  latestDrop,
  topGroups,
}: {
  /** Total GP tracked this month across every account (live, from /groups/2). */
  monthlyLoot: number;
  /** Accounts tracked (live, from /groups/2). */
  playersTracked: number;
  rankedPlayers: number;
  rankedClans: number;
  /** Newest drop over the notable bar; the client keeps it current over SSE. */
  latestDrop: NotableDrop | null;
  /** Clans topping the monthly board — the dial's inner ring. */
  topGroups: DialGroup[];
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [pointerInside, setPointerInside] = useState(false);
  const reduced = useReducedMotion();

  // Warm spotlight tracking the pointer. Written straight to CSS custom
  // properties so React never re-renders on mousemove.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || reduced) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--th-mx", `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty("--th-my", `${((e.clientY - r.top) / r.height) * 100}%`);
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, [reduced]);

  return (
    <section
      ref={sectionRef}
      className="th-hero th-bleed"
      onPointerEnter={() => setPointerInside(true)}
      onPointerLeave={() => setPointerInside(false)}
    >
      <MediaWall images={DROP_SHOTS.map((s) => s.src)} />
      <div className="th-hero-scrim" aria-hidden />
      <div className="th-spotlight" style={{ opacity: pointerInside ? 1 : 0 }} aria-hidden />

      <div className="th-shell th-hero-inner">
        <div className="th-hero-copy">
          <span className="th-eyebrow">Old School RuneScape · loot &amp; achievements</span>

          <h1 className="th-display">
            <span>Every drop,</span>
            <span className="th-foil">on the record.</span>
          </h1>

          <p className="th-lede th-hero-lede">
            An all-in-one loot and achievement tracker for OSRS players and clans — real-time
            notifications, leaderboards, lootboards and events, all from one plugin.
          </p>

          {/* The site's own homepage search — same component, same behaviour. */}
          <div className="th-hero-search">
            <HeroSearch />
          </div>

          <div className="th-hero-cta">
            <Link className="th-btn th-btn-primary" href="/docs/getting-started">
              Get started
            </Link>
            <Link className="th-btn th-btn-ghost" href="/leaderboards">
              View leaderboards
            </Link>
          </div>

          <div className="th-hero-pills">
            <span className="th-pill">
              <i className="th-dot" /> Live now
            </span>
            <span className="th-pill">
              <b>{rankedPlayers.toLocaleString()}</b> players ranked this month
            </span>
            <span className="th-pill">
              <b>{rankedClans.toLocaleString()}</b> clans competing
            </span>
          </div>

          <LatestDrop seed={latestDrop} />
        </div>

        <Dial
          drops={uniqueByItem(DROP_SHOTS)}
          groups={topGroups}
          monthlyLoot={monthlyLoot}
          playersTracked={playersTracked}
        />
      </div>
    </section>
  );
}
