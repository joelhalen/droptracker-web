/**
 * App-facing barrel for UI primitives.
 *
 * The generic, brand-token-styled primitives (Button, Field/Input, Card, Alert,
 * Badge, EmptyState, StatTile, Skeleton, `cn`, …) now live in the shared
 * `@droptracker/ui` package and are re-exported here, so existing
 * `@/components/ui` imports keep working. This file additionally hosts the
 * DropTracker-specific display components that are coupled to app concerns
 * (tier flair, identicons, leaderboard medals, group roles).
 */
import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import type { TierFlairStyle } from "@droptracker/api-types";
import { resolveFlair } from "@/lib/tier-flair";
import { Badge, type BadgeSize, type BadgeVariant } from "@droptracker/ui";

export * from "@droptracker/ui";

/**
 * Shared text-input/select/textarea styling. Superseded by the `Input`/`Field`
 * primitives (`@droptracker/ui`) for new code; kept here (unchanged) for the
 * call sites that still compose the raw class string.
 */
export const fieldInputClass =
  "border-osrs-bronze/40 bg-osrs-surface-2 focus:border-osrs-gold focus:ring-osrs-gold/20 rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2";

/* -------------------------------------------------------------------------- */
/* Domain badges: group role / site staff / subscription tier + status.       */
/* -------------------------------------------------------------------------- */

/** Group role badge — owners gold, admins ember, members muted. */
export function RoleBadge({
  role,
  size,
  className = "",
}: {
  role: string;
  size?: BadgeSize;
  className?: string;
}) {
  const variant: BadgeVariant = role === "owner" ? "gold" : role === "admin" ? "ember" : "neutral";
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  return (
    <Badge variant={variant} size={size} className={className} title={`Group ${role}`}>
      {role === "owner" && <span aria-hidden>♔</span>}
      {role === "admin" && <span aria-hidden>⚙</span>}
      {label}
    </Badge>
  );
}

/** Site-staff badge for user listings. */
export function SuperadminBadge({ size, className = "" }: { size?: BadgeSize; className?: string }) {
  return (
    <Badge variant="red" size={size} className={className} title="Site administrator">
      <span aria-hidden>⚔</span>
      Superadmin
    </Badge>
  );
}

export function DeveloperBadge({ size, className = "" }: { size?: BadgeSize; className?: string }) {
  return (
    <Badge variant="sky" size={size} className={className} title="Site developer">
      <span aria-hidden>🛠</span>
      Developer
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
  size,
  className = "",
}: {
  tierKey: string | null;
  /** Display name; falls back to a prettified key. */
  name?: string;
  size?: BadgeSize;
  className?: string;
}) {
  const key = (tierKey ?? "free").toLowerCase();
  const isFree = key === "free" || tierKey == null;
  const isTop = /plus|max|ultimate|dragon/.test(key);
  const tone: BadgeVariant = isFree ? "neutral" : isTop ? "ember" : "gold";
  const label = name ?? key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Badge variant={tone} size={size} className={className} title={isFree ? "Free plan" : `${label} subscription`}>
      {!isFree && <span aria-hidden>★</span>}
      {label}
    </Badge>
  );
}

