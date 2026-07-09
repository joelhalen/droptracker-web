/**
 * Tier "flair" — the cosmetic display style a subscription tier grants to a
 * group wherever its name appears (leaderboards, group profile, search,
 * memberships). Distinct from `entitlements` (runtime access control): flair is
 * purely prestige.
 *
 * Superadmins pick a style per tier on `/admin/tiers`; the frontend maps the
 * style id to colors/glow/shimmer in `apps/web/lib/tier-flair.ts`. "none"
 * renders exactly like a free group. Ids are ordered least → most prestigious.
 * Python parity: `disc/web_api/tier_flair.py`.
 */
import { z } from "zod";

/** Stable style ids — referenced by the render helper and backend validation. */
export const TIER_FLAIR_IDS = ["none", "bronze", "gold", "amethyst", "dragon"] as const;
export type TierFlairStyle = (typeof TIER_FLAIR_IDS)[number];

export const DEFAULT_TIER_FLAIR: TierFlairStyle = "none";

/** Admin-facing catalogue (dropdown label + help text). */
export const TIER_FLAIR_STYLES: { id: TierFlairStyle; label: string; description: string }[] = [
  { id: "none", label: "None", description: "No flair — renders like a free group." },
  { id: "bronze", label: "Bronze", description: "Bronze name with a soft glow." },
  { id: "gold", label: "Gold", description: "Gold name with a warm glow." },
  { id: "amethyst", label: "Amethyst", description: "Purple name with a glow." },
  {
    id: "dragon",
    label: "Dragon",
    description: "Ember name, strong glow, and an animated shimmer (top tier).",
  },
];

/** Tier flair style; defaults to "none" for free/unconfigured tiers. */
export const TierFlairSchema = z.enum(TIER_FLAIR_IDS).default("none");

/**
 * Compact per-group flair descriptor attached to group listing rows so the UI
 * can render flair without a second fetch. Present only for groups with an
 * active/trialing subscription to a tier whose flair is not "none".
 */
export const GroupFlairSchema = z.object({
  /** Active tier key that granted this flair. */
  tier_key: z.string(),
  /** Tier display name — used for the hover/tooltip label. */
  tier_name: z.string(),
  /** Visual style to apply. */
  style: TierFlairSchema,
});
export type GroupFlair = z.infer<typeof GroupFlairSchema>;
