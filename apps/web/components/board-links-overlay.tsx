"use client";

/**
 * The chute/ladder arrows drawn over a board image — shared by the live
 * board view, the designer and the headless board-image page so every
 * surface (site, Discord Activity, Discord PNG) shows the same links.
 *
 * Coordinates are the tiles' fractional x/y scaled into a viewBox with the
 * image's own aspect ratio, so the SVG stretches with the container without
 * distorting the arrowheads (the container is sized to that same ratio).
 */

import { useId } from "react";

export type OverlayTile = {
  idx: number;
  x: number;
  y: number;
  jump_to?: number | null;
  jump_when?: "land" | "complete" | null;
};

export function BoardLinksOverlay({
  tiles,
  width,
  height,
  highlight = null,
}: {
  tiles: OverlayTile[];
  /** The board image's pixel size (or any pair in the container's ratio). */
  width: number;
  height: number;
  /** A tile idx whose link (in either direction) is drawn emphasised. */
  highlight?: number | null;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const byIdx = new Map(tiles.map((t) => [t.idx, t]));
  const links = tiles.filter((t) => t.jump_to != null && byIdx.has(t.jump_to));
  if (links.length === 0) return null;
  const W = Math.max(1, width);
  const H = Math.max(1, height);
  const unit = Math.min(W, H) / 100; // 1% of the short edge
  const stroke = unit * 0.45;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
      aria-hidden
    >
      <defs>
        <marker
          id={`ladder-${uid}`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth={unit * 2.2}
          markerHeight={unit * 2.2}
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#6fbf73" />
        </marker>
        <marker
          id={`chute-${uid}`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth={unit * 2.2}
          markerHeight={unit * 2.2}
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#e05c4d" />
        </marker>
      </defs>
      {links.map((t) => {
        const target = byIdx.get(t.jump_to as number)!;
        const ladder = (t.jump_to as number) > t.idx;
        const x1 = t.x * W;
        const y1 = t.y * H;
        const x2 = target.x * W;
        const y2 = target.y * H;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / len;
        const uy = dy / len;
        // Start just outside the base circle, stop short of the target so
        // the arrowhead sits beside the tile marker rather than under it.
        const sx = x1 + ux * unit * 1.8;
        const sy = y1 + uy * unit * 1.8;
        const ex = x2 - ux * unit * 2.4;
        const ey = y2 - uy * unit * 2.4;
        const emphasised = highlight != null && (highlight === t.idx || highlight === t.jump_to);
        const color = ladder ? "#6fbf73" : "#e05c4d";
        return (
          <g key={t.idx} opacity={highlight != null && !emphasised ? 0.45 : 0.95}>
            <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="rgba(0,0,0,0.55)" strokeWidth={stroke * 2.2} strokeLinecap="round" />
            <line
              x1={sx}
              y1={sy}
              x2={ex}
              y2={ey}
              stroke={color}
              strokeWidth={emphasised ? stroke * 1.5 : stroke}
              strokeLinecap="round"
              strokeDasharray={t.jump_when === "complete" ? `${unit * 1.4} ${unit * 0.9}` : undefined}
              markerEnd={`url(#${ladder ? "ladder" : "chute"}-${uid})`}
            />
            <circle cx={sx} cy={sy} r={stroke * 1.4} fill={color} stroke="rgba(0,0,0,0.6)" strokeWidth={stroke * 0.5} />
          </g>
        );
      })}
    </svg>
  );
}
