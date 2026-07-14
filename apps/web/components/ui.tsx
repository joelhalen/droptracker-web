/**
 * Small, presentational UI primitives shared across pages: cards, empty
 * states, loading skeletons, inline alerts, badges, and rich entity chips.
 * Kept server-safe (no client hooks) so they render in both Server and
 * Client Components.
 */
import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import type { TierFlairStyle } from "@droptracker/api-types";
import { resolveFlair } from "@/lib/tier-flair";

/**
 * Standard resting-state panel (design system refresh). Wraps the `.card`
 * utility (globals.css) so call sites don't hand-roll
 * `border-osrs-bronze/20 rounded border p-4` — the pattern that had drifted
 * slightly differently across ~15 files before this existed.
 */
export function Card({
  children,
  className = "",
  padding = "p-5",
  id,
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
  id?: string;
}) {
  return (
    <div id={id} className={`card ${padding} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Shared text-input/select/textarea styling — the exact class string that had
 * independently drifted across ~14 files (each declaring its own local
 * `field`/`input` constant with the same intent but no guaranteed
 * consistency). Not a full sweep of all 14 yet; consolidated here so new and
 * touched call sites (starting with the group-config editor) stop drifting
 * further.
 */
export const fieldInputClass =
  "border-osrs-bronze/40 bg-osrs-surface-2 focus:border-osrs-gold focus:ring-osrs-gold/20 rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2";

/** A single stat tile — big number, small label. Used in stat-tile grids (hero, dashboards). */
export function StatTile({
  label,
  value,
  hint,
  className = "",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`bg-osrs-surface-2/70 rounded-lg px-4 py-3 ${className}`}>
      <div className="text-osrs-parchment-dark/60 text-xs tracking-wide uppercase">{label}</div>
      <div className="text-osrs-gold-bright mt-0.5 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="text-osrs-parchment-dark/50 mt-0.5 text-xs">{hint}</div>}
    </div>
  );
}

/** Friendly empty state for lists/sections that have no data yet. */
export function EmptyState({
  title,
  hint,
  icon = "◇",
  action,
  className = "",
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-osrs-bronze/20 text-osrs-parchment-dark/70 flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center text-sm ${className}`}
    >
      <span className="text-osrs-bronze text-2xl" aria-hidden>
        {icon}
      </span>
      <span className="text-osrs-parchment/90 font-medium">{title}</span>
      {hint && <span className="max-w-sm text-xs">{hint}</span>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** A single shimmer block. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-osrs-bronze/20 animate-pulse rounded ${className}`}
      aria-hidden
    />
  );
}

/** A stack of skeleton rows for list/table placeholders. */
export function SkeletonRows({ rows = 6, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badges (UI refresh): consistent status/role/tier chips across the site.    */
/* -------------------------------------------------------------------------- */

export type BadgeTone =
  | "gold"
  | "bronze"
  | "green"
  | "red"
  | "ember"
  | "neutral"
  | "purple"
  | "sky";

const BADGE_TONES: Record<BadgeTone, string> = {
  gold: "bg-osrs-gold/15 text-osrs-gold border-osrs-gold/40",
  bronze: "bg-osrs-bronze/20 text-osrs-parchment-dark border-osrs-bronze/50",
  green: "bg-osrs-green/15 text-osrs-green border-osrs-green/40",
  red: "bg-osrs-red/15 text-osrs-red border-osrs-red/40",
  ember: "bg-osrs-ember/15 text-osrs-ember border-osrs-ember/40",
  neutral: "bg-osrs-stone/15 text-osrs-parchment-dark/80 border-osrs-stone/40",
  purple: "bg-purple-400/15 text-purple-400 border-purple-400/40",
  sky: "bg-sky-400/15 text-sky-400 border-sky-400/40",
};

/** Small pill badge. Compose the domain-specific variants below where possible. */
export function Badge({
  children,
  tone = "neutral",
  className = "",
  title,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Group role badge — owners gold, admins ember, members muted. */
export function RoleBadge({ role, className = "" }: { role: string; className?: string }) {
  const tone: BadgeTone = role === "owner" ? "gold" : role === "admin" ? "ember" : "neutral";
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  return (
    <Badge tone={tone} className={className} title={`Group ${role}`}>
      {role === "owner" && <span aria-hidden>♔</span>}
      {role === "admin" && <span aria-hidden>⚙</span>}
      {label}
    </Badge>
  );
}

/** Site-staff badge for user listings. */
export function SuperadminBadge({ className = "" }: { className?: string }) {
  return (
    <Badge tone="red" className={className} title="Site administrator">
      <span aria-hidden>⚔</span>
      Superadmin
    </Badge>
  );
}

export function ModeratorBadge({ className = "" }: { className?: string }) {
  return (
    <Badge tone="sky" className={className} title="Site moderator">
      <span aria-hidden>🛡</span>
      Moderator
    </Badge>
  );
}

/**
 * Subscription tier badge. Tone scales with the tier: free/none muted,
 * premium gold, top tiers ember — so paid groups stand out at a glance.
 */
export function TierBadge({
  tierKey,
  name,
  className = "",
}: {
  tierKey: string | null;
  /** Display name; falls back to a prettified key. */
  name?: string;
  className?: string;
}) {
  const key = (tierKey ?? "free").toLowerCase();
  const isFree = key === "free" || tierKey == null;
  const isTop = /plus|max|ultimate|dragon/.test(key);
  const tone: BadgeTone = isFree ? "neutral" : isTop ? "ember" : "gold";
  const label = name ?? key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Badge tone={tone} className={className} title={isFree ? "Free plan" : `${label} subscription`}>
      {!isFree && <span aria-hidden>★</span>}
      {label}
    </Badge>
  );
}

/** Subscription lifecycle status badge (active/trialing/past_due/…). */
export function SubscriptionStatusBadge({
  status,
  className = "",
}: {
  status: "none" | "active" | "trialing" | "past_due" | "canceled" | "expired";
  className?: string;
}) {
  const tone: BadgeTone =
    status === "active" || status === "trialing"
      ? "green"
      : status === "past_due"
        ? "red"
        : status === "none"
          ? "neutral"
          : "red";
  return (
    <Badge tone={tone} className={className}>
      {status.replace("_", " ")}
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/* Rich entity display (UI refresh): identicon tile + name + context line.    */
/* -------------------------------------------------------------------------- */

/** Deterministic hue for a name — stable per player/group across the site. */
function nameHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

const TILE_SIZES = {
  sm: "size-6 rounded-md text-[10px]",
  md: "size-8 rounded-lg text-xs",
  lg: "size-14 rounded-xl text-xl",
} as const;

/**
 * Identicon tile: colored square with the entity's initials, colored
 * deterministically from the name so the same player/group always gets the
 * same tile everywhere. Stand-in until real avatars exist in the API.
 */
export function NameTile({
  name,
  size = "md",
  className = "",
  flair,
}: {
  name: string;
  size?: keyof typeof TILE_SIZES;
  className?: string;
  /** Subscription tier flair — adds a colored border + glow to the tile. */
  flair?: TierFlairStyle;
}) {
  const hue = nameHue(name);
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const f = resolveFlair(flair);
  return (
    <span
      aria-hidden
      className={`flex shrink-0 select-none items-center justify-center font-bold text-white/90 shadow-sm ${TILE_SIZES[size]} ${className}`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 45% 42%), hsl(${(hue + 40) % 360} 50% 30%))`,
        border: `1px solid hsl(${hue} 45% 55% / 0.5)`,
        // Flair (when present) overrides the border and adds the glow.
        ...f?.tileStyle,
      }}
    >
      {initial}
    </span>
  );
}

