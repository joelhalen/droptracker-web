/**
 * Members' own messages (backend `db/member_messages.py`): death, collection
 * log, drop and personal best lines.
 *
 * A member writes up to five lines per account and type; one is picked each
 * time in every group that turned that type on (`allow_member_<type>_messages`),
 * and a leader can block individual members (a block covers every type). The backend is the authority on what may be saved —
 * these limits and the validator below mirror it so the editor can explain a
 * problem before the save instead of after it. Keep the two in step: the same
 * cases are pinned by `apps/web/test/member-messages.test.ts` here and
 * `tests/unit/test_member_messages.py` there.
 */
import { z } from "zod";

export const MEMBER_MESSAGE_MAX_MESSAGES = 5;
export const MEMBER_MESSAGE_MAX_LENGTH = 150;

/** Placeholders a member's death message may use, in display order. The API
 * sends the same list (with samples); this copy lets validation run offline. */
export const MEMBER_DEATH_TOKENS = [
  "{player_name}",
  "{killer}",
  "{location}",
  "{value_lost}",
  "{value_kept}",
  "{killer_combat_level}",
] as const;

/** Also accepted, so a line copied from a group's own death messages works. */
export const MEMBER_DEATH_TOKEN_ALIASES: Record<string, string> = {
  "{source}": "{killer}",
  "{region_name}": "{location}",
};

/** Message types, in the order editors list them. Mirrors `MESSAGE_TYPES`. */
export const MEMBER_MESSAGE_TYPES = ["death", "clog", "drop", "pb"] as const;
export type MemberMessageType = (typeof MEMBER_MESSAGE_TYPES)[number];

/** What each type is called in a sentence ("your drop message"). */
export const MEMBER_MESSAGE_NOUNS: Record<MemberMessageType, string> = {
  death: "death",
  clog: "collection log",
  drop: "drop",
  pb: "personal best",
};

/** Placeholders per type, in display order (backend `MessageKind.tokens`). */
export const MEMBER_MESSAGE_TOKENS: Record<MemberMessageType, readonly string[]> = {
  death: MEMBER_DEATH_TOKENS,
  clog: ["{player_name}", "{item_name}", "{source}", "{kill_count}", "{slots_unlocked}", "{slots_total}"],
  drop: ["{player_name}", "{item_name}", "{source}", "{value}", "{quantity}", "{kill_count}"],
  pb: ["{player_name}", "{boss}", "{time}", "{team_size}", "{kill_count}"],
};

/** Also accepted per type (backend `MessageKind.aliases`). */
export const MEMBER_MESSAGE_TOKEN_ALIASES: Record<MemberMessageType, Record<string, string>> = {
  death: MEMBER_DEATH_TOKEN_ALIASES,
  clog: { "{npc_name}": "{source}", "{kc_received}": "{kill_count}" },
  drop: { "{npc_name}": "{source}" },
  pb: { "{npc_name}": "{boss}", "{personal_best}": "{time}" },
};

function allowedTokens(type: MemberMessageType): Set<string> {
  return new Set<string>([
    ...MEMBER_MESSAGE_TOKENS[type],
    ...Object.keys(MEMBER_MESSAGE_TOKEN_ALIASES[type]),
  ]);
}

const TOKEN_RE = /\{[a-z0-9_]+\}/gi;
const DISCORD_ENTITY_RE =
  /@everyone|@here|<@[&!]?\d+>|<#\d+>|<a?:\w+:\d+>|<\/[^<>:\n]+:\d+>|<t:-?\d+(?::[a-z])?>/i;
const LINK_RE =
  /https?:\/\/\S*|www\.\S*|\bdiscord(?:app)?\.(?:gg|com\/invite)\S*|\b[a-z0-9][a-z0-9-]*\.(?:com|net|org|gg|io|co|me|xyz|tv|ly|link|site|app|dev|info|ru|uk|us)\b\S*/i;
const BLOCK_MARKDOWN_RE = /^\s*(?:#{1,3}\s|-#\s|>>>|>\s)/;
// Control characters plus the Unicode line and paragraph separators.
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\x00-\x1f\x7f\u2028\u2029]/;

/** Characters as the backend counts them (code points, not UTF-16 units). */
function codePointLength(text: string): number {
  return [...text].length;
}

