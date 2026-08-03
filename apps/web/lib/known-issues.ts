/**
 * Service status + known-issues board — shared types and Zod schemas.
 *
 * Dependency-free (only `zod`) so it is safe to import from `lib/api.ts`,
 * server actions, and client components alike.
 *
 * See `web_api/routes/status.py` for the backend contract; the same data
 * drives the #status Discord channel cards rendered by the core bot.
 */
import { z } from "zod";

export const ISSUE_SEVERITIES = ["major", "degraded", "minor", "info"] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

export const ISSUE_STATUSES = ["open", "monitoring", "resolved"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const KnownIssueSchema = z.object({
  id: z.number().int(),
  category_id: z.number().int(),
  title: z.string(),
  description: z.string().nullable(),
  severity: z.enum(ISSUE_SEVERITIES),
  status: z.enum(ISSUE_STATUSES),
  order: z.number().int(),
  created_by: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
});
export type KnownIssue = z.infer<typeof KnownIssueSchema>;

export const KnownIssueCategorySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  emoji: z.string().nullable(),
  order: z.number().int(),
  issues: KnownIssueSchema.array(),
});
export type KnownIssueCategory = z.infer<typeof KnownIssueCategorySchema>;

/** Rolling processed-submission counters per window. */
export const StatusCountsSchema = z.object({
  "5m": z.number().int(),
  "30m": z.number().int(),
  "24h": z.number().int(),
});

export const StatusServicesSchema = z.object({
  generated_at: z.number().int(),
  api: z.object({
    status: z.string(),
    online: z.boolean(),
    players_1h: z.number().int(),
    processed: StatusCountsSchema,
    queue_depth: z.number().int().nullable(),
    consumer_alive: z.boolean(),
  }),
  webhook: z.object({
    status: z.string(),
    online: z.boolean(),
    players_1h: z.number().int(),
    processed: StatusCountsSchema,
  }),
});
export type StatusServices = z.infer<typeof StatusServicesSchema>;

/** `GET /api/v1/status` — services snapshot + open issues. */
export const StatusSummarySchema = z.object({
  services: StatusServicesSchema,
  categories: KnownIssueCategorySchema.array(),
});
export type StatusSummary = z.infer<typeof StatusSummarySchema>;

/** What the admin forms submit. */
export const KnownIssueCategoryInputSchema = z.object({
  name: z.string().min(1).max(100),
  emoji: z.string().max(32).nullable().default(null),
  order: z.number().int().default(100),
});
export type KnownIssueCategoryInput = z.infer<typeof KnownIssueCategoryInputSchema>;

export const KnownIssueInputSchema = z.object({
  category_id: z.number().int(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().default(null),
  severity: z.enum(ISSUE_SEVERITIES).default("minor"),
  status: z.enum(ISSUE_STATUSES).default("open"),
  order: z.number().int().default(100),
});
export type KnownIssueInput = z.infer<typeof KnownIssueInputSchema>;

export const SEVERITY_META: Record<IssueSeverity, { label: string; dot: string }> = {
  major: { label: "Major", dot: "bg-red-500" },
  degraded: { label: "Degraded", dot: "bg-orange-400" },
  minor: { label: "Minor", dot: "bg-yellow-400" },
  info: { label: "Info", dot: "bg-sky-400" },
};

/** Zeroed snapshot for mock mode / fail-open rendering. */
export const EMPTY_STATUS_SUMMARY: StatusSummary = {
  services: {
    generated_at: 0,
    api: {
      status: "offline",
      online: false,
      players_1h: 0,
      processed: { "5m": 0, "30m": 0, "24h": 0 },
      queue_depth: null,
      consumer_alive: false,
    },
    webhook: {
      status: "offline",
      online: false,
      players_1h: 0,
      processed: { "5m": 0, "30m": 0, "24h": 0 },
    },
  },
  categories: [],
};
