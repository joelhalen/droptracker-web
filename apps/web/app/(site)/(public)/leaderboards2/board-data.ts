/**
 * Types + shaping for the card-style leaderboard preview (/leaderboards2).
 *
 * The web API's board rows now carry card extras (icon, roster size, members
 * with loot this period, top earner; a player's clans). They are extended
 * here rather than in `@droptracker/api-types` while the design is a
 * preview: fold `CardEntrySchema` into `LeaderboardEntrySchema` when this
 * page replaces /leaderboards.
 */
import { z } from "zod";
import { LeaderboardEntrySchema, MoneySchema, PageMetaSchema } from "@droptracker/api-types";
import type { PeriodKey } from "@/lib/period";

export const CardEntrySchema = LeaderboardEntrySchema.extend({
  icon_url: z.string().optional(),
  description: z.string().optional(),
  member_count: z.number().int().optional(),
  active_count: z.number().int().optional(),
  top_player: z
    .object({ id: z.number().int(), name: z.string(), loot: MoneySchema })
    .optional(),
  groups: z.array(z.object({ id: z.number().int(), name: z.string() })).optional(),
});
export type CardEntry = z.infer<typeof CardEntrySchema>;

export const CardPageSchema = z.object({
  period: z.string(),
  scope: z.string(),
  entries: z.array(CardEntrySchema),
  meta: PageMetaSchema,
});
export type CardPage = z.infer<typeof CardPageSchema>;

export type BoardKind = "groups" | "players";

/** Divisible by 2 and 3, so the grid fills its rows at every breakpoint. */
export const PAGE_SIZE = 48;

/**
 * The bot's default avatar, which ~40% of clans still carry as their "icon".
 * It says nothing about the clan and weighs 672 KB, so the card falls back to
 * the name tile instead.
 */
const PLACEHOLDER_ICON = /\/img\/droptracker-small\.gif$/;

export function clanIcon(url: string | undefined): string | undefined {
  if (!url || PLACEHOLDER_ICON.test(url)) return undefined;
  return url;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "in September" / "this week" / "today" / "of all time". */
export function periodPhrase(key: PeriodKey, now = new Date()): string {
  switch (key) {
    case "week":
      return "this week";
    case "day":
      return "today";
    case "all":
      return "of all time";
    default:
      return `in ${MONTHS[now.getUTCMonth()]}`;
  }
}

/** Time left before the period's board starts over (UTC), e.g. "6d 4h". */
export function resetsIn(key: PeriodKey, now = new Date()): string | null {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  let end: number;
  switch (key) {
    case "month":
      end = Date.UTC(y, m + 1, 1);
      break;
    case "week": {
      // ISO weeks start on Monday, matching the backend's week tokens.
      const dow = now.getUTCDay() || 7;
      end = Date.UTC(y, m, d + (8 - dow));
      break;
    }
    case "day":
      end = Date.UTC(y, m, d + 1);
      break;
    default:
      return null;
  }
  const mins = Math.max(0, Math.floor((end - now.getTime()) / 60_000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${mins % 60}m`;
}

/** Value tier for colouring a GP figure, same thresholds as the homepage. */
export function gpTier(value: number): "1b" | "100m" | "10m" | "1m" | undefined {
  if (value >= 1_000_000_000) return "1b";
  if (value >= 100_000_000) return "100m";
  if (value >= 10_000_000) return "10m";
  if (value >= 1_000_000) return "1m";
  return undefined;
}
