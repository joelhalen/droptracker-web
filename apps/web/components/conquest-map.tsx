"use client";

/**
 * Conquest map canvas (web120a): the shared renderer behind the live event
 * view, the designer and the Discord board image.
 *
 * Layers, bottom to top:
 *  - the backdrop: the organisers' uploaded art, or a drawn "sea" when there
 *    is none (the Gielinor preset ships no Jagex art);
 *  - an SVG layer in canvas units (1600×1000, or the art's own size): each
 *    region as soft blobs of its colour around its tiles, border lines
 *    between tiles, and the region labels with their controller;
 *  - the tiles as absolutely positioned HTML, so they can carry the site's
 *    hover cards (desktop) or open a sheet (touch), and be dragged in the
 *    designer. Positions are fractions of the canvas, so everything scales.
 *
 * Presentational only: callers pass tiles/regions in a neutral shape (the
 * view maps the API payload, the designer its draft), plus callbacks.
 */
import { useRef, type CSSProperties, type ReactNode } from "react";
import { HoverCard } from "@/components/hover-card";
import { CONQUEST_CANVAS, NEUTRAL_COLOR, REGION_COLORS, regionLabelPoint } from "@/lib/conquest";

export type CanvasTile = {
  key: string;
  label: string;
  x: number;
  y: number;
  kind: string;
  icon_npc_id: number | null;
  icon_item_id: number | null;
  owner_team_id: number | null;
  defense: number;
  region_key: string | null;
};

export type CanvasRegion = {
  key: string;
  name: string;
  color: string | null;
  bonus: number;
  label_x: number | null;
  label_y: number | null;
  owner_team_id: number | null;
};

/** Tile diameter as a share of the canvas width (the preset packs tiles
 * 108 canvas units apart, so a ~62-unit tile leaves room for its name). */
const TILE_WIDTH_PCT = 3.9;
/** Region blob radius in canvas units (1600-wide canvas). */
const BLOB_RADIUS = 66;

function tileIcon(tile: CanvasTile): string | null {
  if (tile.icon_item_id) return `/img/itemdb/${tile.icon_item_id}.png`;
  if (tile.icon_npc_id) return `/img/npcdb/${tile.icon_npc_id}.png`;
  return null;
}

function DefensePips({ defense, max }: { defense: number; max: number }) {
  if (max <= 0) return null;
  if (max > 6) {
    // No emoji anywhere on the map: the Discord image is rendered by a
    // server-side Chromium without an emoji font.
    return (
      <span className="rounded bg-black/70 px-1 text-[9px] font-semibold leading-tight text-white">
        {defense}/{max}
      </span>
    );
  }
  return (
    <span className="flex gap-[2px] rounded-full bg-black/60 px-[3px] py-[2px]">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`block size-[5px] rounded-full ${
            i < defense ? "bg-osrs-parchment" : "bg-osrs-parchment/20"
          }`}
        />
      ))}
    </span>
  );
}

