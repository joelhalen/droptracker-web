/**
 * Custom bot profile (web139a): the bot's nickname, bio, avatar and banner
 * inside a group's Discord server.
 * Backend: disc/web_api/routes/bot_profile.py, services/bot_profile.py.
 */
import { z } from "zod";

export const BOT_PROFILE_STATUSES = ["pending", "applied", "default", "error"] as const;
export type BotProfileStatus = (typeof BOT_PROFILE_STATUSES)[number];

export const BotProfileFieldsSchema = z.object({
  nick: z.string().nullable(),
  bio: z.string().nullable(),
  avatar_url: z.string().nullable(),
  banner_url: z.string().nullable(),
});
export type BotProfileFields = z.infer<typeof BotProfileFieldsSchema>;

export const BotProfileDefaultsSchema = z.object({
  name: z.string(),
  avatar_url: z.string().nullable(),
  banner_url: z.string().nullable(),
  bio: z.string().nullable(),
});
export type BotProfileDefaults = z.infer<typeof BotProfileDefaultsSchema>;

export const BotProfileSchema = BotProfileFieldsSchema.extend({
  entitled: z.boolean(),
  /** What the bot last applied in Discord. */
  applied: BotProfileFieldsSchema,
  status: z.enum(BOT_PROFILE_STATUSES).catch("default"),
  /** The core bot's own look, used wherever a field is unset. */
  defaults: BotProfileDefaultsSchema,
  last_error: z.string().nullable(),
  /** Epoch seconds. */
  applied_at: z.number().int().nullable(),
  updated_at: z.number().int().nullable(),
  limits: z.object({
    nick_max: z.number().int(),
    bio_max: z.number().int(),
    bio_max_lines: z.number().int(),
    avatar_size: z.tuple([z.number().int(), z.number().int()]),
    banner_size: z.tuple([z.number().int(), z.number().int()]),
    image_cooldown_seconds: z.number().int(),
  }),
});
export type BotProfile = z.infer<typeof BotProfileSchema>;

/** A full save. null means "use the bot's own"; image URLs come from the
 * upload endpoint, which only stages them. */
export const BotProfileInputSchema = z.object({
  nick: z.string().max(32).nullable().optional(),
  bio: z.string().max(190).nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  banner_url: z.string().nullable().optional(),
});
export type BotProfileInput = z.infer<typeof BotProfileInputSchema>;

export const BOT_PROFILE_IMAGE_KINDS = ["avatar", "banner"] as const;
export type BotProfileImageKind = (typeof BOT_PROFILE_IMAGE_KINDS)[number];

export const BotProfileHistoryEntrySchema = z.object({
  action: z.string(),
  actor_user_id: z.number().int().nullable(),
  /** JSON-encoded {field: value} maps. */
  before: z.string().nullable(),
  after: z.string().nullable(),
  /** Epoch seconds. */
  created_at: z.number().int().nullable(),
});
export type BotProfileHistoryEntry = z.infer<typeof BotProfileHistoryEntrySchema>;

export const AdminBotProfileSchema = BotProfileSchema.extend({
  group_id: z.number().int(),
  group_name: z.string().nullable(),
  guild_id: z.string().nullable(),
  updated_by_user_id: z.number().int().nullable(),
  updated_by_name: z.string().nullable(),
  history: z.array(BotProfileHistoryEntrySchema),
});
export type AdminBotProfile = z.infer<typeof AdminBotProfileSchema>;

export const AdminBotProfilesResponseSchema = z.object({
  profiles: z.array(AdminBotProfileSchema),
});
export type AdminBotProfilesResponse = z.infer<typeof AdminBotProfilesResponseSchema>;
