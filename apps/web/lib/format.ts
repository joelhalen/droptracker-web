/** Client-safe display formatters. */
import type { SubscriptionTier } from "@droptracker/api-types";

export function formatPrice(tier: Pick<SubscriptionTier, "price_cents" | "currency" | "interval">): string {
  if (tier.price_cents === 0) return "Free";
  const amount = (tier.price_cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: tier.currency || "USD",
    minimumFractionDigits: tier.price_cents % 100 === 0 ? 0 : 2,
  });
  return `${amount}/${tier.interval === "year" ? "yr" : "mo"}`;
}

/**
 * Tailwind classes for a lootboard tile colored by GP value (FRONTEND_PLAN.md
 * §12 "use_gp_colors"). Higher value → rarer color.
 */
export function lootValueClass(value: number): string {
  if (value >= 1_000_000_000) return "border-osrs-gold/70 bg-osrs-gold/10";
  if (value >= 100_000_000) return "border-purple-400/60 bg-purple-400/10";
  if (value >= 10_000_000) return "border-sky-400/60 bg-sky-400/10";
  if (value >= 1_000_000) return "border-osrs-green/60 bg-osrs-green/10";
  return "border-osrs-bronze/30 bg-osrs-brown-dark/40";
}

/** Abbreviated GP formatting matching the backend's `format_number` exactly (K/M/B, 2dp). */
export function formatGp(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(2)}K`;
  return `${sign}${abs.toLocaleString()}`;
}

export function formatDate(unixSeconds: number | null): string {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** "3m ago" / "2h ago" style relative time, falling back to a date past ~2 days. */
export function formatRelativeTime(unixSeconds: number | null): string {
  if (!unixSeconds) return "—";
  const diffSec = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return `${Math.floor(diffSec / 86400)}d ago`;
  return formatDate(unixSeconds);
}
