/**
 * Group-data placeholders for mini-site text and custom HTML (sites-v1).
 *
 * Authors write `{group_name}` / `{member_count}` / `{monthly_loot}` … in a
 * Text or Custom HTML block and the tenant renderer substitutes the group's
 * live values, so a hand-designed page can carry real numbers without the
 * author hard-coding figures that immediately go stale.
 *
 * Substitution happens at RENDER time (the tenant page already has the group
 * profile), never at save time — so values track the group rather than
 * freezing into stored content.
 *
 * Token syntax deliberately matches the Discord embed placeholders
 * (`utils/format.py replace_placeholders`) so admins learn one convention.
 */
import type { GroupProfile } from "@droptracker/api-types";

export type SiteToken = { token: string; label: string; sample: string };

/** Catalog shown in the editor's token reference. */
export const SITE_TOKENS: SiteToken[] = [
  { token: "{group_name}", label: "Clan name", sample: "Pegasus PvM" },
  { token: "{member_count}", label: "Tracked members", sample: "266" },
  { token: "{global_rank}", label: "Global clan rank", sample: "#31" },
  { token: "{monthly_loot}", label: "Loot this month", sample: "968.87M" },
  { token: "{top_player}", label: "Top player this month", sample: "TzKal-PegGal" },
  { token: "{top_boss}", label: "Most-farmed boss", sample: "Vardorvis" },
  { token: "{discord_url}", label: "Clan Discord link", sample: "https://discord.gg/…" },
  { token: "{group_description}", label: "Clan description", sample: "An OSRS group." },
  { token: "{current_month}", label: "Current month", sample: "August" },
  { token: "{current_year}", label: "Current year", sample: "2026" },
];

function values(group: GroupProfile): Record<string, string> {
  const now = new Date();
  return {
    "{group_name}": group.name ?? "",
    "{member_count}": (group.member_count ?? 0).toLocaleString(),
    "{global_rank}": group.global_rank != null ? `#${group.global_rank}` : "—",
    "{monthly_loot}": group.monthly_loot?.value_formatted ?? "0",
    "{top_player}": group.top_player?.name ?? "—",
    "{top_boss}": group.top_bosses?.[0]?.name ?? "—",
    "{discord_url}": group.discord_url ?? "",
    "{group_description}": group.description ?? "",
    "{current_month}": now.toLocaleString("en-US", { month: "long" }),
    "{current_year}": String(now.getFullYear()),
  };
}

const TOKEN_RE = /\{[a-z_]+\}/g;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Replace known tokens in plain text (Markdown bodies, headings, captions).
 * Unknown `{tokens}` are left verbatim so ordinary braces survive.
 */
export function resolveTokens(text: string, group: GroupProfile): string {
  if (!text || !text.includes("{")) return text;
  const map = values(group);
  return text.replace(TOKEN_RE, (m) => (m in map ? map[m]! : m));
}

/**
 * Same, for already-sanitized HTML. Values are HTML-escaped on the way in:
 * the stored markup passed the sanitizer, but a substituted value (a clan
 * name containing `<`, say) must not be able to introduce new markup.
 */
export function resolveTokensInHtml(html: string, group: GroupProfile): string {
  if (!html || !html.includes("{")) return html;
  const map = values(group);
  return html.replace(TOKEN_RE, (m) => (m in map ? escapeHtml(map[m]!) : m));
}
