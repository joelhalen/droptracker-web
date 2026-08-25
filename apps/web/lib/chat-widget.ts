/**
 * Pure shaping logic for the support widget (web102a) — the bottom-right
 * popup that federates chat threads, tickets and suggestions behind one inbox.
 *
 * Kept out of the components on purpose (repo rule: logic in `lib`, not JSX) so
 * the parts that are easy to get subtly wrong — the view-stack floor, unread
 * arithmetic, how a realtime hint patches a fetched inbox — are unit tested
 * rather than eyeballed. Nothing here touches React or the network.
 */
import type { Inbox, InboxItem, RealtimeEvent, TicketType } from "@droptracker/api-types";

/* -------------------------------------------------------------------------- */
/* View stack                                                                 */
/* -------------------------------------------------------------------------- */

/** Every screen the widget panel can show. The staff views exist in the union
 * now so the inbox footer can push them; their real UIs land in a later pass. */
export type WidgetView =
  | { kind: "inbox" }
  | { kind: "chat"; threadId: number }
  | { kind: "ticket"; ticketId: number }
  | { kind: "suggestion"; suggestionId: number }
  | { kind: "new-ticket" }
  | { kind: "new-suggestion" }
  | { kind: "staff-new-chat" }
  | { kind: "staff-notices" };

/** A fresh stack: the inbox is always the root. */
export function initialStack(): WidgetView[] {
  return [{ kind: "inbox" }];
}

export function pushView(stack: WidgetView[], view: WidgetView): WidgetView[] {
  return [...stack, view];
}

/** Pop one view, flooring at the root — the inbox can never be popped away, so
 * a stray extra back press leaves the widget usable rather than blank. */
export function popView(stack: WidgetView[]): WidgetView[] {
  if (stack.length <= 1) return stack;
  return stack.slice(0, -1);
}

/** Swap the top view in place (e.g. new-ticket form → the created ticket), so
 * "back" from the result skips the now-stale form. */
export function replaceView(stack: WidgetView[], view: WidgetView): WidgetView[] {
  return [...popView(stack), view];
}

/** Panel-header title per view. Views that need richer context (the thread's
 * counterparty, the ticket subject) draw it inside their own body. */
export function viewTitle(view: WidgetView): string {
  switch (view.kind) {
    case "inbox":
      return "Messages & support";
    case "chat":
      return "Conversation";
    case "ticket":
      return `Ticket #${view.ticketId}`;
    case "suggestion":
      return "Suggestion";
    case "new-ticket":
      return "Open a ticket";
    case "new-suggestion":
      return "New suggestion";
    case "staff-new-chat":
      return "Message a user";
    case "staff-notices":
      return "Group notices";
  }
}

/* -------------------------------------------------------------------------- */
/* Inbox items                                                                */
/* -------------------------------------------------------------------------- */

/** The three unread surfaces, matching the backend's `inbox_unread` frames. */
export type InboxSurface = "chat" | "ticket" | "suggestion";

/** Stable identity of an item — list keys and hint matching. */
export function inboxItemKey(item: InboxItem): string {
  switch (item.kind) {
    case "chat":
      return `chat:${item.thread.id}`;
    case "ticket":
      return `ticket:${item.ticket.ticket_id}`;
    case "suggestion":
      return `suggestion:${item.suggestion.id}`;
  }
}

/** Last-activity time (unix seconds, 0 when unknown) — the sort key. */
export function inboxItemTime(item: InboxItem): number {
  switch (item.kind) {
    case "chat":
      return item.thread.last_message_at ?? item.thread.created_at ?? 0;
    case "ticket":
      return item.ticket.date_updated ?? item.ticket.date_added ?? 0;
    case "suggestion":
      return item.suggestion.last_activity_at ?? item.suggestion.created_at ?? 0;
  }
}

export function inboxItemUnread(item: InboxItem): number {
  return item.kind === "chat" ? (item.thread.unread ?? 0) : (item.unread ?? 0);
}

/** The view a row opens. */
export function inboxItemView(item: InboxItem): WidgetView {
  switch (item.kind) {
    case "chat":
      return { kind: "chat", threadId: item.thread.id };
    case "ticket":
      return { kind: "ticket", ticketId: item.ticket.ticket_id };
    case "suggestion":
      return { kind: "suggestion", suggestionId: item.suggestion.id };
  }
}

/** Newest activity first; ties keep their incoming (server) order. Explicitly
 * stability-preserving via index tiebreak rather than trusting the engine. */
export function sortInboxItems(items: InboxItem[]): InboxItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => inboxItemTime(b.item) - inboxItemTime(a.item) || a.index - b.index)
    .map(({ item }) => item);
}

