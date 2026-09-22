/**
 * Pure helpers for targeted site pop-ups (web118a): the visitor host
 * (`components/site-notices/*`) and the /admin/notices composer share these,
 * and `test/site-notices.test.ts` pins them.
 *
 * The server is the record of what a user has closed. The browser keeps a
 * small per-user memory as well, for two cases the server can't cover alone:
 * a close whose request never landed (the tab navigated away first, or the
 * network dropped), and a second open tab that should hide the notice as soon
 * as the first one closes it. Anything in the memory is hidden locally and its
 * close is re-sent until the server stops returning the notice.
 */
import type { NoticeRule, NoticeRuleType, PopupNotice } from "@droptracker/api-types";

/** Local memory entries older than this are dropped (the server has long
 * since caught up, or the notice has ended). */
export const CLOSED_MEMORY_TTL_MS = 60 * 24 * 60 * 60 * 1000;

/** Notices appear this long after the page settles, never mid-paint. */
export const NOTICE_OPEN_DELAY_MS = 1200;

export type ClosedMemory = Record<string, number>;

export function closedStorageKey(userId: number): string {
  return `dt:notices:closed:${userId}`;
}

/** Parse the stored memory, tolerating anything malformed. */
export function parseClosedMemory(raw: string | null): ClosedMemory {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: ClosedMemory = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (/^\d+$/.test(k) && typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function rememberClosed(memory: ClosedMemory, ids: number[], now: number): ClosedMemory {
  const next = { ...memory };
  for (const id of ids) next[String(id)] = now;
  return next;
}

export function pruneClosedMemory(memory: ClosedMemory, now: number): ClosedMemory {
  const out: ClosedMemory = {};
  for (const [k, ts] of Object.entries(memory)) {
    if (now - ts < CLOSED_MEMORY_TTL_MS) out[k] = ts;
  }
  return out;
}

/**
 * Split what the server returned into notices to show and notices this
 * browser already closed. The second list is hidden and its close re-sent:
 * the server returning it means the earlier close never reached it.
 */
export function splitByClosed(
  items: PopupNotice[],
  memory: ClosedMemory,
): { show: PopupNotice[]; resend: number[] } {
  const show: PopupNotice[] = [];
  const resend: number[] = [];
  for (const n of items) {
    if (memory[String(n.id)] != null) resend.push(n.id);
    else show.push(n);
  }
  return { show, resend };
}

/** Links that leave the site open in a new tab; site paths navigate in place. */
export function isExternalHref(href: string, origin?: string): boolean {
  if (href.startsWith("/") && !href.startsWith("//")) return false;
  if (href.startsWith("#")) return false;
  try {
    const url = new URL(href, origin ?? "https://www.droptracker.io");
    if (origin && url.origin === origin) return false;
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Same-site absolute URLs become paths so the router can take them. */
export function toSitePath(href: string, origin?: string): string {
  if (href.startsWith("/")) return href;
  try {
    const url = new URL(href, origin);
    return origin && url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : href;
  } catch {
    return href;
  }
}

/** True while the visitor is typing somewhere, so a pop-up never steals the
 * keystrokes (an Enter would otherwise land on the dialog's button). */
export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return !["button", "submit", "reset", "checkbox", "radio", "range", "color", "file"].includes(type);
  }
  return (el as HTMLElement).isContentEditable === true;
}

// --- Composer helpers ----------------------------------------------------

/** `<input type="datetime-local">` value (local time) -> unix seconds. */
export function localInputToUnix(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/** unix seconds -> `<input type="datetime-local">` value in local time. */
export function unixToLocalInput(ts: number | null): string {
  if (ts == null) return "";
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const RULE_LABELS: Record<NoticeRuleType, { label: string; hint: string }> = {
  group_leaders: { label: "Clan leaders", hint: "Owners (and optionally admins) of groups." },
  supporters: { label: "Supporters", hint: "People paying for a personal or group subscription." },
  users: { label: "Specific people", hint: "Pick accounts by name, Discord id or RSN." },
  group_members: { label: "Group members", hint: "Everyone in the groups you pick." },
  staff: { label: "Staff", hint: "Developers and site admins. Handy for a test run." },
  everyone: { label: "Everyone signed in", hint: "Every account that visits the site." },
};

/** Display order in the "Add audience" menu. */
export const RULE_ORDER: NoticeRuleType[] = [
  "group_leaders",
  "supporters",
  "users",
  "group_members",
  "staff",
  "everyone",
];

export function blankRule(type: NoticeRuleType): NoticeRule {
  switch (type) {
    case "users":
      return { type, user_ids: [] };
    case "group_leaders":
      return { type, roles: ["owner"], group_ids: [], group_tiers: [] };
    case "group_members":
      return { type, group_ids: [], group_tiers: [] };
    case "supporters":
      return { type, tier_keys: [] };
    default:
      return { type };
  }
}

/** Why an audience can't be sent yet, or null when it can. Mirrors the
 * backend's `normalize_audience` so the composer says it first. */
export function audienceProblem(rules: NoticeRule[]): string | null {
  if (rules.length === 0) return "Choose who should see this notice.";
  for (const r of rules) {
    if (r.type === "users" && r.user_ids.length === 0) return "Pick at least one person, or remove that row.";
    if (r.type === "group_leaders" && r.roles.length === 0) return "Choose owners, admins, or both for clan leaders.";
  }
  return null;
}
