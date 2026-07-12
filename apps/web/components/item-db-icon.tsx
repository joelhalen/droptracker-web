"use client";

const IMG_BASE = "https://www.droptracker.io/img";

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
      className={`inline-block shrink-0 object-contain ${className}`}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}
