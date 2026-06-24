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

export function formatDate(unixSeconds: number | null): string {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
