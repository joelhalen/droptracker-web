"use client";

// Relative so the icon is same-origin on BOTH the website (www) and the Discord
// Activity host (activity.droptracker.io) — both map `/img/` in nginx. An
// absolute www URL would be blocked by the activity iframe's CSP (which is why
// bingo-tile also uses a relative base).
const IMG_BASE = "/img";

/** OSRS item icon from droptracker.io static assets (`/img/itemdb/{id}.png`). */
export function ItemDbIcon({
  itemId,
  size = 20,
  className = "",
  gray = false,
}: {
  itemId: number | null | undefined;
  /** Width/height in CSS pixels. */
  size?: number;
  className?: string;
  /** Load the pre-baked grayscale variant (`/img/itemdb/gray/{id}.png`) rather
   * than applying a client-side `filter: grayscale()`. The Loot Sweep board
   * renders hundreds of greyed "not yet received" receipt tabs, and the
   * per-element filter raster on every scroll reveal was the desktop scroll-jank
   * cost — a static desaturated PNG makes it a plain (cached) bitmap blit.
   * Falls back to the colour icon once if the variant isn't ready yet. */
  gray?: boolean;
}) {
  if (itemId == null) return null;
  const src = gray ? `${IMG_BASE}/itemdb/gray/${itemId}.png` : `${IMG_BASE}/itemdb/${itemId}.png`;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      // Boards render thousands of these (every receipt tab); defer decode +
      // off-screen loading so scrolling doesn't pay for icons that aren't
      // visible. width/height are set, so lazy loading causes no layout shift.
      loading="lazy"
      decoding="async"
      className={`inline-block shrink-0 object-contain ${className}`}
      onError={(e) => {
        const el = e.currentTarget as HTMLImageElement;
        // Grayscale variant not baked yet (backend still generating it): fall
        // back to the colour icon once so a receipt tab is never blank.
        if (gray && el.dataset.grayFellBack !== "1") {
          el.dataset.grayFellBack = "1";
          el.src = `${IMG_BASE}/itemdb/${itemId}.png`;
          return;
        }
        el.style.visibility = "hidden";
      }}
    />
  );
}