/**
 * Rich entity row: identicon + linked name + muted context line (rank, loot,
 * member count…). The default display for players and groups in lists —
 * replaces bare name links so rows carry useful detail at a glance.
 */
export function EntityChip({
  href,
  name,
  subtitle,
  badges,
  size = "md",
  className = "",
  tileClassName = "",
  flair,
  flairTitle,
}: {
  href: Route | string;
  name: string;
  /** Secondary context line, e.g. "Rank #12 · 1.2B total". */
  subtitle?: ReactNode;
  /** Optional badges rendered inline after the name. */
  badges?: ReactNode;
  size?: keyof typeof TILE_SIZES;
  className?: string;
  /** Extra classes for the identicon tile (e.g. "max-sm:hidden" in dense rows). */
  tileClassName?: string;
  /** Subscription tier flair — colors/glows the name + tile (groups only). */
  flair?: TierFlairStyle;
  /** Tooltip for the flaired name, e.g. the tier's display name. */
  flairTitle?: string;
}) {
  const f = resolveFlair(flair);
  return (
    <Link href={href as Route} className={`group flex min-w-0 items-center gap-2.5 ${className}`}>
      <NameTile name={name} size={size} className={tileClassName} flair={flair} />
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1.5">
          {f && (
            <span aria-hidden className="shrink-0 text-xs" style={f.markerStyle} title={flairTitle}>
              {f.marker}
            </span>
          )}
          <span
            className={`truncate font-medium transition-colors ${
              f ? f.nameClassName : "group-hover:text-osrs-gold-bright"
            }`}
            style={f?.nameStyle}
            title={flairTitle}
          >
            {name}
          </span>
          {badges}
        </span>
        {subtitle && (
          <span className="text-osrs-parchment-dark/60 block truncate text-xs">{subtitle}</span>
        )}
      </span>
    </Link>
  );
}

/** Leaderboard position — medal discs for the podium, plain numbers below. */
export function RankMedal({ rank, className = "" }: { rank: number; className?: string }) {
  if (rank > 3) {
    return (
      <span className={`text-osrs-parchment-dark/70 inline-block w-7 text-center tabular-nums ${className}`}>
        {rank}
      </span>
    );
  }
  // Real medal metals on purpose — identical across themes.
  const medal = [
    "bg-[#f5c84c] text-[#4a3505] border-[#c79a1e]",
    "bg-[#cdd2da] text-[#333a45] border-[#9aa3b0]",
    "bg-[#d99a62] text-[#4d2c10] border-[#a86a35]",
  ][rank - 1];
  return (
    <span
      className={`inline-flex size-6 items-center justify-center rounded-full border text-xs font-bold shadow-sm ${medal} ${className}`}
      title={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}

/** Inline alert used to surface action errors/notices near the control. */
export function Alert({
  children,
  variant = "error",
  className = "",
}: {
  children: ReactNode;
  variant?: "error" | "info" | "success";
  className?: string;
}) {
  const styles = {
    error: "border-osrs-red/40 bg-osrs-red/10 text-osrs-red",
    info: "border-osrs-bronze/40 bg-osrs-brown-dark/40 text-osrs-parchment-dark/80",
    success: "border-osrs-green/40 bg-osrs-green/10 text-osrs-green",
  }[variant];
  return (
    <p role={variant === "error" ? "alert" : "status"} className={`rounded border px-3 py-2 text-sm ${styles} ${className}`}>
      {children}
    </p>
  );
}