/** Client-recomputed badge total — the source of truth after local patches. */
export function inboxTotalUnread(items: InboxItem[]): number {
  return items.reduce((sum, item) => sum + inboxItemUnread(item), 0);
}

/* -------------------------------------------------------------------------- */
/* Row presentation                                                           */
/* -------------------------------------------------------------------------- */

/** Matches the Badge primitive's variant set (kept as literals so this module
 * stays free of UI imports). */
export type InboxBadgeTone =
  | "gold"
  | "bronze"
  | "green"
  | "red"
  | "ember"
  | "neutral"
  | "purple"
  | "sky";

export interface InboxRowMeta {
  key: string;
  icon: string;
  title: string;
  preview: string | null;
  timestamp: number | null;
  unread: number;
  badge: { label: string; tone: InboxBadgeTone } | null;
}

function ticketBadge(status: string): { label: string; tone: InboxBadgeTone } {
  switch (status) {
    case "open":
      return { label: "Open", tone: "green" };
    case "pending":
      return { label: "Setting up", tone: "sky" };
    case "closing":
      return { label: "Closing", tone: "ember" };
    default:
      return { label: "Closed", tone: "neutral" };
  }
}

/** Badge tone per notice severity. The backend vocabulary is
 * info|minor|major|critical; legacy/loose values degrade sensibly and anything
 * unknown reads as informational. Shared by the inbox rows and the staff
 * notice console so one severity never wears two colors. */
export function noticeSeverityTone(severity: string): InboxBadgeTone {
  switch (severity.toLowerCase()) {
    case "critical":
    case "error":
      return "red";
    case "major":
    case "warning":
      return "ember";
    case "minor":
      return "gold";
    default:
      return "sky"; // info + anything new
  }
}

function noticeBadge(notice: { severity: string; status: string } | null | undefined): {
  label: string;
  tone: InboxBadgeTone;
} {
  if (!notice) return { label: "Notice", tone: "bronze" };
  if (notice.status === "resolved") return { label: "Resolved", tone: "green" };
  return { label: notice.severity, tone: noticeSeverityTone(notice.severity) };
}