/** Why one trimmed message cannot be saved, or null. Same wording as the API. */
export function memberDeathMessageIssue(
  text: string,
  type: MemberMessageType = "death",
): string | null {
  if (codePointLength(text) > MEMBER_MESSAGE_MAX_LENGTH) {
    return `Each message can be at most ${MEMBER_MESSAGE_MAX_LENGTH} characters.`;
  }
  if (CONTROL_RE.test(text)) return "Each message has to be a single line of text.";
  if (DISCORD_ENTITY_RE.test(text)) {
    return "Messages can't mention people, roles or channels, or use custom emoji.";
  }
  if (LINK_RE.test(text)) return "Messages can't contain links.";
  if (BLOCK_MARKDOWN_RE.test(text)) return "Messages can't start with a heading or a quote.";
  const allowed = allowedTokens(type);
  const unknown = [
    ...new Set((text.match(TOKEN_RE) ?? []).filter((t) => !allowed.has(t.toLowerCase()))),
  ].sort();
  if (unknown.length > 0) {
    const plural = unknown.length > 1 ? "s" : "";
    return `Unknown placeholder${plural} ${unknown.join(", ")}. You can use ${MEMBER_MESSAGE_TOKENS[type].join(", ")}.`;
  }
  return null;
}

/** What the backend will store for this input: trimmed, blank rows and exact
 * duplicates dropped, placeholder names lowercased. */
export function normalizeMemberDeathMessages(messages: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of messages) {
    const text = raw.trim().replace(TOKEN_RE, (t) => t.toLowerCase());
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}

/** The first problem with a whole list, or null when it can be saved. */
export function memberDeathMessagesIssue(
  messages: readonly string[],
  type: MemberMessageType = "death",
): string | null {
  const cleaned = normalizeMemberDeathMessages(messages);
  for (const message of cleaned) {
    const issue = memberDeathMessageIssue(message, type);
    if (issue) return issue;
  }
  if (cleaned.length > MEMBER_MESSAGE_MAX_MESSAGES) {
    return `You can save at most ${MEMBER_MESSAGE_MAX_MESSAGES} messages.`;
  }
  return null;
}

export const MemberMessageTokenSchema = z.object({
  token: z.string(),
  help: z.string(),
  sample: z.string(),
});
export type MemberMessageToken = z.infer<typeof MemberMessageTokenSchema>;

/** One group an account belongs to, and whether its message is posted there. */
export const MemberDeathMessageGroupSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  /** The group turned on members' own death messages. */
  allowed: z.boolean(),
  /** The group's leaders blocked this member's own messages. */
  blocked: z.boolean(),
});
export type MemberDeathMessageGroup = z.infer<typeof MemberDeathMessageGroupSchema>;

export const MyDeathMessagesPlayerSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  messages: z.array(z.string()),
  updated_at: z.string().nullable(),
  groups: z.array(MemberDeathMessageGroupSchema),
});
export type MyDeathMessagesPlayer = z.infer<typeof MyDeathMessagesPlayerSchema>;

/** GET /me/member-messages?type= — and the echo of every save. */
export const MyDeathMessagesSchema = z.object({
  /** Absent from backends before message types (= death). */
  type: z.enum(MEMBER_MESSAGE_TYPES).optional(),
  example: z.string().optional(),
  max_messages: z.number().int(),
  max_length: z.number().int(),
  tokens: z.array(MemberMessageTokenSchema),
  players: z.array(MyDeathMessagesPlayerSchema),
});
export type MyDeathMessages = z.infer<typeof MyDeathMessagesSchema>;

/** A member of the group who wrote a death message, or whom the group blocked. */
export const GroupMemberDeathMessageSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  messages: z.array(z.string()),
  updated_at: z.string().nullable(),
  blocked: z.boolean(),
  blocked_at: z.string().nullable(),
});
export type GroupMemberDeathMessage = z.infer<typeof GroupMemberDeathMessageSchema>;

/** GET /groups/{id}/member-messages?type= — and the echo of block/unblock. */
export const GroupMemberDeathMessagesSchema = z.object({
  type: z.enum(MEMBER_MESSAGE_TYPES).optional(),
  /** `allow_member_<type>_messages` as currently saved. */
  enabled: z.boolean(),
  members: z.array(GroupMemberDeathMessageSchema),
});
export type GroupMemberDeathMessages = z.infer<typeof GroupMemberDeathMessagesSchema>;
