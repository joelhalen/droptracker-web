"use client";

/**
 * Conquest territory map (web121a): the drawn Gielinor map, where every tile
 * owns a piece of the real world map.
 *
 * Layers, bottom to top:
 *  - the terrain backdrop (sea, land, scenery; a static image the preset
 *    ships, see disc scripts/conquest_map);
 *  - an SVG layer in the map's shape space: every territory filled in its
 *    owner's colour (or a wash of its region's), dashed borders between
 *    territories, each region edged in its own colour, and the region names
 *    with a row of ownership pips (one per tile, in its holder's colour);
 *  - the boss badges as HTML (medallion + name scroll), sized in map units
 *    through a container-query unit so they scale with the map exactly as
 *    the generator laid them out (it kept every border clear of them).
 *
 * Hovering anywhere on a territory shows the same card as its badge, and
 * lights up the whole region it belongs to. Zoom buttons and drag-to-pan
 * for when the whole of Gielinor is too small to read.
 */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { CanvasRegion, CanvasTile } from "@/components/conquest-map";
import { NEUTRAL_COLOR, REGION_COLORS, regionStanding } from "@/lib/conquest";

/** Badge metrics in map units: keep in sync with disc
 * scripts/conquest_map/geo.py BADGE (the generator kept this much room). */
const BADGE = { r: 36, font: 21, scrollTop: 39, scrollH: 26, padX: 11, tail: 9 };
const REGION_FONT = 34;
const INK = "#2b1d0e";
const PARCHMENT = "#f3e6c4";
const ZOOMS = [1, 1.5, 2, 3] as const;
const RS_FONT = "var(--font-runescape), 'Trebuchet MS', sans-serif";
const CARD_WIDTH = 300;

/** n map units as a CSS length (the box is the size container). */
const u = (n: number) => `calc(${n} * var(--cq-u))`;

function tileIcon(tile: CanvasTile): string | null {
  if (tile.icon_item_id) return `/img/itemdb/${tile.icon_item_id}.png`;
  if (tile.icon_npc_id) return `/img/npcdb/${tile.icon_npc_id}.png`;
  return null;
}

type Point = { x: number; y: number };

