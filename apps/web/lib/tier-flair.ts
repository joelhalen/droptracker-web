/**
 * Client render mapping for tier flair. The shared registry
 * (`@droptracker/api-types` → `tier-flair.ts`) owns the *vocabulary* of styles;
 * this owns how each style *looks* (colors, glow, shimmer) so the primitives in
 * `components/ui.tsx` and the admin preview stay in sync.
 *
 * Colors are fixed (theme-independent) on purpose — same rationale as the
 * `RankMedal` medals in `ui.tsx`: prestige metals/gems should read identically
 * across the dusk/parchment/wilderness themes.
 */
import type { CSSProperties } from "react";
import { TIER_FLAIR_STYLES, type TierFlairStyle } from "@droptracker/api-types";

type FlairPaint = {
  /** Name text color (ignored for shimmer styles, which use a gradient). */
  color: string;
  /** Glow color for the tile box-shadow and name text-shadow. */
  glow: string;
  /** Tile border color. */
  border: string;
  /** Small glyph rendered before the name. */
  marker: string;
  /** Uses the animated gradient sweep (top tier). */
  shimmer?: boolean;
};

const PAINT: Record<Exclude<TierFlairStyle, "none">, FlairPaint> = {
  bronze: { color: "#d99a5b", glow: "rgba(205,127,50,.35)", border: "rgba(205,127,50,.6)", marker: "★" },
  gold: { color: "#ffd966", glow: "rgba(255,209,92,.42)", border: "rgba(255,209,92,.7)", marker: "★" },
  amethyst: { color: "#d3a7f2", glow: "rgba(181,126,220,.45)", border: "rgba(181,126,220,.7)", marker: "✦" },
  dragon: { color: "#ff8a5c", glow: "rgba(255,90,60,.55)", border: "rgba(255,120,80,.8)", marker: "🔥", shimmer: true },
};

const LABELS = Object.fromEntries(TIER_FLAIR_STYLES.map((s) => [s.id, s.label])) as Record<
  TierFlairStyle,
  string
>;

export type ResolvedFlair = {
  /** Class applied to the name span (the shimmer utility, or ""). */
  nameClassName: string;
  /** Inline style for the name span (solid color + glow, or gradient vars). */
  nameStyle: CSSProperties;
  /** Inline style for the identicon tile (glow + colored border). */
  tileStyle: CSSProperties;
  /** Glyph shown before the flaired name. */
  marker: string;
  /** Inline style for the marker glyph (its own color — the name may be a
   * clipped gradient, so the marker can't just inherit). */
  markerStyle: CSSProperties;
  /** Human label for the style ("Gold"). */
  label: string;
};

/**
 * Resolve a flair style to concrete styles, or `null` for "none"/absent (the
 * caller then renders exactly as an unsubscribed group).
 */
export function resolveFlair(style: TierFlairStyle | null | undefined): ResolvedFlair | null {
  if (!style || style === "none") return null;
  const p = PAINT[style];
  if (!p) return null;
  const tileStyle: CSSProperties = {
    border: `1px solid ${p.border}`,
    boxShadow: `0 0 14px 1px ${p.glow}`,
  };
  if (p.shimmer) {
    return {
      nameClassName: "flair-shimmer",
      // The shimmer gradient/animation lives in globals.css; nothing inline.
      nameStyle: {},
      tileStyle,
      marker: p.marker,
      markerStyle: { color: p.color },
      label: LABELS[style],
    };
  }
  return {
    nameClassName: "",
    nameStyle: { color: p.color, textShadow: `0 0 10px ${p.glow}` },
    tileStyle,
    marker: p.marker,
    markerStyle: { color: p.color },
    label: LABELS[style],
  };
}
