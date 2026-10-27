/**
 * Clan rank roles: in-game clan ranks (from WiseOldMan) mapped to roles in a
 * group's Discord server, kept in sync by the core bot.
 * Backend: disc/web_api/routes/rank_roles.py, services/rank_roles.py.
 */
import { z } from "zod";

export const RANK_ROLE_MODES = ["single", "cumulative"] as const;
export type RankRoleMode = (typeof RANK_ROLE_MODES)[number];

export const RankRoleEntrySchema = z.object({
  rank: z.string(),
  role_id: z.string().nullable(),
  /** Name used when the bot creates the role. */
  name: z.string(),
  /** Create a role for this rank (needs `create_roles`). */
  create: z.boolean().default(false),
  /** Set by the bot: DropTracker made this role, so it may delete it. */
  created: z.boolean().default(false),
  delete_when_empty: z.boolean().default(false),
});
export type RankRoleEntry = z.infer<typeof RankRoleEntrySchema>;

export const RankRoleConfigSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(RANK_ROLE_MODES),
  create_roles: z.boolean(),
  exempt_role_id: z.string().nullable(),
  /** Priority order, highest rank first. */
  ranks: z.array(RankRoleEntrySchema),
});
export type RankRoleConfig = z.infer<typeof RankRoleConfigSchema>;

export const RankRoleRankSchema = z.object({
  rank: z.string(),
  label: z.string(),
  icon_url: z.string().nullable(),
  members: z.number().int(),
  linked_members: z.number().int(),
});
export type RankRoleRank = z.infer<typeof RankRoleRankSchema>;

export const RankRoleDiscordRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number().int(),
  /** Why the role can't be synced (it carries server control), or null. */
  blocked: z.string().nullable(),
});
export type RankRoleDiscordRole = z.infer<typeof RankRoleDiscordRoleSchema>;

export const RANK_ROLE_STATES = [
  "ok",
  "problems",
  "held_back",
  "disabled",
  "no_guild",
  "conflict",
  "waiting_for_ranks",
  "missing_permission",
  "error",
] as const;

export const RankRoleProblemSchema = z.object({
  rank: z.string().nullable(),
  role_id: z.string().nullable(),
  reason: z.string(),
});

export const RankRoleStatusSchema = z.object({
  state: z.string(),
  at: z.number(),
  pass: z.string(),
  last_full_at: z.number().nullable().optional(),
  linked: z.number().default(0),
  unlinked: z.number().default(0),
  checked: z.number().default(0),
  added: z.number().default(0),
  removed: z.number().default(0),
  not_in_server: z.number().default(0),
  exempt: z.number().default(0),
  held_back: z.number().default(0),
  deferred: z.number().default(0),
  errors: z.number().default(0),
  created: z.array(z.string()).default([]),
  deleted: z.array(z.string()).default([]),
  problems: z.array(RankRoleProblemSchema).default([]),
  message: z.string().nullable().optional(),
});
export type RankRoleStatus = z.infer<typeof RankRoleStatusSchema>;

export const RankRolesSchema = z.object({
  group_id: z.number(),
  guild_linked: z.boolean(),
  wom_linked: z.boolean(),
  has_rank_data: z.boolean(),
  conflict: z.object({ group_id: z.number(), group_name: z.string().nullable() }).nullable(),
  config: RankRoleConfigSchema,
  ranks: z.array(RankRoleRankSchema),
  roles: z.array(RankRoleDiscordRoleSchema),
  roles_stale: z.boolean(),
  roster: z.object({ members: z.number(), linked: z.number() }),
  preview: z.object({
    by_rank: z.record(z.string(), z.number()),
    linked: z.number(),
    with_role: z.number(),
  }),
  status: RankRoleStatusSchema.nullable(),
  limits: z.object({
    max_ranks: z.number(),
    max_role_name: z.number(),
    delete_grace_days: z.number(),
  }),
});
export type RankRoles = z.infer<typeof RankRolesSchema>;
