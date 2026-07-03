/**
 * Geometry + helpers that mirror the PIL lootboard generator
 * (disc/lootboard/generator.py) so the web board is a 1:1 overlay on the same
 * template. All coordinates are in the generator's native 1074×795 pixel space;
 * the component paints at these exact px values and scales the whole canvas with
 * a CSS transform, so placement/fonts stay pixel-faithful at any width.
 *
 * Sources:
 *   - Item slots  → disc/data/item-mapping.csv   (first 32 rows, 8×4 grid)
 *   - Recent slots→ disc/data/recent-mapping.csv  (first 12 rows, 6×2 grid)
 *   - Leaderboard/header anchors → generator.draw_leaderboard / draw_headers
 */

export const CANVAS = { width: 1074, height: 795 } as const;

export type Slot = { x: number; y: number };

/** Top-32 item slots — item-mapping.csv rows 1-32 (draw_drops_on_image). */
export const ITEM_SLOTS: Slot[] = (() => {
  const cols = [327, 417, 507, 597, 687, 777, 867, 957];
  const rows = [205, 283, 361, 439];
  const out: Slot[] = [];
  for (const y of rows) for (const x of cols) out.push({ x, y });
  return out; // 32 slots
})();

/** Top-12 recent-drop slots — recent-mapping.csv rows 1-12 (draw_recent_drops). */
export const RECENT_SLOTS: Slot[] = (() => {
  const cols = [17, 190, 363, 538, 714, 888];
  const rows = [540, 644];
  const out: Slot[] = [];
  for (const y of rows) for (const x of cols) out.push({ x, y });
  return out; // 12 slots
})();

/**
 * Icon box: generator pastes each item centered in a 75×60 box whose top-left is
 * (slot.x - 5, slot.y - 12). We place the icon in the same box.
 */
export const ICON_BOX = { w: 75, h: 60, dx: -5, dy: -12 } as const;

/** Text offsets relative to a slot's (x,y), from draw_drops_on_image. */
export const ITEM_TEXT = {
  /** quantity: (x+1, y-6)  [ctr_x, ctr_y+4 with ctr=(x+1,y-10)] */
  qty: { dx: 1, dy: -6 },
  /** value: (x+1, y+37)  [ctr_x, ctr_y+47] */
  value: { dx: 1, dy: 37 },
} as const;

/** Text offsets for recent drops, from draw_recent_drops. */
export const RECENT_TEXT = {
  /** player name: (x+6, y-10) */
  player: { dx: 6, dy: -10 },
  /** time-since: (x, y+35) */
  time: { dx: 0, dy: 35 },
} as const;

/** Leaderboard anchors (draw_leaderboard): text is horizontally centered on each x. */
export const LEADERBOARD = {
  nameX: 141,
  rankX: 37, // nameX - 104
  gpX: 247, // nameX + 106
  startY: 228,
  step: 22,
  rows: 12,
} as const;

/** Header baseline (draw_headers): centered on the canvas width, top y=20. */
export const HEADER = { y: 20, centerX: CANVAS.width / 2 } as const;

/** Font sizes (px in native space) — same ImageFont sizes the generator uses. */
export const FONT = {
  header: 26,
  leaderboard: 15,
  itemQty: 18,
  itemValue: 16,
  recent: 18,
} as const;

/** Non-dynamic default text colour (OSRS yellow) — generator's `yellow`. */
export const YELLOW = "rgb(255, 255, 0)";

/**
 * Value → colour, ported verbatim from utils.dynamic_handling.get_value_color.
 *   ≥1e9 blue · ≥1e7 green · ≥1e5 white · >0 yellow · else red
 */
export function valueColor(n: number): string {
  if (n >= 1_000_000_000) return "rgb(102, 152, 255)"; // billions blue
  if (n >= 10_000_000) return "rgb(0, 255, 128)"; // millions green
  if (n >= 100_000) return "rgb(255, 255, 255)"; // 100k white
  if (n > 0) return "rgb(255, 255, 0)"; // standard yellow
  return "rgb(255, 0, 0)"; // no value red
}

/**
 * "(Xd Yh)" / "(Xh Ym)" / "(Xm)" — ported from draw_recent_drops. Accepts the
 * "YYYY-MM-DD HH:MM:SS" (or ISO) strings stored in Redis recent_items.
 */
export function timeSince(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const iso = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const totalMin = Math.floor(diff / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `(${days}d ${hours}h)`;
  if (hours > 0) return `(${hours}h ${minutes}m)`;
  return `(${minutes}m)`;
}

/**
 * Black outline around glyphs, approximating PIL's stroke_width=1 stroke_fill=black.
 * A 4-way text-shadow hugs the glyph edge better than -webkit-text-stroke.
 */
export const TEXT_STROKE =
  "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 2px #000";
