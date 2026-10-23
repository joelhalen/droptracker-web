/**
 * The /tools directory: tools and communities The DropTracker uses or points
 * players to. Listings live in the database (web146a) and are edited on the
 * page itself: staff manage everything, and a listing's maintainers can edit
 * its content. See `web_api/routes/community_listings.py`.
 *
 * Dependency-free (only `zod`) so server code and client components can both
 * import it. Visible copy follows the site style: short, plain, no em-dashes.
 */
import { z } from "zod";

/** Goal-based sections, in page order. Keep in step with
 * `web_api/community_listings.py` SECTIONS. */
export const TOOL_SECTIONS = [
  {
    id: "events",
    title: "Running an event",
    blurb: "Tools for planning and running clan events.",
  },
  {
    id: "progress",
    title: "Tracking progress",
    blurb: "See how you and your clan are doing over time.",
  },
  {
    id: "clans",
    title: "Finding a clan",
    blurb: "Places to find a clan, meet other players, or get involved.",
  },
  {
    id: "foundations",
    title: "What we build on",
    blurb: "Projects The DropTracker relies on every day.",
  },
] as const;

export type ToolSection = (typeof TOOL_SECTIONS)[number]["id"];
export const TOOL_SECTION_IDS = TOOL_SECTIONS.map((s) => s.id) as [ToolSection, ...ToolSection[]];

export const ToolLinkSchema = z.object({ label: z.string(), href: z.string() });
export type ToolLink = z.infer<typeof ToolLinkSchema>;

export const ToolMaintainerSchema = z.object({ user_id: z.number().int(), username: z.string() });
export type ToolMaintainer = z.infer<typeof ToolMaintainerSchema>;

export const ToolListingSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  section: z.enum(TOOL_SECTION_IDS),
  summary: z.string(),
  details: z.string().nullable(),
  fit_label: z.string().nullable(),
  fit_note: z.string().nullable(),
  tags: z.string().array(),
  links: ToolLinkSchema.array(),
  logo_url: z.string().nullable(),
  accent: z.string().nullable(),
  sort_order: z.number().int(),
  visible: z.boolean(),
  can_edit: z.boolean(),
  updated_at: z.string().nullable(),
  /** Only sent when the viewer can edit this listing. */
  maintainers: ToolMaintainerSchema.array().optional(),
});
export type ToolListing = z.infer<typeof ToolListingSchema>;

export const ToolDirectorySchema = z.object({
  listings: ToolListingSchema.array(),
  can_admin: z.boolean(),
});
export type ToolDirectory = z.infer<typeof ToolDirectorySchema>;

/** What the editor sends. Maintainers may only send the content fields. */
export type ToolListingInput = {
  name: string;
  summary: string;
  details: string | null;
  tags: string[];
  links: ToolLink[];
  logo_url: string | null;
  accent: string | null;
  // Staff only:
  slug?: string;
  section?: ToolSection;
  fit_label?: string | null;
  fit_note?: string | null;
  sort_order?: number;
  visible?: boolean;
};

export const MAINTAINER_FIELDS = [
  "name",
  "summary",
  "details",
  "tags",
  "links",
  "logo_url",
  "accent",
] as const;