/** Everything an inbox row renders, per kind. */
export function inboxRowMeta(item: InboxItem): InboxRowMeta {
  const base = {
    key: inboxItemKey(item),
    timestamp: inboxItemTime(item) || null,
    unread: inboxItemUnread(item),
  };
  switch (item.kind) {
    case "ticket": {
      const type = TICKET_TYPES.find((t) => t.value === item.ticket.type);
      return {
        ...base,
        icon: type?.emoji ?? "\u{1F4E9}",
        title: item.ticket.subject ?? `Ticket #${item.ticket.ticket_id}`,
        preview: item.preview ?? null,
        badge: ticketBadge(item.ticket.status),
      };
    }
    case "suggestion": {
      const bug = item.suggestion.type === "bug";
      return {
        ...base,
        icon: bug ? "\u{1F41B}" : "\u{1F4A1}",
        title: item.suggestion.title,
        preview: item.suggestion.excerpt ?? null,
        badge: bug ? { label: "Bug", tone: "red" } : { label: "Suggestion", tone: "purple" },
      };
    }
    case "chat": {
      const preview = item.preview ?? null;
      switch (item.thread.kind) {
        case "staff_dm":
          return {
            ...base,
            icon: "\u{1F6E1}\u{FE0F}",
            title: item.thread.title ?? "DropTracker staff",
            preview,
            badge: { label: "Staff", tone: "gold" },
          };
        case "group_notice":
          return {
            ...base,
            icon: "⚠\u{FE0F}",
            title: item.thread.title ?? "Group notice",
            preview,
            badge: noticeBadge(item.notice),
          };
        default:
          // event_invite and any future kind: a plain conversation row.
          return {
            ...base,
            icon: "⚔\u{FE0F}",
            title: item.thread.title ?? "Conversation",
            preview,
            badge: item.thread.kind === "event_invite" ? { label: "Event", tone: "sky" } : null,
          };
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Realtime hints                                                             */
/* -------------------------------------------------------------------------- */

export interface UnreadHint {
  surface: InboxSurface;
  refId: number;
}

const SURFACES: readonly string[] = ["chat", "ticket", "suggestion"];

/** Map a realtime frame to an unread hint, or null for frames the widget
 * doesn't care about. Legacy `chat_unread` (thread id only) is treated as
 * `inbox_unread(kind chat)`; a `ticket_message` seen anywhere counts as a
 * ticket hint. Malformed data is dropped, never thrown on. */
export function unreadHintFromFrame(event: RealtimeEvent): UnreadHint | null {
  const data = event.data;
  if (event.type === "inbox_unread") {
    const surface = data.surface;
    const refId = data.ref_id;
    if (typeof surface === "string" && SURFACES.includes(surface) && typeof refId === "number") {
      return { surface: surface as InboxSurface, refId };
    }
    return null;
  }
  if (event.type === "chat_unread") {
    const threadId = data.thread_id;
    return typeof threadId === "number" ? { surface: "chat", refId: threadId } : null;
  }
  if (event.type === "ticket_message") {
    const ticketId = data.ticket_id;
    return typeof ticketId === "number" ? { surface: "ticket", refId: ticketId } : null;
  }
  return null;
}

function hintMatches(item: InboxItem, hint: UnreadHint): boolean {
  return inboxItemKey(item) === `${hint.surface}:${hint.refId}`;
}

/** Whether an open view shows the conversation a hint refers to — used to
 * suppress the local unread bump for what's already on screen. */
export function viewMatchesHint(view: WidgetView, hint: UnreadHint): boolean {
  switch (view.kind) {
    case "chat":
      return hint.surface === "chat" && hint.refId === view.threadId;
    case "ticket":
      return hint.surface === "ticket" && hint.refId === view.ticketId;
    case "suggestion":
      return hint.surface === "suggestion" && hint.refId === view.suggestionId;
    default:
      return false;
  }
}

/**
 * Patch a fetched inbox with a bodyless unread hint: a known item gets +1
 * unread and its activity time bumped (so it sorts to the top), and the total
 * is recomputed from the items. A hint for an item the inbox doesn't have —
 * brand-new thread/ticket — can't be patched locally, so the inbox is returned
 * untouched with `stale: true` and the caller schedules a refetch.
 */
export function applyUnreadHint(
  inbox: Inbox,
  hint: UnreadHint,
  at?: number,
): { inbox: Inbox; stale: boolean } {
  const index = inbox.items.findIndex((item) => hintMatches(item, hint));
  if (index < 0) return { inbox, stale: true };

  const items = inbox.items.slice();
  const item = items[index]!;
  const bump = (current: number | null | undefined) =>
    at != null ? Math.max(current ?? 0, at) : (current ?? null);

  if (item.kind === "chat") {
    items[index] = {
      ...item,
      thread: {
        ...item.thread,
        unread: (item.thread.unread ?? 0) + 1,
        last_message_at: bump(item.thread.last_message_at),
      },
    };
  } else if (item.kind === "ticket") {
    items[index] = {
      ...item,
      unread: (item.unread ?? 0) + 1,
      ticket: { ...item.ticket, date_updated: bump(item.ticket.date_updated) },
    };
  } else {
    items[index] = {
      ...item,
      unread: (item.unread ?? 0) + 1,
      suggestion: {
        ...item.suggestion,
        last_activity_at: bump(item.suggestion.last_activity_at),
      },
    };
  }

  return {
    inbox: { ...inbox, items, total_unread: inboxTotalUnread(items) },
    stale: false,
  };
}

/** Zero one item's unread (the viewer just opened it) and recompute the total.
 * Returns the same inbox when nothing changed, so setState callers no-op. */
export function clearInboxUnread(inbox: Inbox, surface: InboxSurface, refId: number): Inbox {
  const key = `${surface}:${refId}`;
  const index = inbox.items.findIndex((item) => inboxItemKey(item) === key);
  if (index < 0) return inbox;
  const item = inbox.items[index]!;
  if (inboxItemUnread(item) === 0) return inbox;

  const items = inbox.items.slice();
  items[index] =
    item.kind === "chat"
      ? { ...item, thread: { ...item.thread, unread: 0 } }
      : { ...item, unread: 0 };
  return { ...inbox, items, total_unread: inboxTotalUnread(items) };
}

/* -------------------------------------------------------------------------- */
/* Ticket types                                                               */
/* -------------------------------------------------------------------------- */

/** Per-type copy for the new-ticket radio cards. Labels/emoji/hints mirror the
 * backend's `TICKET_TYPE_META` (services/ticket_system.py) so the web form and
 * the Discord welcome card describe the same four doors with the same words. */
export const TICKET_TYPES: {
  value: TicketType;
  label: string;
  emoji: string;
  hint: string;
}[] = [
  {
    value: "players",
    label: "Player Support",
    emoji: "\u{1F9CD}",
    hint: "Something not tracking right on one of your accounts? Let's get it sorted.",
  },
  {
    value: "clans",
    label: "Clan / Group Support",
    emoji: "\u{1F3F0}",
    hint: "Questions about your group's setup, configuration, or tracking? We can help.",
  },
  {
    value: "support",
    label: "Technical Support",
    emoji: "\u{1F6E0}\u{FE0F}",
    hint: "Hit a bug or something behaving strangely? Tell us about it.",
  },
  {
    value: "other",
    label: "General Inquiry",
    emoji: "\u{1F4E9}",
    hint: "Whatever it is, we're listening.",
  },
];