/** Subscription lifecycle status badge (active/trialing/past_due/…). */
export function SubscriptionStatusBadge({
  status,
  size,
  className = "",
}: {
  status: "none" | "active" | "trialing" | "past_due" | "canceled" | "expired";
  size?: BadgeSize;
  className?: string;
}) {
  const tone: BadgeVariant =
    status === "active" || status === "trialing"
      ? "green"
      : status === "past_due"
        ? "red"
        : status === "none"
          ? "neutral"
          : "red";
  return (
    <Badge variant={tone} size={size} className={className}>
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
 * A player's character avatar: a torso-up crop of the 3D model they uploaded
 * from the RuneLite plugin.
 *
 * Relative `/img`, deliberately. Every host that renders this proxies `/img/`
 * to the same image server — www, the Activity's `discordsays.com` iframe, and
 * group sites on their own subdomains — so one relative path is correct on all
 * three. (`<img>` is not subject to CORS, which is why this needs no BFF proxy
 * of the kind `/api/models` gives the `fetch`-based 3D renderer.)
 *
 * `avatar.png` is a stable per-player alias rather than a fingerprinted name:
 * the image server resolves it to whichever outfit is current. That keeps the
 * URL derivable from a player id alone, which is what lets every listing use
 * this without threading a fingerprint through a dozen API payloads.
 */
export const playerAvatarUrl = (playerId: number): string =>
  `/img/models/${playerId}/avatar.png`;

/**
 * Identicon tile: colored square with the entity's initials, colored
 * deterministically from the name so the same player/group always gets the
 * same tile everywhere.
 *
 * When `playerId` is given, the player's character avatar is layered over the
 * initial — and the initial stays underneath as the fallback rather than being
 * swapped out. Most players have no model (2.6k of them do), so "no avatar" is
 * the ordinary case and has to be the resting state, not an error path.
 *
 * The fallback needs no JavaScript, which is what makes it safe to put in a
 * 100-row leaderboard: the image server answers a player with no model with a
 * transparent PNG, so the layer above simply shows nothing and the letter below
 * shows through. Note that relying on `onError` alone would NOT work here even
 * if this were a client component — the response body is a decodable image, so
 * chromium paints it and fires `load`, not `error`.
 */
export function NameTile({
  name,
  size = "md",
  className = "",
  flair,
  playerId,
}: {
  name: string;
  size?: keyof typeof TILE_SIZES;
  className?: string;
  /** Subscription tier flair — adds a colored border + glow to the tile. */
  flair?: TierFlairStyle;
  /** When set, overlays this player's character avatar on the initial. */
  playerId?: number;
}) {
  const hue = nameHue(name);
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const f = resolveFlair(flair);
  const withAvatar = playerId !== undefined && playerId >= 0;
  return (
    <span
      aria-hidden
      data-avatar-tile={withAvatar ? "" : undefined}
      className={`relative flex shrink-0 select-none items-center justify-center overflow-hidden font-bold text-white/90 shadow-sm ${TILE_SIZES[size]} ${className}`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 45% 42%), hsl(${(hue + 40) % 360} 50% 30%))`,
        border: `1px solid hsl(${hue} 45% 55% / 0.5)`,
        // Flair (when present) overrides the border and adds the glow.
        ...f?.tileStyle,
      }}
    >
      {/* Classed so the stylesheet can hide it behind a loaded model — with no
          fill left underneath, the letter would otherwise show through the
          transparent parts of the character. */}
      <span className="dt-avatar-initial">{initial}</span>
      {withAvatar && (
        // A raw <img>, not next/image, on purpose: the optimizer would turn a
        // 404 into a build-time error rather than the transparent PNG this
        // fallback depends on, and it would route every row of a leaderboard
        // through it for an image most players do not have.
        //
        // object-contain, and the source is square by construction, so the
        // figure is neither cropped nor letterboxed nor nudged off-centre at
        // any of the sizes this renders at — the centring is done once, in the
        // crop, rather than compensated for per surface in CSS.
        <img
          data-avatar=""
          src={playerAvatarUrl(playerId)}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-contain"
        />
      )}
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
  playerId,
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
  /**
   * Player id, when this chip is a player — shows their character avatar in
   * place of the initial. Omitted for groups, which have no character model.
   */
  playerId?: number;
}) {
  const f = resolveFlair(flair);
  return (
    <Link href={href as Route} className={`group flex min-w-0 items-center gap-2.5 ${className}`}>
      <NameTile
        name={name}
        size={size}
        className={tileClassName}
        flair={flair}
        playerId={playerId}
      />
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
      <span
        className={`text-osrs-parchment-dark/70 inline-block w-7 text-center tabular-nums ${className}`}
      >
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
