"use client";

/**
 * Native 1:1 lootboard (FRONTEND_PLAN.md §12). A pixel-faithful HTML recreation
 * of the PIL-generated board (disc/lootboard/generator.py): the group's
 * configured template as the background, with the item grid, leaderboard,
 * recent-drops panel and header painted at the generator's exact coordinates
 * (see lib/lootboard-layout.ts). Because it is HTML rather than a PNG, item and
 * recent-drop tiles are hoverable for detail. The PNG generator stays available
 * as a "Download image" share affordance.
 *
 * The board is authored in the generator's native 1074×795 pixel space and
 * scaled to the container with a single CSS transform, so it stays responsive
 * without recomputing any coordinates. Falls back to the simple grid when the
 * API response predates the native fields (or in mock mode without them).
 */
import { useCallback, useLayoutEffect, useRef, useState, useTransition } from "react";
import type { Lootboard, LootItem, LootboardRecentDrop } from "@droptracker/api-types";
import { formatGp } from "@/lib/format";
import { generateLootboardImage } from "@/app/(public)/groups/[id]/lootboard/actions";
import { LootboardGrid } from "@/components/lootboard-grid";
import { ItemContributors } from "@/components/lootboard-item-tooltip";
import {
  CANVAS,
  FONT,
  HEADER,
  ICON_BOX,
  ITEM_SLOTS,
  ITEM_TEXT,
  LEADERBOARD,
  RECENT_SLOTS,
  RECENT_TEXT,
  TEXT_STROKE,
  YELLOW,
  timeSince,
  valueColor,
} from "@/lib/lootboard-layout";

const px = (n: number) => `${n}px`;

/** A stroked text label positioned by its top-left corner (PIL's draw.text anchor). */
function Label({
  x,
  y,
  size,
  color,
  children,
  center,
  bold,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
  children: React.ReactNode;
  center?: boolean;
  bold?: boolean;
}) {
  return (
    <span
      style={{
        position: "absolute",
        left: px(x),
        top: px(y),
        fontFamily: "var(--font-runescape), 'Trebuchet MS', sans-serif",
        fontSize: px(size),
        lineHeight: 1,
        color,
        textShadow: TEXT_STROKE,
        whiteSpace: "nowrap",
        transform: center ? "translateX(-50%)" : undefined,
        textAlign: center ? "center" : "left",
        fontWeight: bold ? 700 : 400,
        pointerEvents: "none",
      }}
    >
      {children}
    </span>
  );
}

type HoverTarget =
  | { kind: "item"; slot: number; item: LootItem }
  | { kind: "recent"; slot: number; drop: LootboardRecentDrop };