export function ConquestMapCanvas({
  tiles,
  regions,
  edges = [],
  background,
  colors,
  maxDefense,
  viewerTeamId = null,
  selectedKey = null,
  flashKeys,
  onSelect,
  renderCard,
  editable = false,
  onMove,
  coarse = false,
  className = "",
}: {
  tiles: CanvasTile[];
  regions: CanvasRegion[];
  edges?: [string, string][];
  background: { url: string; width: number; height: number } | null;
  colors: Map<number, string>;
  maxDefense: number;
  viewerTeamId?: number | null;
  selectedKey?: string | null;
  /** Tiles that just changed hands — they pulse for a moment. */
  flashKeys?: Set<string>;
  onSelect?: (key: string) => void;
  /** Hover-card body for a tile (pointer devices, view mode). */
  renderCard?: (key: string) => ReactNode;
  editable?: boolean;
  /** Designer drag: the tile's new fractional position. */
  onMove?: (key: string, x: number, y: number) => void;
  /** Touch device: tiles are plain buttons (the caller opens a sheet). */
  coarse?: boolean;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ key: string; moved: boolean } | null>(null);
  const width = background?.width || CONQUEST_CANVAS.width;
  const height = background?.height || CONQUEST_CANVAS.height;

  const regionByKey = new Map(regions.map((r) => [r.key, r]));
  const regionColor = (key: string | null): string => {
    if (!key) return NEUTRAL_COLOR;
    const idx = regions.findIndex((r) => r.key === key);
    return regionByKey.get(key)?.color ?? REGION_COLORS[Math.max(idx, 0) % REGION_COLORS.length]!;
  };
  const tileByKey = new Map(tiles.map((t) => [t.key, t]));

  const positionFor = (clientX: number, clientY: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.min(Math.max((clientX - rect.left) / rect.width, 0.01), 0.99),
      y: Math.min(Math.max((clientY - rect.top) / rect.height, 0.01), 0.99),
    };
  };

  return (
    // Phones scroll the map sideways rather than shrinking 45 tiles to specks.
    <div className="w-full overflow-x-auto">
      <div
        ref={boxRef}
        className={`border-osrs-bronze/30 relative w-full min-w-[720px] touch-manipulation select-none overflow-hidden rounded border ${className}`}
        style={{
          aspectRatio: `${width} / ${height}`,
          background: background
            ? "#000"
            : "radial-gradient(ellipse at 50% 45%, #1d3a4a 0%, #142733 55%, #0d1a22 100%)",
        }}
      >
        {background && (
          <img
            src={background.url}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-fill"
            draggable={false}
          />
        )}

        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <filter id="conquest-soft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
          </defs>
          {/* Region blobs: one group per region, opacity on the GROUP so the
            overlapping circles don't darken where they meet. */}
          {regions.map((r) => {
            const members = tiles.filter((t) => t.region_key === r.key);
            if (!members.length) return null;
            const tint = regionColor(r.key);
            const owner = r.owner_team_id != null ? colors.get(r.owner_team_id) : undefined;
            return (
              <g key={r.key}>
                <g opacity={background ? 0.28 : 0.42} filter="url(#conquest-soft)">
                  {members.map((t) => (
                    <circle
                      key={t.key}
                      cx={t.x * width}
                      cy={t.y * height}
                      r={BLOB_RADIUS * (width / CONQUEST_CANVAS.width)}
                      fill={tint}
                    />
                  ))}
                </g>
                {owner && (
                  <g opacity={0.35}>
                    {members.map((t) => (
                      <circle
                        key={t.key}
                        cx={t.x * width}
                        cy={t.y * height}
                        r={(BLOB_RADIUS - 8) * (width / CONQUEST_CANVAS.width)}
                        fill="none"
                        stroke={owner}
                        strokeWidth={4}
                        strokeDasharray="10 8"
                      />
                    ))}
                  </g>
                )}
              </g>
            );
          })}
          {edges.map(([a, b]) => {
            const ta = tileByKey.get(a);
            const tb = tileByKey.get(b);
            if (!ta || !tb) return null;
            return (
              <line
                key={`${a}-${b}`}
                x1={ta.x * width}
                y1={ta.y * height}
                x2={tb.x * width}
                y2={tb.y * height}
                stroke="rgba(255,255,255,0.28)"
                strokeWidth={3}
                strokeDasharray="8 8"
              />
            );
          })}
          {regions.map((r) => {
            const members = tiles.filter((t) => t.region_key === r.key);
            if (!members.length) return null;
            const at = regionLabelPoint(r, members);
            const owner = r.owner_team_id != null ? colors.get(r.owner_team_id) : undefined;
            const scale = width / CONQUEST_CANVAS.width;
            return (
              <g key={`label-${r.key}`}>
                {owner && (
                  // A drawn crown, not an emoji (see DefensePips).
                  <path
                    transform={`translate(${at.x * width - 14 * scale}, ${
                      at.y * height - 50 * scale
                    }) scale(${scale})`}
                    d="M0 18 L2 4 L8 11 L14 0 L20 11 L26 4 L28 18 Z"
                    fill={owner}
                    stroke="rgba(0,0,0,0.8)"
                    strokeWidth={2}
                    strokeLinejoin="round"
                  />
                )}
                <text
                  x={at.x * width}
                  y={at.y * height}
                  textAnchor="middle"
                  fontSize={26 * scale}
                  fontWeight={700}
                  fill="#f3e6c4"
                  stroke="rgba(0,0,0,0.75)"
                  strokeWidth={5 * scale}
                  paintOrder="stroke"
                  style={{ letterSpacing: "0.04em" }}
                >
                  {r.name}
                </text>
                {owner && (
                  <rect
                    x={at.x * width - 40 * scale}
                    y={at.y * height + 8 * scale}
                    width={80 * scale}
                    height={6 * scale}
                    rx={3 * scale}
                    fill={owner}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {tiles.map((t) => {
          const respawn = t.kind === "respawn";
          const owner = t.owner_team_id != null ? colors.get(t.owner_team_id) : undefined;
          const ring = respawn ? "rgba(255,255,255,0.7)" : (owner ?? NEUTRAL_COLOR);
          const mine = viewerTeamId != null && t.owner_team_id === viewerTeamId;
          const icon = tileIcon(t);
          const anchor: CSSProperties = {
            position: "absolute",
            left: `${t.x * 100}%`,
            top: `${t.y * 100}%`,
            width: `${TILE_WIDTH_PCT}%`,
            zIndex: selectedKey === t.key ? 30 : 10,
          };
          const body = (
            <span className="relative flex flex-col items-center">
              <span
                className={`relative flex aspect-square w-full items-center justify-center rounded-full ${
                  editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                }`}
                style={{
                  border: `3px ${respawn ? "dashed" : "solid"} ${ring}`,
                  background: owner ? `${owner}55` : "rgba(10,12,14,0.72)",
                  boxShadow: [
                    mine ? "0 0 0 3px rgba(255,215,0,0.75)" : "",
                    selectedKey === t.key ? "0 0 0 3px #fff" : "",
                    "0 2px 6px rgba(0,0,0,0.6)",
                  ]
                    .filter(Boolean)
                    .join(", "),
                }}
              >
                {flashKeys?.has(t.key) && (
                  <span
                    className="absolute inset-[-6px] animate-ping rounded-full border-2"
                    style={{ borderColor: ring }}
                  />
                )}
                {icon ? (
                  <img
                    src={icon}
                    alt=""
                    className="pointer-events-none h-[72%] w-[72%] object-contain"
                    draggable={false}
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                    }}
                  />
                ) : (
                  <span className="text-osrs-parchment text-[10px] font-bold">
                    {respawn ? "R" : t.label.slice(0, 2)}
                  </span>
                )}
              </span>
              {!respawn && (
                <span className="-mt-1.5">
                  <DefensePips defense={t.defense} max={maxDefense} />
                </span>
              )}
              {/* The name hangs under the tile, capped to the gap to the next
                tile over so a dense cluster truncates instead of overlapping. */}
              <span
                className="pointer-events-none absolute left-1/2 top-full block -translate-x-1/2 truncate rounded bg-black/55 px-1 text-center leading-tight text-white/90"
                style={{ width: "165%", fontSize: "clamp(7px, 0.62vw, 11px)" }}
              >
                {t.label}
              </span>
            </span>
          );

          if (editable) {
            return (
              <button
                key={t.key}
                type="button"
                className="-translate-x-1/2 -translate-y-[36%] touch-none"
                style={anchor}
                aria-label={`${t.label}: drag to move, click to edit`}
                onPointerDown={(e) => {
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  drag.current = { key: t.key, moved: false };
                }}
                onPointerMove={(e) => {
                  if (!drag.current || drag.current.key !== t.key) return;
                  const at = positionFor(e.clientX, e.clientY);
                  if (!at) return;
                  drag.current.moved = true;
                  onMove?.(t.key, at.x, at.y);
                }}
                onPointerUp={() => {
                  const d = drag.current;
                  drag.current = null;
                  if (d && !d.moved) onSelect?.(t.key);
                }}
              >
                {body}
              </button>
            );
          }
          if (coarse || !renderCard) {
            return (
              <button
                key={t.key}
                type="button"
                className="-translate-x-1/2 -translate-y-[36%]"
                style={anchor}
                onClick={() => onSelect?.(t.key)}
                aria-label={t.label}
              >
                {body}
              </button>
            );
          }
          return (
            <HoverCard
              key={t.key}
              className="-translate-x-1/2 -translate-y-[36%]"
              style={anchor}
              width={300}
              content={renderCard(t.key)}
            >
              <span
                role="button"
                tabIndex={0}
                onClick={() => onSelect?.(t.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelect?.(t.key);
                }}
                aria-label={t.label}
              >
                {body}
              </span>
            </HoverCard>
          );
        })}
      </div>
    </div>
  );
}
