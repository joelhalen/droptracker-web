"use client";

/**
 * Small client hooks shared by the /test-hero islands.
 *
 * Exports are hooks and components' plumbing only — anything the SERVER page
 * also needs lives in ./home-data.ts, because every export of a "use client"
 * module is a client-reference proxy on the server.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** True when the visitor asked for reduced motion (re-evaluated on change). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Current unix time in seconds, re-rendering every `intervalMs`.
 *
 * Starts from `initial` — the timestamp the SERVER rendered with — so the first
 * client render produces the same relative ages as the HTML it hydrates, then
 * moves to the real clock once mounted.
 */
export function useNow(initial: number, intervalMs = 15_000): number {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const tick = () => setNow(Math.floor(Date.now() / 1000));
    tick();
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * Re-run the server component on an interval while the tab is visible.
 *
 * SSE keeps the fast-moving numbers current; this is the slow re-anchor that
 * corrects whatever a stream cannot — clan totals (the `global` scope carries
 * player deltas only), players entering a top-N from below it, and anything
 * missed while a laptop slept. `router.refresh()` keeps client state, so the
 * islands fold the new props in rather than resetting.
 */
export function useServerResync(intervalMs: number): void {
  const router = useRouter();
  const lastRun = useRef(Date.now());

  useEffect(() => {
    const run = () => {
      if (document.hidden) return;
      if (Date.now() - lastRun.current < intervalMs) return;
      lastRun.current = Date.now();
      router.refresh();
    };
    const timer = setInterval(run, Math.min(intervalMs, 30_000));
    // Coming back to a tab that sat hidden past the interval: catch up at once.
    document.addEventListener("visibilitychange", run);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
    };
  }, [intervalMs, router]);
}