export function LootboardCanvas({ board }: { board: Lootboard }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  const canvas = board.canvas ?? CANVAS;

  // Scale the native-pixel board to the container width.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / canvas.width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvas.width]);

  const onDownload = useCallback(
    () =>
      startTransition(async () => {
        setNotice(null);
        const { url } = await generateLootboardImage(board.group_id, board.period);
        if (url) window.open(url, "_blank");
        else setNotice("Image generation isn't configured in this environment (mock mode).");
      }),
    [board.group_id, board.period],
  );

  // Older API response / mock without the native fields → keep the simple grid.
  if (!board.background_url) return <LootboardGrid board={board} />;

  const useGp = board.use_gp_colors ?? true;
  const items = board.items.slice(0, ITEM_SLOTS.length);
  const recents = (board.recent_drops ?? []).slice(0, RECENT_SLOTS.length);
  const leaders = (board.leaderboard ?? []).slice(0, LEADERBOARD.rows);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-osrs-parchment-dark/70 text-sm">Total loot</span>
          <span className="text-osrs-gold-bright ml-2 text-xl font-bold tabular-nums">
            {board.total.value_formatted}
          </span>
        </div>
        <button
          onClick={onDownload}
          disabled={pending}
          className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {pending ? "Generating…" : "Download image"}
        </button>
      </div>

      {notice && <p className="text-osrs-parchment-dark/70 text-sm">{notice}</p>}

      {/* Scaling wrapper: reserves the board's aspect ratio; the inner layer is
          authored at native px and scaled to fit. */}
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: px(canvas.width),
            height: px(canvas.height),
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {/* Template background */}
          <img
            src={board.background_url}
            alt=""
            width={canvas.width}
            height={canvas.height}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />

          {/* Header: prefix (yellow) + total (value colour), centered on top. */}
          <Label x={HEADER.centerX} y={HEADER.y} size={FONT.header} color={YELLOW} center bold>
            {board.header}
            <span style={{ color: valueColor(board.total.value) }}>{board.total.value_formatted}</span>
          </Label>

          {/* Leaderboard (left panel): rank / name / gp, centered on each anchor. */}
          {leaders.map((row, i) => {
            const y = LEADERBOARD.startY + i * LEADERBOARD.step;
            return (
              <div key={`lb-${row.player_id}-${i}`}>
                <Label x={LEADERBOARD.rankX} y={y} size={FONT.leaderboard} color={YELLOW} center>
                  {row.rank}
                </Label>
                <Label x={LEADERBOARD.nameX} y={y} size={FONT.leaderboard} color={YELLOW} center>
                  {row.player_name}
                </Label>
                <Label x={LEADERBOARD.gpX} y={y} size={FONT.leaderboard} color={YELLOW} center>
                  {row.total.value_formatted}
                </Label>
              </div>
            );
          })}

          {/* Item grid (top-right). */}
          {items.map((it, i) => {
            const slot = ITEM_SLOTS[i];
            if (!slot) return null;
            const gpColor = useGp ? valueColor(it.value.value) : YELLOW;
            return (
              <div key={`it-${it.item_id}-${i}`}>
                <IconTile
                  slot={slot}
                  iconUrl={it.icon_url}
                  alt={it.name}
                  onEnter={() => setHover({ kind: "item", slot: i, item: it })}
                  onLeave={() => setHover((h) => (h?.kind === "item" && h.slot === i ? null : h))}
                />
                {!it.is_coin && (
                  <Label
                    x={slot.x + ITEM_TEXT.qty.dx}
                    y={slot.y + ITEM_TEXT.qty.dy}
                    size={FONT.itemQty}
                    color={YELLOW}
                  >
                    {formatGp(it.quantity)}
                  </Label>
                )}
                <Label
                  x={slot.x + ITEM_TEXT.value.dx}
                  y={slot.y + ITEM_TEXT.value.dy}
                  size={FONT.itemValue}
                  color={gpColor}
                >
                  {it.value.value_formatted}
                </Label>
              </div>
            );
          })}

          {/* Recent drops (bottom). */}
          {recents.map((d, i) => {
            const slot = RECENT_SLOTS[i];
            if (!slot) return null;
            return (
              <div key={`rc-${d.item_id}-${i}`}>
                <IconTile
                  slot={slot}
                  iconUrl={d.icon_url}
                  alt={d.name}
                  onEnter={() => setHover({ kind: "recent", slot: i, drop: d })}
                  onLeave={() => setHover((h) => (h?.kind === "recent" && h.slot === i ? null : h))}
                />
                <Label
                  x={slot.x + RECENT_TEXT.player.dx}
                  y={slot.y + RECENT_TEXT.player.dy}
                  size={FONT.recent}
                  color={YELLOW}
                >
                  {d.player_name}
                </Label>
                <Label
                  x={slot.x + RECENT_TEXT.time.dx}
                  y={slot.y + RECENT_TEXT.time.dy}
                  size={FONT.recent}
                  color={YELLOW}
                >
                  {timeSince(d.date_added)}
                </Label>
              </div>
            );
          })}
        </div>

        {/* Tooltip lives outside the scaled layer so it stays legible at any size. */}
        {hover && (
          <Tooltip
            scale={scale}
            slot={hover.kind === "item" ? ITEM_SLOTS[hover.slot] : RECENT_SLOTS[hover.slot]}
          >
            {hover.kind === "item" ? (
              <>
                <div className="text-osrs-gold-bright font-medium">{hover.item.name}</div>
                <div className="text-osrs-parchment-dark/80">
                  {hover.item.is_coin ? "Coins" : `${hover.item.quantity.toLocaleString()}×`} ·{" "}
                  {hover.item.value.value_formatted} gp
                </div>
                <ItemContributors item={hover.item} />
              </>
            ) : (
              <>
                <div className="text-osrs-gold-bright font-medium">{hover.drop.name}</div>
                <div className="text-osrs-parchment">{hover.drop.player_name}</div>
                <div className="text-osrs-parchment-dark/80">
                  {hover.drop.value.value_formatted} gp · {timeSince(hover.drop.date_added)}
                </div>
              </>
            )}
          </Tooltip>
        )}
      </div>
    </div>
  );
}

/** An item icon centered in the generator's 75×60 paste box at a slot. */
function IconTile({
  slot,
  iconUrl,
  alt,
  onEnter,
  onLeave,
}: {
  slot: { x: number; y: number };
  iconUrl?: string;
  alt: string;
  onEnter: () => void;
  onLeave: () => void;
}) {
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        position: "absolute",
        left: px(slot.x + ICON_BOX.dx),
        top: px(slot.y + ICON_BOX.dy),
        width: px(ICON_BOX.w),
        height: px(ICON_BOX.h),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={alt}
          style={{ maxWidth: "90%", maxHeight: "90%", objectFit: "contain" }}
          loading="lazy"
        />
      ) : null}
    </div>
  );
}

/** Constant-size tooltip anchored above a slot (positioned in unscaled space). */
function Tooltip({
  scale,
  slot,
  children,
}: {
  scale: number;
  slot: { x: number; y: number } | undefined;
  children: React.ReactNode;
}) {
  if (!slot) return null;
  const left = (slot.x + ICON_BOX.dx + ICON_BOX.w / 2) * scale;
  const top = (slot.y + ICON_BOX.dy) * scale;
  return (
    <div
      className="bg-osrs-brown-dark border-osrs-bronze/50 pointer-events-none absolute z-10 w-max max-w-[18rem] -translate-x-1/2 -translate-y-full rounded border px-2 py-1.5 text-left text-xs shadow-lg"
      style={{ left: px(left), top: px(top - 4) }}
    >
      {children}
    </div>
  );
}
