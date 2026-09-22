/**
 * Targeted site pop-up notices (backend `web_api/routes/popup_notices.py`,
 * migration web118a).
 *
 * Staff write a Markdown notice at /admin/notices and pick an audience; signed-
 * in visitors who match see it as a pop-up until they close it. The audience
 * is a list of rules and a visitor matches ANY of them. The backend owns both
 * validation and matching (`web_api/popup_audience.py`); the limits below
 * mirror it so the composer can explain a problem before the save.
 */
import { z } from "zod";

export const NOTICE_TONES = ["info", "important", "success"] as const;
export type NoticeTone = (typeof NOTICE_TONES)[number];

export const NOTICE_SIZES = ["sm", "md", "lg"] as const;
export type NoticeSize = (typeof NOTICE_SIZES)[number];

export const NOTICE_TITLE_MAX = 120;
export const NOTICE_BODY_MAX = 20_000;
export const NOTICE_CTA_LABEL_MAX = 40;
export const NOTICE_MAX_RULES = 10;

/** Pseudo tier key for groups whose live pool covers no paid tier. */
export const NOTICE_FREE_TIER = "free";

// --- Audience rules ------------------------------------------------------

export const NOTICE_LEADER_ROLES = ["owner", "admin"] as const;

export const NoticeRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("everyone") }),
  z.object({ type: z.literal("staff") }),
  z.object({ type: z.literal("users"), user_ids: z.array(z.number().int()) }),
  z.object({
    type: z.literal("group_leaders"),
    roles: z.array(z.enum(NOTICE_LEADER_ROLES)),
    group_ids: z.array(z.number().int()).default([]),
    group_tiers: z.array(z.string()).default([]),
  }),
  z.object({
    type: z.literal("group_members"),
    group_ids: z.array(z.number().int()).default([]),
    group_tiers: z.array(z.string()).default([]),
  }),
  z.object({ type: z.literal("supporters"), tier_keys: z.array(z.string()).default([]) }),
]);
export type NoticeRule = z.infer<typeof NoticeRuleSchema>;
export type NoticeRuleType = NoticeRule["type"];

// --- Visitor -------------------------------------------------------------

/** What a visitor's browser receives: content only, never the audience. */
export const PopupNoticeSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  body_md: z.string(),
  cta_label: z.string().nullable(),
  cta_url: z.string().nullable(),
  tone: z.enum(NOTICE_TONES),
  size: z.enum(NOTICE_SIZES),
  sent_at: z.number().int().nullable(),
});
export type PopupNotice = z.infer<typeof PopupNoticeSchema>;

export const MyNoticesSchema = z.object({ items: PopupNoticeSchema.array() });
export type MyNotices = z.infer<typeof MyNoticesSchema>;

// --- Admin ---------------------------------------------------------------

export const NOTICE_STATES = ["draft", "scheduled", "live", "expired", "ended"] as const;
export type NoticeState = (typeof NOTICE_STATES)[number];

/** Display names for the ids and tier keys an audience mentions (JSON object
 * keys, so ids arrive as strings). */
export const NoticeLabelsSchema = z.object({
  users: z.record(z.string()),
  groups: z.record(z.string()),
  tiers: z.record(z.string()),
});
export type NoticeLabels = z.infer<typeof NoticeLabelsSchema>;

export const AdminPopupNoticeSchema = PopupNoticeSchema.extend({
  audience: NoticeRuleSchema.array(),
  audience_summary: z.string(),
  status: z.enum(["draft", "live", "ended"]),
  state: z.enum(NOTICE_STATES),
  starts_at: z.number().int().nullable(),
  expires_at: z.number().int().nullable(),
  ended_at: z.number().int().nullable(),
  created_at: z.number().int().nullable(),
  updated_at: z.number().int().nullable(),
  audience_estimate: z.number().int().nullable(),
  seen_count: z.number().int(),
  dismissed_count: z.number().int(),
  labels: NoticeLabelsSchema.optional(),
});
export type AdminPopupNotice = z.infer<typeof AdminPopupNoticeSchema>;

export const NoticeReceiptSchema = z.object({
  user_id: z.number().int(),
  name: z.string(),
  seen_at: z.number().int().nullable(),
  dismissed_at: z.number().int().nullable(),
});
export type NoticeReceipt = z.infer<typeof NoticeReceiptSchema>;

export const AdminPopupNoticeDetailSchema = AdminPopupNoticeSchema.extend({
  receipts: NoticeReceiptSchema.array(),
});
export type AdminPopupNoticeDetail = z.infer<typeof AdminPopupNoticeDetailSchema>;

export const AdminPopupNoticeListSchema = z.object({
  items: AdminPopupNoticeSchema.array(),
  labels: NoticeLabelsSchema,
});
export type AdminPopupNoticeList = z.infer<typeof AdminPopupNoticeListSchema>;

/** What the composer submits. Times are unix seconds; null = "right away" /
 * "never ends". */
export const PopupNoticeInputSchema = z.object({
  title: z.string().trim().min(1).max(NOTICE_TITLE_MAX),
  body_md: z.string().trim().min(1).max(NOTICE_BODY_MAX),
  cta_label: z.string().trim().max(NOTICE_CTA_LABEL_MAX).nullable(),
  cta_url: z.string().trim().max(512).nullable(),
  tone: z.enum(NOTICE_TONES),
  size: z.enum(NOTICE_SIZES),
  audience: NoticeRuleSchema.array().min(1).max(NOTICE_MAX_RULES),
  starts_at: z.number().int().nullable(),
  expires_at: z.number().int().nullable(),
});
export type PopupNoticeInput = z.infer<typeof PopupNoticeInputSchema>;

export const NoticeAudiencePreviewSchema = z.object({
  count: z.number().int(),
  everyone: z.boolean(),
  sample: z.array(z.string()),
  notes: z.array(z.string()),
  summary: z.string(),
});
export type NoticeAudiencePreview = z.infer<typeof NoticeAudiencePreviewSchema>;

export const NoticeTierOptionSchema = z.object({
  key: z.string(),
  name: z.string(),
  scope: z.enum(["group", "user"]),
  paid: z.boolean(),
});
export type NoticeTierOption = z.infer<typeof NoticeTierOptionSchema>;

export const NoticeOptionsSchema = z.object({
  tiers: NoticeTierOptionSchema.array(),
  free_tier: z.string(),
});
export type NoticeOptions = z.infer<typeof NoticeOptionsSchema>;

export const NoticeLookupHitSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  detail: z.string(),
});
export type NoticeLookupHit = z.infer<typeof NoticeLookupHitSchema>;

export const NoticeLookupSchema = z.object({ items: NoticeLookupHitSchema.array() });

/** A button link the backend accepts: a site path or an http(s) URL. Kept in
 * step with `_validate_fields` so the composer flags it before saving. */
export function isAllowedNoticeLink(url: string): boolean {
  const u = url.trim();
  if (u.startsWith("/")) return !u.startsWith("//");
  return /^https?:\/\//i.test(u);
}
