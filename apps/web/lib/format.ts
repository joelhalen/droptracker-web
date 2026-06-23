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

export function formatDate(unixSeconds: number | null): string {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