export function ConquestTerritoryMap({
  tiles,
  regions,
  space,
  background,
  colors,
  viewerTeamId = null,
  selectedKey = null,
  flashKeys,
  highlightRegionKey = null,
  onHoverRegion,
  onSelect,
  renderCard,
  editable = false,
  onMove,
  coarse = false,
  controls = true,
  className = "",
}: {
  tiles: CanvasTile[];
  regions: CanvasRegion[];
  /** The coordinate space the shapes are drawn in. */
  space: { width: number; height: number };
  background: { url: string } | null;
  colors: Map<number, string>;
  viewerTeamId?: number | null;
  selectedKey?: string | null;
  flashKeys?: Set<string>;
  /** A region lit up from outside (the regions list). */
  highlightRegionKey?: string | null;
  /** The region under the pointer changed (null = left the map). */
  onHoverRegion?: (key: string | null) => void;
  onSelect?: (key: string) => void;
  renderCard?: (key: string) => ReactNode;
  editable?: boolean;
  onMove?: (key: string, x: number, y: number) => void;
  coarse?: boolean;
  /** Zoom buttons (off for the Discord image). */
  controls?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { width: W, height: H } = space;
  const scrollRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [zoomIdx, setZoomIdx] = useState(0);
  const zoom = ZOOMS[zoomIdx]!;
  // The hovered tile is state (it changes the drawing); the pointer position
  // is not: the card follows it through a ref, so moving within one
  // territory never re-renders the map.
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const hoverKeyRef = useRef<string | null>(null);
  const pointer = useRef<Point>({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{ key: string; moved: boolean } | null>(null);
  const pan = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(
    null,
  );
  const justPanned = useRef(false);
  const keepCentre = useRef<{ fx: number; fy: number } | null>(null);

  const regionIndex = new Map(regions.map((r, i) => [r.key, i]));
  const regionColor = (key: string | null): string => {
    if (!key) return NEUTRAL_COLOR;
    const r = regions[regionIndex.get(key) ?? -1];
    return r?.color ?? REGION_COLORS[(regionIndex.get(key) ?? 0) % REGION_COLORS.length]!;
  };
  const hoveredTile = hoverKey ? tiles.find((t) => t.key === hoverKey) : undefined;
  const litRegion = hoveredTile?.region_key ?? highlightRegionKey;

  // Hover: a territory and its badge behave as one target.
  const point = useCallback(
    (key: string, e: { clientX: number; clientY: number }) => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
      pointer.current = { x: e.clientX, y: e.clientY };
      if (cardRef.current) placeCard(cardRef.current, pointer.current);
      if (hoverKeyRef.current !== key) {
        hoverKeyRef.current = key;
        setHoverKey(key);
        onHoverRegion?.(tiles.find((x) => x.key === key)?.region_key ?? null);
      }
    },
    [tiles, onHoverRegion],
  );
  const leave = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => {
      hoverKeyRef.current = null;
      setHoverKey(null);
      onHoverRegion?.(null);
    }, 90);
  }, [onHoverRegion]);
  useEffect(
    () => () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    [],
  );

  const select = (key: string) => {
    if (justPanned.current) return;
    onSelect?.(key);
  };

  // Zoom around the middle of what is on screen.
  const setZoom = (next: number) => {
    const el = scrollRef.current;
    if (el) {
      keepCentre.current = {
        fx: (el.scrollLeft + el.clientWidth / 2) / Math.max(el.scrollWidth, 1),
        fy: (el.scrollTop + el.clientHeight / 2) / Math.max(el.scrollHeight, 1),
      };
    }
    setZoomIdx(Math.min(Math.max(next, 0), ZOOMS.length - 1));
  };
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const c = keepCentre.current;
    if (!el || !c) return;
    el.scrollLeft = c.fx * el.scrollWidth - el.clientWidth / 2;
    el.scrollTop = c.fy * el.scrollHeight - el.clientHeight / 2;
    keepCentre.current = null;
  }, [zoomIdx]);

  // Drag to pan a zoomed map (mouse/pen; touch scrolls natively).
  const onPanStart = (e: React.PointerEvent) => {
    if (zoom === 1 || e.button !== 0 || e.pointerType === "touch" || drag.current) return;
    const el = scrollRef.current;
    if (!el) return;
    pan.current = {
      x: e.clientX,
      y: e.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
      moved: false,
    };
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = pan.current;
      const el = scrollRef.current;
      if (!p || !el) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (!p.moved && Math.hypot(dx, dy) < 5) return;
      p.moved = true;
      el.scrollLeft = p.left - dx;
      el.scrollTop = p.top - dy;
    };
    const up = () => {
      if (pan.current?.moved) {
        justPanned.current = true;
        setTimeout(() => {
          justPanned.current = false;
        }, 0);
      }
      pan.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const positionFor = (clientX: number, clientY: number) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.min(Math.max((clientX - rect.left) / rect.width, 0.01), 0.99),
      y: Math.min(Math.max((clientY - rect.top) / rect.height, 0.01), 0.99),
    };
  };

  const shaped = tiles.filter((t) => t.shape);
  const tilesByRegion = new Map<string, CanvasTile[]>();
  for (const t of tiles) {
    if (!t.region_key) continue;
    const list = tilesByRegion.get(t.region_key) ?? [];
    list.push(t);
    tilesByRegion.set(t.region_key, list);
  }
  const interactive = !editable && !!renderCard && !coarse;
  const hoverable = !editable;

  const pathHandlers = (key: string) =>
    hoverable
      ? {
          onPointerEnter: (e: React.PointerEvent) => interactive && point(key, e),
          onPointerMove: (e: React.PointerEvent) => interactive && point(key, e),
          onPointerLeave: () => interactive && leave(),
          onClick: () => select(key),
        }
      : { onClick: () => select(key) };

  return (
    <div className={`relative ${className}`}>
      {controls && (
        <div className="absolute right-2 top-2 z-40 flex overflow-hidden rounded border border-black/50 bg-black/70 text-sm text-white shadow">
          <button
            type="button"
            aria-label="Zoom out"
            disabled={zoomIdx === 0}
            onClick={() => setZoom(zoomIdx - 1)}
            className="px-2.5 py-1 hover:bg-white/10 disabled:opacity-40"
          >
            −
          </button>
          <span className="border-x border-white/15 px-2 py-1 tabular-nums">{zoom}×</span>
          <button
            type="button"
            aria-label="Zoom in"
            disabled={zoomIdx === ZOOMS.length - 1}
            onClick={() => setZoom(zoomIdx + 1)}
            className="px-2.5 py-1 hover:bg-white/10 disabled:opacity-40"
          >
            +
          </button>
        </div>
      )}
      <div
        ref={scrollRef}
        onPointerDown={onPanStart}
        className={`border-osrs-bronze/30 w-full overflow-auto rounded border ${
          zoom > 1 ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        style={{ maxHeight: zoom > 1 ? "80vh" : undefined }}
      >
        <div
          ref={boxRef}
          className="relative touch-manipulation select-none"
          style={
            {
              width: `${zoom * 100}%`,
              minWidth: coarse ? 720 : undefined,
              aspectRatio: `${W} / ${H}`,
              containerType: "inline-size",
              "--cq-u": `calc(100cqw / ${W})`,
              background: "radial-gradient(ellipse at 50% 45%, #3a7fb4 0%, #1f4f7c 100%)",
            } as CSSProperties
          }
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
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            onPointerLeave={() => interactive && leave()}
          >
            <defs>
              {shaped.map((t) => (
                <clipPath key={t.key} id={`${uid}-t-${t.key}`}>
                  <path d={t.shape!} />
                </clipPath>
              ))}
              {regions
                .filter((r) => r.shape)
                .map((r) => (
                  <clipPath key={r.key} id={`${uid}-r-${r.key}`}>
                    <path d={r.shape!} />
                  </clipPath>
                ))}
              <filter id={`${uid}-glow`} x="-5%" y="-5%" width="110%" height="110%">
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>

            {/* Territory fills: the hover / click targets. */}
            {shaped.map((t) => {
              const owner = t.owner_team_id != null ? colors.get(t.owner_team_id) : undefined;
              const lit = hoverKey === t.key || selectedKey === t.key;
              return (
                <path
                  key={t.key}
                  d={t.shape!}
                  fill={owner ?? regionColor(t.region_key)}
                  fillOpacity={(owner ? 0.5 : 0.28) + (lit ? 0.14 : 0)}
                  className={onSelect || interactive ? "cursor-pointer" : undefined}
                  {...pathHandlers(t.key)}
                />
              );
            })}

            <g pointerEvents="none">
              {/* An owned territory is edged inside in its team's colour. */}
              {shaped.map((t) => {
                const owner = t.owner_team_id != null ? colors.get(t.owner_team_id) : undefined;
                if (!owner) return null;
                return (
                  <path
                    key={t.key}
                    d={t.shape!}
                    fill="none"
                    stroke={owner}
                    strokeWidth={12}
                    strokeOpacity={0.85}
                    clipPath={`url(#${uid}-t-${t.key})`}
                  />
                );
              })}
              {shaped.map((t) => (
                <path
                  key={`b-${t.key}`}
                  d={t.shape!}
                  fill="none"
                  stroke={INK}
                  strokeWidth={2}
                  strokeDasharray="7 5"
                  strokeOpacity={0.55}
                />
              ))}
              {/* Each region edged inside in its own colour, then outlined. */}
              {regions
                .filter((r) => r.shape)
                .map((r) => (
                  <path
                    key={`rb-${r.key}`}
                    d={r.shape!}
                    fill="none"
                    stroke={regionColor(r.key)}
                    strokeWidth={20}
                    strokeOpacity={0.75}
                    strokeLinejoin="round"
                    clipPath={`url(#${uid}-r-${r.key})`}
                  />
                ))}
              {regions
                .filter((r) => r.shape)
                .map((r) => (
                  <g key={`ro-${r.key}`}>
                    <path
                      d={r.shape!}
                      fill="none"
                      stroke={INK}
                      strokeWidth={7}
                      strokeOpacity={0.75}
                      strokeLinejoin="round"
                    />
                    <path
                      d={r.shape!}
                      fill="none"
                      stroke="#f6e7b8"
                      strokeWidth={1.6}
                      strokeOpacity={0.9}
                      strokeLinejoin="round"
                    />
                  </g>
                ))}
              {/* The region under the pointer (or picked in the list). */}
              {regions
                .filter((r) => r.shape && r.key === litRegion)
                .map((r) => (
                  <g key={`lit-${r.key}`}>
                    <path
                      d={r.shape!}
                      fill="none"
                      stroke="#ffe39a"
                      strokeWidth={14}
                      strokeOpacity={0.7}
                      filter={`url(#${uid}-glow)`}
                    />
                    <path
                      d={r.shape!}
                      fill="none"
                      stroke="#ffe39a"
                      strokeWidth={5}
                      strokeLinejoin="round"
                    />
                  </g>
                ))}
              {hoveredTile?.shape && (
                <path
                  d={hoveredTile.shape}
                  fill="none"
                  stroke="#fff6d8"
                  strokeWidth={4}
                  strokeLinejoin="round"
                />
              )}
              {shaped
                .filter((t) => flashKeys?.has(t.key))
                .map((t) => (
                  <path
                    key={`f-${t.key}`}
                    d={t.shape!}
                    fill="#fff6d8"
                    fillOpacity={0.35}
                    stroke="#fff6d8"
                    strokeWidth={6}
                    className="animate-pulse"
                  />
                ))}

              {regions.map((r) => (
                <RegionName
                  key={`n-${r.key}`}
                  region={r}
                  members={tilesByRegion.get(r.key) ?? []}
                  colors={colors}
                  W={W}
                  H={H}
                />
              ))}
            </g>
          </svg>

          {tiles.map((t) => (
            <Badge
              key={t.key}
              tile={t}
              colors={colors}
              mine={viewerTeamId != null && t.owner_team_id === viewerTeamId}
              selected={selectedKey === t.key}
              lit={hoverKey === t.key}
              flash={!!flashKeys?.has(t.key)}
              editable={editable}
              onPointerDown={(e) => {
                if (!editable) return;
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                drag.current = { key: t.key, moved: false };
              }}
              onPointerMove={(e) => {
                if (editable) {
                  if (!drag.current || drag.current.key !== t.key) return;
                  const at = positionFor(e.clientX, e.clientY);
                  if (!at) return;
                  drag.current.moved = true;
                  onMove?.(t.key, at.x, at.y);
                } else if (interactive) {
                  point(t.key, e);
                }
              }}
              onPointerEnter={(e) => interactive && point(t.key, e)}
              onPointerLeave={() => interactive && leave()}
              onPointerUp={() => {
                if (!editable) return;
                const d = drag.current;
                drag.current = null;
                if (d && !d.moved) onSelect?.(t.key);
              }}
              onClick={() => !editable && select(t.key)}
            />
          ))}
        </div>
      </div>

      {interactive && hoverKey && typeof document !== "undefined"
        ? createPortal(
            <FloatingCard ref={cardRef} at={pointer.current}>
              {renderCard?.(hoverKey)}
            </FloatingCard>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Put the card beside the pointer, flipped away from the window's edges. */
function placeCard(el: HTMLElement, at: Point) {
  const gap = 18;
  const left =
    at.x + gap + CARD_WIDTH > window.innerWidth - 8
      ? Math.max(8, at.x - gap - CARD_WIDTH)
      : at.x + gap;
  el.style.left = `${left}px`;
  if (at.y > window.innerHeight * 0.55) {
    el.style.top = "";
    el.style.bottom = `${window.innerHeight - at.y + gap}px`;
  } else {
    el.style.bottom = "";
    el.style.top = `${at.y + gap}px`;
  }
}

/** The hover card, following the pointer (it never takes the pointer, so
 * sweeping across the map moves smoothly from territory to territory). */
function FloatingCard({
  ref,
  at,
  children,
}: {
  ref: React.RefObject<HTMLDivElement | null>;
  at: Point;
  children: ReactNode;
}) {
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el;
      if (el) placeCard(el, at);
    },
    // Placed once on mount; the map moves it from then on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ref],
  );
  return (
    <div
      ref={setRef}
      className="card-pop pointer-events-none fixed z-[70] p-3"
      style={{ width: CARD_WIDTH }}
      role="tooltip"
    >
      {children}
    </div>
  );
}

