"use client";

/**
 * Hero + fixed top bar for /test-hero.
 *
 * The backdrop is a wall of REAL drop screenshots (see showcase-data.ts) —
 * three columns drifting at different speeds, rotated, blurred and scrimmed
 * until they read as texture. The foreground is the headline, a live medallion
 * counting up this month's tracked GP, and a constellation of the item icons
 * from our own item-DB mirror.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatGp } from "@/lib/format";
import { CountUp, useReducedMotion, useScrollSpy } from "./motion";
import { CONSTELLATION_ITEMS, SECTIONS, itemIcon } from "./showcase-data";

/* -------------------------------------------------------------------------- */
/* Top bar                                                                    */
/* -------------------------------------------------------------------------- */

export function TopBar() {
  const ids = SECTIONS.map((s) => s.id);
  const { progress, stuck, active } = useScrollSpy(ids);

  return (
    <header className="th-topbar" data-stuck={stuck}>
      <a href="#top" className="th-brand">
        <img src="/logo.png" alt="" width={26} height={26} />
        DropTracker
      </a>

      <nav className="th-topnav" aria-label="Page sections">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} data-active={active === s.id}>
            {s.label}
          </a>
        ))}
      </nav>

      <a
        className="th-btn th-btn-primary th-btn-sm"
        href="https://runelite.net/plugin-hub/show/droptracker"
        target="_blank"
        rel="noreferrer"
      >
        Get the plugin
      </a>

      <div
        className="th-progress"
        style={{ transform: `scaleX(${progress})` }}
        aria-hidden
      />
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Media wall                                                                 */
/* -------------------------------------------------------------------------- */

/** Split the screenshots into N columns, each duplicated so the loop is seamless. */
function columnsOf(images: string[], count: number): string[][] {
  const cols: string[][] = Array.from({ length: count }, () => []);
  images.forEach((src, i) => cols[i % count]!.push(src));
  // A column with too few tiles leaves a visible gap at the wrap point.
  return cols.map((col) => (col.length ? [...col, ...col, ...col] : col));
}

function MediaWall({ images }: { images: string[] }) {
  const cols = columnsOf(images, 4);
  return (
    <div className="th-wall" aria-hidden>
      {cols.map((col, i) => (
        <div
          key={i}
          className="th-wall-col"
          // Different durations per column so the columns never sync up into a
          // single sliding sheet.
          style={{ animationDuration: `${58 + i * 17}s` }}
        >
          {col.map((src, j) => (
            <img key={`${src}-${j}`} src={src} alt="" loading="lazy" decoding="async" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Item constellation                                                         */
/* -------------------------------------------------------------------------- */

/**
 * One item on a ring. The slot is a full-size box rotated to the item's angle,
 * so the orbit radius is always half the container — it stays correct at any
 * size without hard-coded pixel radii. The item then counter-rotates by the
 * same angle to sit upright, and its icon counter-rotates against the carrier's
 * spin (see `th-spin-back` in the stylesheet).
 */
function OrbitItem({ id, angle }: { id: number; angle: number }) {
  return (
    <div className="th-orbit-slot" style={{ "--th-a": `${angle}deg` } as CSSProperties}>
      <div className="th-orbit-item">
        <img src={itemIcon(id)} alt="" loading="lazy" />
      </div>
    </div>
  );
}

function Constellation({ monthlyGp }: { monthlyGp: number }) {
  const outer = CONSTELLATION_ITEMS.slice(0, 8);
  const inner = CONSTELLATION_ITEMS.slice(8);

  return (
    <div className="th-orbit" aria-hidden>
      <div className="th-orbit-ring" />
      <div className="th-orbit-ring" />

      <div className="th-orbit-carrier" data-ring="outer">
        {outer.map((id, i) => (
          <OrbitItem key={id} id={id} angle={(i / outer.length) * 360} />
        ))}
      </div>

      <div className="th-orbit-carrier" data-ring="inner">
        {inner.map((id, i) => (
          <OrbitItem key={id} id={id} angle={(i / inner.length) * 360 + 45} />
        ))}
      </div>

      <div className="th-orbit-core">
        <b>
          <CountUp to={monthlyGp} duration={2200} format={(n) => formatGp(n)} />
        </b>
        <small>Top 100 · this month</small>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                       */
/* -------------------------------------------------------------------------- */

export function Hero({
  wallImages,
  monthlyGp,
  rankedPlayers,
  rankedClans,
  topDrop,
}: {
  /** Real drop screenshots for the backdrop. */
  wallImages: string[];
  /** Summed loot of the top 100 ranked players this month, live from the API. */
  monthlyGp: number;
  rankedPlayers: number;
  rankedClans: number;
  /** Biggest item currently sitting in the live feed. */
  topDrop: { itemId: number; itemName: string; value: number } | null;
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
      id="top"
      ref={sectionRef}
      className="th-hero"
      onPointerEnter={() => setPointerInside(true)}
      onPointerLeave={() => setPointerInside(false)}
    >
      <MediaWall images={wallImages} />
      <div className="th-hero-scrim" aria-hidden />
      <div className="th-spotlight" style={{ opacity: pointerInside ? 1 : 0 }} aria-hidden />

      <div className="th-shell th-hero-inner">
        <div>
          <span className="th-eyebrow">Old School RuneScape · loot &amp; achievements</span>

          <h1 className="th-display">
            <span>Every drop,</span>
            <span className="th-foil">on the record.</span>
          </h1>

          <p className="th-lede th-hero-lede">
            DropTracker watches your client, values every item, and turns your clan&apos;s loot
            into leaderboards, lootboards, Discord announcements and events — automatically, the
            moment the drop lands.
          </p>

          <div className="th-hero-cta">
            <a
              className="th-btn th-btn-primary"
              href="https://runelite.net/plugin-hub/show/droptracker"
              target="_blank"
              rel="noreferrer"
            >
              Install the RuneLite plugin
            </a>
            <a className="th-btn th-btn-ghost" href="#proof">
              See real submissions ↓
            </a>
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
            {topDrop && (
              <span className="th-pill" title={`${topDrop.itemName} — ${formatGp(topDrop.value)} gp`}>
                <img src={itemIcon(topDrop.itemId)} alt="" />
                Latest big one: <b>{formatGp(topDrop.value)}</b>
              </span>
            )}
          </div>
        </div>

        <Constellation monthlyGp={monthlyGp} />
      </div>

      <div className="th-scroll-cue" aria-hidden>
        <i />
        Scroll
      </div>
    </section>
  );
}
