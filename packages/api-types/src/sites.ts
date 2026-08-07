import { z } from "zod";

/**
 * Group mini-sites (sites-v1) — client-side mirror of the backend contracts
 * in `disc/web_api/sites_shared.py` + `routes/sites.py`. The meta endpoint
 * serves limits/reserved-words at runtime; only shapes live here.
 */

/** Block types the v1 renderer knows. Unknown types are skipped at render
 *  (forward compat), so page payloads carry loosely-typed blocks and each is
 *  narrowed individually with `SiteBlockSchema.safeParse`. */
export const SITE_BLOCK_TYPES = [
  "hero",
  "markdown",
  "stats_row",
  "top_players",
  "records",
  "boss_activity",
  "recent_drops",
  "lootboard",
  "pb_board",
  "leaderboard",
  "recap",
  "announcements",
  "live_ticker",
  "image",
  "buttons",
  "divider",
  "custom_html",
] as const;
export type SiteBlockType = (typeof SITE_BLOCK_TYPES)[number];

const blockBase = { id: z.string().min(1).max(32) };

export const SiteStatKeySchema = z.enum(["members", "monthly_loot", "rank", "top_player"]);

export const SiteBlockSchema = z.discriminatedUnion("type", [
  z.object({
    ...blockBase,
    type: z.literal("hero"),
    heading: z.string().max(80),
    tagline: z.string().max(200).optional(),
    image_url: z.string().max(300).optional(),
  }),
  z.object({ ...blockBase, type: z.literal("markdown"), body: z.string().max(8000) }),
  z.object({
    ...blockBase,
    type: z.literal("stats_row"),
    stats: z.array(SiteStatKeySchema).min(1).max(4).catch(["members", "monthly_loot", "rank"]),
  }),
  z.object({
    ...blockBase,
    type: z.literal("top_players"),
    period: z.enum(["month", "all"]).catch("month"),
    limit: z.number().int().min(3).max(25).catch(10),
  }),
  z.object({ ...blockBase, type: z.literal("records") }),
  z.object({
    ...blockBase,
    type: z.literal("boss_activity"),
    limit: z.number().int().min(3).max(12).catch(8),
  }),
  z.object({
    ...blockBase,
    type: z.literal("recent_drops"),
    limit: z.number().int().min(3).max(25).catch(10),
  }),
  z.object({ ...blockBase, type: z.literal("lootboard"), period: z.string().max(16).catch("month") }),
  z.object({ ...blockBase, type: z.literal("pb_board"), boss_id: z.number().int().optional() }),
  z.object({
    ...blockBase,
    type: z.literal("leaderboard"),
    limit: z.number().int().min(5).max(25).catch(10),
  }),
  z.object({ ...blockBase, type: z.literal("recap"), period: z.enum(["week", "month"]).catch("month") }),
  z.object({
    ...blockBase,
    type: z.literal("announcements"),
    limit: z.number().int().min(1).max(10).catch(3),
  }),
  z.object({ ...blockBase, type: z.literal("live_ticker") }),
  z.object({
    ...blockBase,
    type: z.literal("image"),
    url: z.string().max(300),
    alt: z.string().max(200).optional(),
    caption: z.string().max(300).optional(),
  }),
  z.object({
    ...blockBase,
    type: z.literal("buttons"),
    items: z
      .array(z.object({ label: z.string().min(1).max(40), href: z.string().max(300) }))
      .min(1)
      .max(6),
  }),
  z.object({
    ...blockBase,
    type: z.literal("divider"),
    size: z.enum(["sm", "md", "lg"]).catch("md"),
    rule: z.boolean().catch(true),
  }),
  z.object({
    ...blockBase,
    type: z.literal("custom_html"),
    /** Server-sanitized output — the ONLY field ever rendered. */
    html: z.string().max(64_000),
    /** Author's original source; editor round-trip only. */
    source: z.string().max(64_000).optional(),
  }),
]);
export type SiteBlock = z.infer<typeof SiteBlockSchema>;

export const SiteNavItemSchema = z.object({
  label: z.string().min(1).max(40),
  page_slug: z.string().max(40).optional(),
  href: z.string().max(300).optional(),
});
export type SiteNavItem = z.infer<typeof SiteNavItemSchema>;

/** `GET /sites/resolve?host={sub}` — the tenant layout's one fetch. */
export const SiteResolveSchema = z.object({
  status: z.enum(["ok", "suspended", "unavailable"]),
  subdomain: z.string(),
  group_id: z.number().int().optional(),
  group_name: z.string().optional(),
  icon_url: z.string().nullish(),
  theme_key: z.string().optional(),
  palette: z.record(z.string(), z.string()).optional(),
  nav: z.array(SiteNavItemSchema).optional(),
  custom_css: z.string().optional(),
  needs_review: z.boolean().optional(),
  pages: z
    .array(z.object({ slug: z.string(), title: z.string(), position: z.number().int() }))
    .optional(),
});
export type SiteResolve = z.infer<typeof SiteResolveSchema>;

/** `GET /sites/{sub}/pages/{slug}` — blocks stay loosely typed here; the
 *  renderer narrows each entry with SiteBlockSchema.safeParse and skips
 *  anything it does not recognize. */
export const SitePagePayloadSchema = z.object({
  slug: z.string(),
  title: z.string(),
  group_id: z.number().int(),
  blocks: z.array(z.record(z.string(), z.unknown())),
  schema_version: z.number().int(),
  preview: z.boolean().catch(false),
  published_at: z.string().nullable().optional(),
});
export type SitePagePayload = z.infer<typeof SitePagePayloadSchema>;

// --- builder (admin) shapes -------------------------------------------------

export const SitePageSummarySchema = z.object({
  page_id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  position: z.number().int(),
  published: z.boolean(),
  has_draft_changes: z.boolean(),
  updated_at: z.string().nullable(),
  published_at: z.string().nullable(),
});
export type SitePageSummary = z.infer<typeof SitePageSummarySchema>;

export const SitePageDetailSchema = SitePageSummarySchema.extend({
  draft_blocks: z.array(z.record(z.string(), z.unknown())),
});
export type SitePageDetail = z.infer<typeof SitePageDetailSchema>;

export const SiteAdminSchema = z.object({
  site_id: z.number().int(),
  group_id: z.number().int(),
  subdomain: z.string(),
  theme_key: z.string(),
  palette: z.record(z.string(), z.string()),
  nav: z.array(SiteNavItemSchema),
  custom_css_source: z.string(),
  published: z.boolean(),
  needs_review: z.boolean(),
  suspended: z.boolean(),
  suspend_reason: z.string().nullable(),
  site_url: z.string(),
  pages: z.array(SitePageSummarySchema),
});
export type SiteAdmin = z.infer<typeof SiteAdminSchema>;

export const SiteMetaSchema = z.object({
  block_types: z.array(z.string()),
  theme_keys: z.array(z.string()),
  palette_keys: z.array(z.string()),
  limits: z.object({
    max_pages: z.number().int(),
    max_blocks_per_page: z.number().int(),
    max_custom_html_blocks_per_page: z.number().int(),
    max_custom_html_bytes: z.number().int(),
    max_custom_css_bytes: z.number().int(),
    max_nav_items: z.number().int(),
  }),
  reserved_subdomains: z.array(z.string()),
  schema_version: z.number().int(),
  tos_version: z.string(),
  sites_domain: z.string().catch(""),
});
export type SiteMeta = z.infer<typeof SiteMetaSchema>;

/** Client-side mirror of the backend claim rules (server re-validates). */
export const SITE_SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{1,28})[a-z0-9]$/;
export const SITE_PAGE_SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/;