/** A region's name with its crown (when a team controls it) and one pip per
 * tile in its holder's colour: who is closest to taking it, at a glance. */
function RegionName({
  region,
  members,
  colors,
  W,
  H,
}: {
  region: CanvasRegion;
  members: CanvasTile[];
  colors: Map<number, string>;
  W: number;
  H: number;
}) {
  if (region.label_x == null || region.label_y == null || !members.length) return null;
  const x = region.label_x * W;
  const y = region.label_y * H;
  const standing = regionStanding(
    members.map((t) => ({ id: 0, kind: t.kind, owner_team_id: t.owner_team_id })),
  );
  const controller = standing.controller != null ? colors.get(standing.controller) : undefined;
  const pips = members.filter((t) => t.kind !== "respawn");
  const pipGap = 17;
  const pipStart = x - ((pips.length - 1) * pipGap) / 2;
  return (
    <g>
      {controller && (
        <path
          transform={`translate(${x - 21}, ${y - REGION_FONT - 30}) scale(1.5)`}
          d="M0 18 L2 4 L8 11 L14 0 L20 11 L26 4 L28 18 Z"
          fill={controller}
          stroke="#000"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      )}
      <text
        x={x}
        y={y}
        textAnchor="middle"
        fontSize={REGION_FONT}
        fill={controller ?? "#ff981f"}
        stroke="#000"
        strokeWidth={5}
        paintOrder="stroke"
        strokeLinejoin="round"
        style={{ fontFamily: RS_FONT, letterSpacing: "1px" }}
      >
        {region.name}
      </text>
      {pips.map((t, i) => {
        const owner = t.owner_team_id != null ? colors.get(t.owner_team_id) : undefined;
        return (
          <circle
            key={t.key}
            cx={pipStart + i * pipGap}
            cy={y + 15}
            r={6.5}
            fill={owner ?? PARCHMENT}
            fillOpacity={owner ? 1 : 0.55}
            stroke="#000"
            strokeWidth={1.6}
          />
        );
      })}
    </g>
  );
}

