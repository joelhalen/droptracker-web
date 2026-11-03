/**
 * Clan leader feedback (backend `web_api/routes/feedback.py`, migration
 * web155a).
 *
 * Staff ask chosen people for feedback at /admin/feedback, using the same
 * audience rules as pop-up notices. A matching visitor sees a small feedback
 * card; anyone signed in can also answer at /feedback. Answers are posted to
 * the staff Discord, where staff can publish a quote to the testimonials
 * channel. The limits below mirror the backend.
 */
import { z } from "zod";
import { NoticeLabelsSchema, NoticeRuleSchema } from "./popup-notices";

export const FEEDBACK_RATING_MIN = 1;
export const FEEDBACK_RATING_MAX = 10;
export const FEEDBACK_TEXT_MAX = 500;
export const FEEDBACK_TITLE_MAX = 120;

export const FEEDBACK_ATTRIBUTIONS = ["clan", "full", "anon"] as const;
export type FeedbackAttribution = (typeof FEEDBACK_ATTRIBUTIONS)[number];

// --- Visitor -------------------------------------------------------------

/** A clan the visitor owns or admins, as the card offers it. */
export const FeedbackGroupSchema = z.object({
  group_id: z.number().int(),
  name: z.string(),
  role: z.enum(["owner", "admin"]),
  tier: z.string(),
  tier_name: z.string(),
  member_count: z.number().int(),
  since: z.number().int().nullable(),
});
export type FeedbackGroup = z.infer<typeof FeedbackGroupSchema>;

export const FeedbackPromptSchema = z.object({
  prompt: z.object({ request_id: z.number().int() }).nullable(),
  groups: FeedbackGroupSchema.array(),
});
export type FeedbackPrompt = z.infer<typeof FeedbackPromptSchema>;

export const FeedbackGroupsSchema = z.object({ groups: FeedbackGroupSchema.array() });

export const FeedbackAnswerSchema = z.object({
  request_id: z.number().int().nullable(),
  group_id: z.number().int().nullable(),
  rating: z.number().int().min(FEEDBACK_RATING_MIN).max(FEEDBACK_RATING_MAX),
  liked_text: z.string().trim().max(FEEDBACK_TEXT_MAX),
  improve_text: z.string().trim().max(FEEDBACK_TEXT_MAX),
  quote_consent: z.boolean(),
  attribution: z.enum(FEEDBACK_ATTRIBUTIONS),
  contact_ok: z.boolean(),
});
export type FeedbackAnswer = z.infer<typeof FeedbackAnswerSchema>;

// --- Admin ---------------------------------------------------------------

export const FEEDBACK_REQUEST_STATUSES = ["draft", "live", "ended"] as const;
export const FEEDBACK_RESPONSE_STATUSES = ["new", "publishing", "published", "dismissed"] as const;

export const AdminFeedbackRequestSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  audience: NoticeRuleSchema.array(),
  audience_summary: z.string(),
  status: z.enum(FEEDBACK_REQUEST_STATUSES),
  audience_estimate: z.number().int().nullable(),
  sent_at: z.number().int().nullable(),
  ended_at: z.number().int().nullable(),
  created_at: z.number().int().nullable(),
  seen_count: z.number().int(),
  answered_count: z.number().int(),
  snoozed_count: z.number().int(),
  declined_count: z.number().int(),
  average_rating: z.number().nullable().default(null),
  labels: NoticeLabelsSchema.optional(),
});
export type AdminFeedbackRequest = z.infer<typeof AdminFeedbackRequestSchema>;

export const AdminFeedbackResponseSchema = z.object({
  id: z.number().int(),
  request_id: z.number().int().nullable(),
  request_title: z.string().nullable(),
  user_id: z.number().int(),
  username: z.string(),
  group_id: z.number().int().nullable(),
  group_name: z.string().nullable(),
  role: z.string().nullable(),
  group_tier: z.string().nullable(),
  member_count: z.number().int().nullable(),
  rating: z.number().int(),
  liked_text: z.string().nullable(),
  improve_text: z.string().nullable(),
  quote_consent: z.boolean(),
  attribution: z.enum(FEEDBACK_ATTRIBUTIONS),
  contact_ok: z.boolean(),
  status: z.enum(FEEDBACK_RESPONSE_STATUSES),
  posted: z.boolean(),
  published_at: z.number().int().nullable(),
  created_at: z.number().int().nullable(),
});
export type AdminFeedbackResponse = z.infer<typeof AdminFeedbackResponseSchema>;

export const AdminFeedbackOverviewSchema = z.object({
  requests: AdminFeedbackRequestSchema.array(),
  responses: AdminFeedbackResponseSchema.array(),
  labels: NoticeLabelsSchema,
});
export type AdminFeedbackOverview = z.infer<typeof AdminFeedbackOverviewSchema>;

export const FeedbackRequestInputSchema = z.object({
  title: z.string().trim().min(1).max(FEEDBACK_TITLE_MAX),
  audience: NoticeRuleSchema.array().min(1).max(10),
});
export type FeedbackRequestInput = z.infer<typeof FeedbackRequestInputSchema>;
