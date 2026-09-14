/**
 * Pure helpers for the member death message editor (/settings) and the group
 * leaders' review card. Validation itself lives in `@droptracker/api-types`
 * (mirroring the backend); this is presentation: previews, where a message
 * posts, and whether the editor holds unsaved changes.
 */
import {
  MEMBER_DEATH_TOKEN_ALIASES,
  normalizeMemberDeathMessages,
  type MemberDeathMessageGroup,
  type MemberMessageToken,
} from "@droptracker/api-types";

const TOKEN_RE = /\{[a-z0-9_]+\}/gi;

/**
 * A template filled with sample values, the way the bot fills it for a real
 * death: `{player_name}` becomes the account's own name, aliases read their
 * canonical token's sample, and a placeholder the member may not use is left
 * out rather than shown raw.
 */
export function previewDeathMessage(
  template: string,
  tokens: readonly MemberMessageToken[],
  playerName: string,
): string {
  const samples = new Map(tokens.map((t) => [t.token, t.sample]));
  samples.set("{player_name}", playerName);
  for (const [alias, canonical] of Object.entries(MEMBER_DEATH_TOKEN_ALIASES)) {
    const sample = samples.get(canonical);
    if (sample !== undefined) samples.set(alias, sample);
  }
  return template
    .replace(TOKEN_RE, (token) => samples.get(token.toLowerCase()) ?? "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export type GroupPostingState = "posting" | "off" | "blocked";

/** Whether an account's message is posted in one of its groups, and if not, why. */
export function groupPostingState(group: MemberDeathMessageGroup): GroupPostingState {
  if (group.blocked) return "blocked";
  return group.allowed ? "posting" : "off";
}

/** True when the editor's rows would save something different from what is stored. */
export function deathMessagesChanged(rows: readonly string[], saved: readonly string[]): boolean {
  const next = normalizeMemberDeathMessages(rows);
  return next.length !== saved.length || next.some((message, i) => message !== saved[i]);
}
