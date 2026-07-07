"use client";

/**
 * Animated count-up for hero stat values (group/player profile pages).
 *
 * Animates a compact GP-style number (mirrors the backend `format_number`:
 * 1.234B / 12.34M / 123.45K) from 0 to `value`, then swaps to the exact
 * server-provided `formatted` string so the resting state always matches the
 * contract payload. Skips the animation entirely for reduced-motion users.
 */

import { useEffect, useRef, useState } from "react";

function compactFormat(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(3)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return Math.round(n).toLocaleString();
}

const DURATION_MS = 900;

export function CountUp({
  value,
  formatted,
  className,
}: {
  value: number;
  formatted?: string;
  className?: string;
}) {
  const final = formatted ?? compactFormat(value);
  const [text, setText] = useState<string>(value > 0 ? "0" : final);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (value <= 0) {
      setText(final);
      return;
    }
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(final);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      if (t >= 1) {
        setText(final);
        return;
      }
      setText(compactFormat(value * eased));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
    // `final` is derived from value/formatted, so these deps cover it.
  }, [value, formatted, final]);

  return (
    <span className={className} aria-label={final}>
      {text}
    </span>
  );
}
