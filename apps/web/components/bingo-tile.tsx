"use client";

/**
 * Rich bingo tile art — the resurrected task-tile system.
 *
 * The old site rendered these as server-side PNGs (`/api/task_tile`, PIL);
 * the backend now ships the same ingredients as data (`task.tile`: resolved
 * item/npc/skill icon refs + a legacy-style badge + value string) and this
 * component composes the tile from the `/img` icon assets in the browser —
 * theme-aware, animatable, and cheap to update live.
 */
import type { EventTask, TaskTile, TaskTileIcon } from "@droptracker/api-types";

// Relative so tile art stays same-origin wherever the board renders — www and
// the Discord Activity host (activity.droptracker.io) both map /img/ in nginx;
// an absolute www URL would be blocked by the activity iframe's CSP.
const IMG_BASE = "/img";

// Item 27414 is a stopwatch — used as the time-based-task marker overlaid on
// personal-best (`pb_target`) tiles, on top of the boss icon.
const STOPWATCH_ICON_URL = `${IMG_BASE}/itemdb/27414.png`;

/** Corner stopwatch badge marking a tile as a time-based (personal-best) task.
 * Sized as a share of the tile so it scales in both the web board and the
 * fixed-width Discord board PNG. */
function StopwatchOverlay() {
  return (
    <img
      src={STOPWATCH_ICON_URL}
      alt="Timed task"
      title="Time-based task — beat the personal best"
      aria-label="Time-based task — beat the personal best"
      loading="lazy"
      className="pointer-events-none absolute top-0.5 right-0.5 z-10 w-[24%] object-contain drop-shadow-[1px_1px_1px_rgba(0,0,0,0.8)]"
    />
  );
}

/** Icon → image URL; null when unresolvable (unknown item/npc id). */
export function tileIconUrl(icon: TaskTileIcon): string | null {
  if (icon.type === "skill") {
    // Metrics icons are keyed by lowercase WOM-style names (slayer, ehp, …).
    return `${IMG_BASE}/metrics/${icon.name.toLowerCase().replace(/ /g, "_")}.png`;
  }
  if (icon.id == null) return null;
  return `${IMG_BASE}/${icon.type === "item" ? "itemdb" : "npcdb"}/${icon.id}.png`;
}

/** Icons the tile art can actually draw (skill icons always qualify). */
export function drawableIcons(tile: TaskTile | null | undefined): TaskTileIcon[] {
  return (tile?.icons ?? []).filter((icon) => tileIconUrl(icon) != null);
}

/** Cap the collage so tiles stay readable; the rest becomes a "+N" chip. */
const MAX_DRAWN = 8;

function TileIcon({ icon, sizePct }: { icon: TaskTileIcon; sizePct: number }) {
  const url = tileIconUrl(icon)!;
  return (
    <span
      className="relative flex items-center justify-center"
      style={{ width: `${sizePct}%` }}
      title={icon.name}
    >
      <img
        src={url}
        alt={icon.name}
        loading="lazy"
        className="max-h-full w-full object-contain drop-shadow-[1px_1px_1px_rgba(0,0,0,0.7)]"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
        }}
      />
      {icon.quantity != null && icon.quantity > 1 && (
        <span
          className="absolute -right-0.5 -bottom-0.5 text-[9px] leading-none font-bold text-[#ffff00]"
          style={{ textShadow: "1px 1px 0 #000" }}
        >
          ×{icon.quantity.toLocaleString()}
        </span>
      )}
    </span>
  );
}

/**
 * One cell's visual content. Renders (in priority order): the icon collage +
 * badge/value from `task.tile`, a "FREE" star cell, or the text label as a
 * fallback for custom/unresolved tasks. Completion styling (border/tint/dots)
 * stays with the board — this is just the art.
 */
export function BingoTile({
  label,
  task,
  free = false,
}: {
  /** Cell label (fallback text when there is no drawable tile art). */
  label: string;
  task?: EventTask;
  /** Free cell — no bound task, completed from the start. */
  free?: boolean;
}) {
  if (free) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-0.5">
        <span aria-hidden className="text-osrs-gold/90 text-xl leading-none">
          ★
        </span>
        <span className="text-osrs-parchment-dark/60 text-[9px] font-semibold tracking-widest uppercase">
          Free
        </span>
      </div>
    );
  }

  // Personal-best tasks are time-based — mark them with a stopwatch overlay
  // in addition to the boss icon the tile already draws.
  const timed = task?.type === "pb_target";

  const tile = task?.tile;
  const icons = drawableIcons(tile);
  if (!icons.length) {
    // Custom / unresolved tasks keep the old text tile.
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center p-1">
        {timed && <StopwatchOverlay />}
        <span className="line-clamp-3 text-center text-[11px] leading-tight">{label}</span>
        {tile?.badge && <TileBadge badge={tile.badge} />}
      </div>
    );
  }

  const drawn = icons.slice(0, MAX_DRAWN);
  const extra = icons.length - drawn.length + (tile?.icon_overflow ?? 0);
  // Icon width by collage density: one big hero icon down to a 3-wide grid.
  const sizePct = drawn.length === 1 ? 52 : drawn.length === 2 ? 38 : drawn.length <= 4 ? 34 : 26;

  return (
    <div className="relative flex h-full w-full flex-col items-stretch p-1">
      {timed && <StopwatchOverlay />}
      <div className="flex min-h-0 flex-1 flex-wrap content-center items-center justify-center gap-0.5">
        {drawn.map((icon, i) => (
          <TileIcon key={`${icon.type}:${icon.id ?? icon.name}:${i}`} icon={icon} sizePct={sizePct} />
        ))}
        {extra > 0 && (
          <span className="text-osrs-parchment-dark/70 text-[10px] font-semibold">+{extra}</span>
        )}
      </div>
      {tile?.value && (
        <span
          className="text-osrs-gold-bright pointer-events-none text-center text-[10px] leading-tight font-bold"
          style={{ textShadow: "1px 1px 0 #000" }}
        >
          {tile.value}
        </span>
      )}
      {tile?.badge && <TileBadge badge={tile.badge} />}
    </div>
  );
}

function TileBadge({ badge }: { badge: string }) {
  return (
    <span className="bg-osrs-bronze/25 text-osrs-parchment-dark/80 mt-0.5 -mb-0.5 truncate rounded-sm px-1 py-px text-center text-[8px] font-semibold tracking-wider uppercase">
      {badge}
    </span>
  );
}