/** A boss badge: gold medallion (the team's colour once owned) with the
 * boss's portrait, a name scroll underneath and a defense shield. */
function Badge({
  tile,
  colors,
  mine,
  selected,
  lit,
  flash,
  editable,
  ...handlers
}: {
  tile: CanvasTile;
  colors: Map<number, string>;
  mine: boolean;
  selected: boolean;
  lit: boolean;
  flash: boolean;
  editable: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerEnter: (e: React.PointerEvent) => void;
  onPointerLeave: () => void;
  onPointerUp: () => void;
  onClick: () => void;
}) {
  const owner = tile.owner_team_id != null ? colors.get(tile.owner_team_id) : undefined;
  const respawn = tile.kind === "respawn";
  const icon = tileIcon(tile);
  const ring = respawn
    ? "#e8e8e8"
    : (owner ?? "linear-gradient(180deg,#fbe39a,#d9a441 50%,#8f5f1d)");
  const glow = [
    mine ? `0 0 0 ${u(4)} rgba(255,215,0,0.85)` : "",
    selected || lit ? `0 0 0 ${u(4)} #fff6d8` : "",
    `0 ${u(3)} ${u(4)} rgba(0,0,0,0.55)`,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <div
      className="absolute"
      style={{
        left: `${tile.x * 100}%`,
        top: `${tile.y * 100}%`,
        width: 0,
        height: 0,
        zIndex: selected || lit ? 30 : 10,
      }}
    >
      <button
        type="button"
        aria-label={tile.label}
        className={`absolute rounded-full ${
          editable ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer"
        }`}
        style={{
          left: u(-BADGE.r),
          top: u(-BADGE.r),
          width: u(BADGE.r * 2),
          height: u(BADGE.r * 2),
          background: ring,
          border: `${u(2.6)} ${respawn ? "dashed" : "solid"} ${INK}`,
          boxShadow: glow,
        }}
        {...handlers}
      >
        {flash && (
          <span
            className="absolute animate-ping rounded-full border-2"
            style={{ inset: u(-6), borderColor: owner ?? "#fff6d8" }}
          />
        )}
        <span
          className="absolute overflow-hidden rounded-full"
          style={{
            inset: u(5.4),
            background: PARCHMENT,
            border: `${u(1.8)} solid ${INK}`,
          }}
        >
          {icon ? (
            <img
              src={icon}
              alt=""
              className="pointer-events-none h-full w-full object-contain"
              style={{ padding: u(2) }}
              draggable={false}
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
            />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center font-bold"
              style={{ fontSize: u(20), color: INK }}
            >
              {respawn ? "R" : tile.label.slice(0, 2)}
            </span>
          )}
        </span>
      </button>

      {!respawn && owner && tile.defense > 0 && <Shield color={owner} defense={tile.defense} />}

      <span
        className="pointer-events-none absolute flex items-center"
        style={{
          top: u(BADGE.scrollTop),
          left: 0,
          transform: "translateX(-50%)",
          height: u(BADGE.scrollH),
        }}
      >
        <span
          style={{
            width: u(BADGE.tail + 3),
            height: u(BADGE.scrollH - 6),
            marginRight: u(-3),
            background: "#d8c393",
            clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 45% 50%)",
          }}
        />
        <span
          className="whitespace-nowrap leading-none"
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            padding: `0 ${u(BADGE.padX)}`,
            background: PARCHMENT,
            border: `${u(1.5)} solid ${INK}`,
            borderRadius: u(3),
            color: INK,
            fontFamily: RS_FONT,
            fontSize: u(BADGE.font),
            position: "relative",
          }}
        >
          {tile.label}
        </span>
        <span
          style={{
            width: u(BADGE.tail + 3),
            height: u(BADGE.scrollH - 6),
            marginLeft: u(-3),
            background: "#d8c393",
            clipPath: "polygon(0 0, 100% 0, 55% 50%, 100% 100%, 0 100%)",
          }}
        />
      </span>
    </div>
  );
}

function Shield({ color, defense }: { color: string; defense: number }) {
  return (
    <svg
      className="pointer-events-none absolute"
      viewBox="-9 -10 18 21"
      style={{ left: u(27.6 - 12), top: u(22.8 - 14), width: u(24), height: u(28) }}
      aria-label={`Defense ${defense}`}
    >
      <path
        d="M0 -8 L7 -5.5 V0 C7 5 3.5 7.5 0 9 C-3.5 7.5 -7 5 -7 0 V-5.5Z"
        fill={color}
        stroke={INK}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <text
        y={4}
        textAnchor="middle"
        fontSize={10}
        fill="#fff"
        stroke="#000"
        strokeWidth={2.2}
        paintOrder="stroke"
        style={{ fontFamily: RS_FONT }}
      >
        {defense}
      </text>
    </svg>
  );
}
