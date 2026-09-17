"use client";

/**
 * Hero islands for /test-hero: the loot rain, the live odometer it falls into,
 * and the stream indicator.
 *
 * All three listen to the `global` realtime scope, which carries one
 * `leaderboard_delta` per credited drop across the whole platform — around
 * seven a second. `useEventStream` shares a single EventSource per channel set,
 * so three subscribers here still cost one connection. None of them re-render
 * per frame: handlers write to refs (or straight to the canvas engine) and a
 * slow interval moves React state.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatGp } from "@/lib/format";
import { useEventStream } from "@/lib/use-event-stream";
import { formatCount, odometerCells, toNotableDrop, type NotableDrop } from "./home-data";
import { useReducedMotion } from "./live-hooks";
import { createRainEngine, type RainEngine } from "./rain-engine";

/** Positive GP delta out of a `leaderboard_delta` frame, else 0. */
function frameDelta(type: string, data: Record<string, unknown>): number {
  if (type !== "leaderboard_delta") return 0;
  const delta = Number(data.delta ?? 0);
  return Number.isFinite(delta) && delta > 0 ? delta : 0;
}

/* -------------------------------------------------------------------------- */
/* Rain                                                                       */
/* -------------------------------------------------------------------------- */

export function HeroRain({ reel }: { reel: NotableDrop[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RainEngine | null>(null);
  const reelRef = useRef(reel);
  const reduced = useReducedMotion();

  useEventStream(["global"], (event) => {
    const delta = frameDelta(event.type, event.data);
    if (delta > 0) engineRef.current?.spawn(delta);
  });

  useEventStream(["feed"], (event) => {
    const drop = toNotableDrop(event.type, event.data, event.ts);
    if (drop) engineRef.current?.feature(drop, true);
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    // Reduced motion: no engine at all. The odometer below still counts, it
    // just does so without anything falling.
    if (!canvas || reduced) return;
    const engine = createRainEngine(canvas, reelRef.current);
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [reduced]);

  // The server re-sync hands down a fresher reel; fold it in without tearing
  // the engine (and everything mid-fall) down.
  useEffect(() => {
    reelRef.current = reel;
    engineRef.current?.setReel(reel);
  }, [reel]);

  return <canvas ref={canvasRef} className="hp-rain" aria-hidden />;
}

/* -------------------------------------------------------------------------- */
/* Stream indicator                                                           */
/* -------------------------------------------------------------------------- */

/** Seconds of history behind the drops-per-second reading. */
const RATE_WINDOW = 10;

export function LivePill() {
  const count = useRef(0);
  const buckets = useRef<number[]>([]);
  const [rate, setRate] = useState<number | null>(null);

  const { state } = useEventStream(["global"], (event) => {
    if (event.type === "leaderboard_delta") count.current += 1;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      buckets.current = [...buckets.current, count.current].slice(-RATE_WINDOW);
      count.current = 0;
      // Three seconds in is the earliest the average means anything.
      if (buckets.current.length >= 3) {
        const total = buckets.current.reduce((a, b) => a + b, 0);
        setRate(total / buckets.current.length);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const live = state === "open";
  return (
    <span className="hp-live" data-state={state}>
      <i className="hp-live-dot" aria-hidden />
      <b>{live ? "Live" : state === "connecting" ? "Connecting" : "Offline"}</b>
      {live && rate !== null && (
        <span>
          {rate.toFixed(1)} drops <em>/ sec</em>
        </span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Odometer                                                                   */
/* -------------------------------------------------------------------------- */

/** How often the streamed total is committed to the display. */
const ODOMETER_TICK_MS = 900;

export function Odometer({
  seed,
  month,
  accounts,
}: {
  /** GP tracked this month at render time; null when the backend could not say. */
  seed: number | null;
  /** "September" — the tracking month the seed belongs to. */
  month: string;
  accounts: number | null;
}) {
  const base = useRef(seed ?? 0);
  const streamed = useRef(0);
  const session = useRef(0);
  const [shown, setShown] = useState(seed ?? 0);
  const [sinceArrival, setSinceArrival] = useState(0);

  useEventStream(["global"], (event) => {
    const delta = frameDelta(event.type, event.data);
    streamed.current += delta;
    session.current += delta;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setShown(base.current + streamed.current);
      setSinceArrival(session.current);
    }, ODOMETER_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // A re-synced seed only ever moves the counter UP. The server figure is up
  // to a minute stale, so it is normally a little behind seed + stream; taking
  // it then would run the odometer backwards. When it is AHEAD — the stream
  // dropped frames while a laptop slept — it is the better number.
  useEffect(() => {
    if (seed === null) return;
    if (seed > base.current + streamed.current) {
      base.current = seed;
      streamed.current = 0;
    }
  }, [seed]);

  const sessionOnly = seed === null;
  const value = sessionOnly ? sinceArrival : shown;
  const cells = odometerCells(value);
  const digitCount = cells.filter((c) => c.kind === "digit").length;

  // What each tile showed BEFORE this render, so a changed digit can roll out
  // while its replacement rolls in. The ref moves on only after the commit, so
  // during the render in which `value` changes it still holds the old number.
  const lastValue = useRef(value);
  const leaving = new Map(odometerCells(lastValue.current).map((c) => [c.key, c.char]));
  useEffect(() => {
    lastValue.current = value;
  }, [value]);

  return (
    <div className="hp-odo-block">
      <div
        className="hp-odo"
        role="img"
        // The stylesheet sizes the digits from how many there are, so the row
        // fits a phone whether the month total has 9 digits or 13.
        style={{ "--hp-odo-n": digitCount } as CSSProperties}
        aria-label={
          sessionOnly
            ? "Live count of gp tracked since you opened this page"
            : `${formatCount(seed)} gp of loot tracked in ${month}, counting live`
        }
      >
        <span className="hp-odo-cells" aria-hidden>
          {cells.map((cell) =>
            cell.kind === "sep" ? (
              <span key={cell.key} className="hp-odo-sep">
                ,
              </span>
            ) : (
              <span key={cell.key} className="hp-odo-cell">
                {/* Keyed by character: a changed digit remounts and plays the
                    roll-in, an unchanged one is left alone. The digit it
                    replaced rolls out over the top of it, so a tile is never
                    blank between two values. */}
                {leaving.has(cell.key) && leaving.get(cell.key) !== cell.char && (
                  <span
                    key={`${leaving.get(cell.key)}>${cell.char}`}
                    className="hp-odo-digit hp-odo-digit-out"
                  >
                    {leaving.get(cell.key)}
                  </span>
                )}
                <span key={cell.char} className="hp-odo-digit">
                  {cell.char}
                </span>
              </span>
            ),
          )}
        </span>
        <span className="hp-odo-unit" aria-hidden>
          gp
        </span>
      </div>

      <p className="hp-odo-caption">
        {sessionOnly ? (
          <>of loot tracked since you opened this page</>
        ) : (
          <>
            of loot tracked in <b>{month}</b>
            {accounts !== null && (
              <>
                {" "}
                across <b>{formatCount(accounts)}</b> accounts
              </>
            )}
            {sinceArrival > 0 && (
              <span className="hp-odo-since">
                <b>+{formatGp(sinceArrival)}</b> since you arrived
              </span>
            )}
          </>
        )}
      </p>
    </div>
  );
}

/** Placeholder with the odometer's exact footprint while its seed streams in. */
export function OdometerSkeleton() {
  return (
    <div className="hp-odo-block" aria-hidden>
      <div className="hp-odo" data-pending="true">
        <span className="hp-odo-cells">
          {odometerCells(100_000_000_000).map((cell) =>
            cell.kind === "sep" ? (
              <span key={cell.key} className="hp-odo-sep">
                ,
              </span>
            ) : (
              <span key={cell.key} className="hp-odo-cell" />
            ),
          )}
        </span>
        <span className="hp-odo-unit">gp</span>
      </div>
      <p className="hp-odo-caption">&nbsp;</p>
    </div>
  );
}
