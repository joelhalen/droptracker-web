/**
 * The chrome the collection log and combat achievement interfaces are drawn in.
 *
 * These pages previously used the site's generic stat tiles and card grid,
 * which is fine for analytics but wrong here: players know exactly what these
 * two interfaces look like, and anything else makes them read the page slowly.
 * The point of copying the layout — a titled window, a scrolling list of pages
 * on the left, item grid on the right, red/yellow/green completion colouring —
 * is that it needs no explanation.
 */
import type { ReactNode } from "react";

/** Completion colouring, matching the game: none, partial, complete. */
export function completionTone(completed: number, total: number): string {
  if (total > 0 && completed >= total) return "text-osrs-green";
  if (completed > 0) return "text-osrs-gold-bright";
  return "text-osrs-red";
}

export function OsrsWindow({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-osrs-bronze/60 bg-osrs-surface-1 overflow-hidden rounded-md border-2 shadow-lg ${className}`}
    >
      <div className="border-osrs-bronze/50 bg-osrs-surface-3 flex items-baseline justify-between gap-3 border-b px-3 py-2">
        <h2 className="font-osrs text-osrs-gold-bright text-lg leading-none tracking-wide">
          {title}
        </h2>
        {subtitle && (
          <span className="font-osrs text-osrs-parchment/90 text-sm leading-none">{subtitle}</span>
        )}
      </div>
      {children}
    </div>
  );
}

/** One entry in the left-hand page list. */
export function OsrsListRow({
  label,
  completed,
  total,
  selected = false,
  onSelect,
}: {
  label: string;
  completed: number;
  total: number;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const tone = completionTone(completed, total);
  const Element = onSelect ? "button" : "div";
  return (
    <Element
      {...(onSelect ? { type: "button" as const, onClick: onSelect } : {})}
      className={`font-osrs flex w-full items-baseline justify-between gap-2 px-2 py-1 text-left text-sm leading-tight transition-colors ${
        selected ? "bg-osrs-bronze/30" : "hover:bg-osrs-bronze/15"
      }`}
    >
      <span className={`truncate ${tone}`}>{label}</span>
      <span className={`shrink-0 tabular-nums ${tone}`}>
        {completed}/{total}
      </span>
    </Element>
  );
}

/**
 * An item slot. Unobtained items are dimmed rather than hidden — the empty
 * slots are the whole point of a collection log.
 *
 * `label` names the slot for assistive tech, which the icon cannot: it is
 * decorative (`alt=""`) because the name belongs to the slot, not the picture.
 * Pass `title` only where nothing richer is attached — a native tooltip and a
 * hover card fire on the same gesture and end up stacked on top of each other.
 */
export function OsrsItemSlot({
  children,
  obtained,
  label,
  title,
}: {
  children: ReactNode;
  obtained: boolean;
  label?: string;
  title?: string;
}) {
  return (
    <div
      title={title}
      className={`relative flex aspect-square items-center justify-center rounded-sm ${
        obtained ? "" : "opacity-25 grayscale"
      }`}
    >
      {label && <span className="sr-only">{label}</span>}
      {children}
    </div>
  );
}
