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
}: {
  itemId: number | null | undefined;
  /** Width/height in CSS pixels. */
  size?: number;
  className?: string;
}) {
  if (itemId == null) return null;
  return (
    <img
      src={`${IMG_BASE}/itemdb/${itemId}.png`}
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
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}
