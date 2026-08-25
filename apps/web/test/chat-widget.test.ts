/**
 * Support-widget shaping logic (web102a) — `lib/chat-widget.ts`.
 *
 * The load-bearing bits: the view stack must floor at the inbox (a stray back
 * press can't blank the panel), the inbox sort must be stable so equal-time
 * items keep the server's order, unread math must survive local patches, and a
 * realtime hint must only patch items the inbox actually has — anything else
 * marks the inbox stale for a refetch instead of inventing rows.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  ChatThread,
  Inbox,
  InboxChatItem,
  InboxItem,
  InboxSuggestionItem,
  InboxTicketItem,
  RealtimeEvent,
  SuggestionSummary,
  TicketSummary,
} from "@droptracker/api-types";
import {
  applyUnreadHint,
  clearInboxUnread,
  inboxItemKey,
  inboxItemTime,
  inboxItemView,
  inboxRowMeta,
  noticeSeverityTone,
  inboxTotalUnread,
  initialStack,
  popView,
  pushView,
  replaceView,
  sortInboxItems,
  TICKET_TYPES,
  unreadHintFromFrame,
  viewMatchesHint,
  viewTitle,
  type WidgetView,
} from "../lib/chat-widget";

const NOW = 1_760_000_000;

/* ---------------------------------- fixtures ------------------------------ */

function chatThread(over: Partial<ChatThread> = {}): ChatThread {
  return {
    id: 1,
    kind: "event_invite",
    subject_type: "event_group",
    subject_id: 55,
    title: "Iron Wolves vs Clan B",
    status: "open",
    created_at: NOW - 7_200,
    last_message_at: NOW - 600,
    unread: 1,
    participants: [
      { party_type: "group", party_id: 10, role: "owner", name: "Iron Wolves" },
      { party_type: "group", party_id: 42, role: "member", name: "Clan B" },
    ],
    my_parties: [{ party_type: "group", party_id: 42, name: "Clan B" }],
    can_post: true,
    is_moderator: false,
    ...over,
  };
}

function chatItem(over: Partial<InboxChatItem> = {}): InboxChatItem {
  return { kind: "chat", thread: chatThread(), preview: "See you the 3rd.", ...over };
}

function ticketSummary(over: Partial<TicketSummary> = {}): TicketSummary {
  return {
    ticket_id: 31,
    type: "players",
    status: "open",
    subject: "Drops stopped tracking",
    created_by: 42,
    created_by_name: "zezima",
    claimed_by: null,
    claimed_by_name: null,
    closed_by: null,
    closed_by_name: null,
    message_count: 4,
    date_added: NOW - 86_400,
    date_updated: NOW - 1_800,
    date_closed: null,
    ...over,
  };
}

function ticketItem(over: Partial<InboxTicketItem> = {}): InboxTicketItem {
  return { kind: "ticket", ticket: ticketSummary(), unread: 2, preview: "On it!", ...over };
}

function suggestionSummary(over: Partial<SuggestionSummary> = {}): SuggestionSummary {
  return {
    id: 9,
    type: "suggestion",
    title: "Dark theme for lootboards",
    status: "posted",
    origin: "web",
    is_open: true,
    author_name: "zezima",
    author_user_id: 42,
    excerpt: "A darker theme would be nice.",
    message_count: 2,
    discord_thread_url: null,
    created_at: NOW - 172_800,
    last_activity_at: NOW - 3_600,
    ...over,
  };
}

function suggestionItem(over: Partial<InboxSuggestionItem> = {}): InboxSuggestionItem {
  return { kind: "suggestion", suggestion: suggestionSummary(), unread: 0, ...over };
}

function inbox(items: InboxItem[], over: Partial<Inbox> = {}): Inbox {
  return { items, total_unread: inboxTotalUnread(items), open_ticket_id: null, ...over };
}

function frame(type: RealtimeEvent["type"], data: Record<string, unknown>): RealtimeEvent {
  return { v: 1, type, scope: "user:42", ts: NOW, data };
}

/* --------------------------------- view stack ----------------------------- */

test("initialStack starts at the inbox", () => {
  assert.deepEqual(initialStack(), [{ kind: "inbox" }]);
});

test("pushView appends without mutating the original stack", () => {
  const stack = initialStack();
  const next = pushView(stack, { kind: "ticket", ticketId: 31 });
  assert.equal(next.length, 2);
  assert.deepEqual(next[1], { kind: "ticket", ticketId: 31 });
  assert.equal(stack.length, 1);
});

test("popView floors at the inbox root", () => {
  const one = initialStack();
  assert.equal(popView(one), one); // same reference: nothing to pop
  const two = pushView(one, { kind: "chat", threadId: 5 });
  assert.deepEqual(popView(two), [{ kind: "inbox" }]);
  // Repeated pops stay at the floor.
  assert.deepEqual(popView(popView(popView(two))), [{ kind: "inbox" }]);
});

test("replaceView swaps the top view but never the root", () => {
  const stack = pushView(initialStack(), { kind: "new-ticket" });
  const next = replaceView(stack, { kind: "ticket", ticketId: 901 });
  assert.deepEqual(next, [{ kind: "inbox" }, { kind: "ticket", ticketId: 901 }]);
  // Replacing on the bare root keeps the inbox beneath the new view.
  assert.deepEqual(replaceView(initialStack(), { kind: "new-suggestion" }), [
    { kind: "inbox" },
    { kind: "new-suggestion" },
  ]);
});

test("viewTitle covers every view kind", () => {
  const views: WidgetView[] = [
    { kind: "inbox" },
    { kind: "chat", threadId: 1 },
    { kind: "ticket", ticketId: 31 },
    { kind: "suggestion", suggestionId: 9 },
    { kind: "new-ticket" },
    { kind: "new-suggestion" },
    { kind: "staff-new-chat" },
    { kind: "staff-notices" },
  ];
  for (const view of views) {
    assert.equal(typeof viewTitle(view), "string");
    assert.ok(viewTitle(view).length > 0);
  }
  assert.equal(viewTitle({ kind: "ticket", ticketId: 31 }), "Ticket #31");
});

/* ------------------------------ item accessors ---------------------------- */

test("inboxItemKey / inboxItemView / inboxItemTime per kind", () => {
  const chat = chatItem();
  const ticket = ticketItem();
  const suggestion = suggestionItem();

  assert.equal(inboxItemKey(chat), "chat:1");
  assert.equal(inboxItemKey(ticket), "ticket:31");
  assert.equal(inboxItemKey(suggestion), "suggestion:9");

  assert.deepEqual(inboxItemView(chat), { kind: "chat", threadId: 1 });
  assert.deepEqual(inboxItemView(ticket), { kind: "ticket", ticketId: 31 });
  assert.deepEqual(inboxItemView(suggestion), { kind: "suggestion", suggestionId: 9 });

  assert.equal(inboxItemTime(chat), NOW - 600);
  assert.equal(inboxItemTime(ticket), NOW - 1_800);
  assert.equal(inboxItemTime(suggestion), NOW - 3_600);
  // Fallbacks: created time, then 0.
  assert.equal(
    inboxItemTime(chatItem({ thread: chatThread({ last_message_at: null }) })),
    NOW - 7_200,
  );
  assert.equal(
    inboxItemTime(chatItem({ thread: chatThread({ last_message_at: null, created_at: null }) })),
    0,
  );
});

/* ---------------------------------- sorting ------------------------------- */

test("sortInboxItems orders newest-activity first", () => {
  const oldChat = chatItem({ thread: chatThread({ id: 2, last_message_at: NOW - 9_000 }) });
  const sorted = sortInboxItems([oldChat, suggestionItem(), ticketItem(), chatItem()]);
  assert.deepEqual(sorted.map(inboxItemKey), ["chat:1", "ticket:31", "suggestion:9", "chat:2"]);
});

test("sortInboxItems is stable for equal timestamps and does not mutate", () => {
  const a = chatItem({ thread: chatThread({ id: 1, last_message_at: NOW }) });
  const b = ticketItem({ ticket: ticketSummary({ date_updated: NOW }) });
  const c = chatItem({ thread: chatThread({ id: 3, last_message_at: NOW }) });
  const input = [a, b, c];
  const sorted = sortInboxItems(input);
  assert.deepEqual(sorted.map(inboxItemKey), ["chat:1", "ticket:31", "chat:3"]);
  assert.deepEqual(input.map(inboxItemKey), ["chat:1", "ticket:31", "chat:3"]);
  assert.notEqual(sorted, input);
});

/* -------------------------------- unread math ------------------------------ */

test("inboxTotalUnread sums chat thread unread and item unread alike", () => {
  assert.equal(inboxTotalUnread([]), 0);
  assert.equal(inboxTotalUnread([chatItem(), ticketItem(), suggestionItem()]), 3); // 1 + 2 + 0
});

/* ----------------------------- realtime hints ------------------------------ */

test("unreadHintFromFrame maps inbox_unread, legacy chat_unread and ticket_message", () => {
  assert.deepEqual(unreadHintFromFrame(frame("inbox_unread", { surface: "ticket", ref_id: 31 })), {
    surface: "ticket",
    refId: 31,
  });
  assert.deepEqual(unreadHintFromFrame(frame("chat_unread", { thread_id: 5 })), {
    surface: "chat",
    refId: 5,
  });
  assert.deepEqual(unreadHintFromFrame(frame("ticket_message", { ticket_id: 31 })), {
    surface: "ticket",
    refId: 31,
  });
});

test("unreadHintFromFrame drops irrelevant and malformed frames", () => {
  assert.equal(unreadHintFromFrame(frame("drop", { player_id: 1 })), null);
  assert.equal(
    unreadHintFromFrame(frame("inbox_unread", { surface: "nonsense", ref_id: 1 })),
    null,
  );
  assert.equal(unreadHintFromFrame(frame("inbox_unread", { surface: "chat" })), null);
  assert.equal(unreadHintFromFrame(frame("inbox_unread", { surface: "chat", ref_id: "9" })), null);
  assert.equal(unreadHintFromFrame(frame("chat_unread", {})), null);
  assert.equal(unreadHintFromFrame(frame("ticket_message", {})), null);
});

test("viewMatchesHint only matches the conversation on screen", () => {
  const hint = { surface: "ticket" as const, refId: 31 };
  assert.ok(viewMatchesHint({ kind: "ticket", ticketId: 31 }, hint));
  assert.ok(!viewMatchesHint({ kind: "ticket", ticketId: 32 }, hint));
  assert.ok(!viewMatchesHint({ kind: "chat", threadId: 31 }, hint));
  assert.ok(!viewMatchesHint({ kind: "inbox" }, hint));
  assert.ok(viewMatchesHint({ kind: "chat", threadId: 5 }, { surface: "chat", refId: 5 }));
  assert.ok(
    viewMatchesHint({ kind: "suggestion", suggestionId: 9 }, { surface: "suggestion", refId: 9 }),
  );
});

test("applyUnreadHint patches a known chat item and recomputes the total", () => {
  const box = inbox([chatItem(), ticketItem()]);
  const { inbox: next, stale } = applyUnreadHint(box, { surface: "chat", refId: 1 }, NOW + 60);
  assert.equal(stale, false);
  const chat = next.items[0] as InboxChatItem;
  assert.equal(chat.thread.unread, 2);
  assert.equal(chat.thread.last_message_at, NOW + 60); // bumped so it sorts to the top
  assert.equal(next.total_unread, 4); // 2 + 2
  // The original is untouched.
  assert.equal((box.items[0] as InboxChatItem).thread.unread, 1);
  assert.equal(box.total_unread, 3);
});

test("applyUnreadHint patches ticket and suggestion items", () => {
  const box = inbox([ticketItem(), suggestionItem()]);
  const afterTicket = applyUnreadHint(box, { surface: "ticket", refId: 31 }, NOW + 5);
  assert.equal(afterTicket.stale, false);
  const ticket = afterTicket.inbox.items[0] as InboxTicketItem;
  assert.equal(ticket.unread, 3);
  assert.equal(ticket.ticket.date_updated, NOW + 5);

  const afterSuggestion = applyUnreadHint(afterTicket.inbox, { surface: "suggestion", refId: 9 });
  const suggestion = afterSuggestion.inbox.items[1] as InboxSuggestionItem;
  assert.equal(suggestion.unread, 1);
  // No `at` given: the activity time stays put.
  assert.equal(suggestion.suggestion.last_activity_at, NOW - 3_600);
  assert.equal(afterSuggestion.inbox.total_unread, 4);
});

test("applyUnreadHint never bumps time backwards", () => {
  const box = inbox([chatItem()]);
  const { inbox: next } = applyUnreadHint(box, { surface: "chat", refId: 1 }, NOW - 9_999);
  assert.equal((next.items[0] as InboxChatItem).thread.last_message_at, NOW - 600);
});

test("applyUnreadHint marks unknown items stale and leaves the inbox untouched", () => {
  const box = inbox([chatItem()]);
  const { inbox: next, stale } = applyUnreadHint(box, { surface: "ticket", refId: 999 }, NOW);
  assert.equal(stale, true);
  assert.equal(next, box); // same reference — setState callers no-op
});

test("clearInboxUnread zeroes one item and recomputes; no-ops otherwise", () => {
  const box = inbox([chatItem(), ticketItem()]);
  const next = clearInboxUnread(box, "ticket", 31);
  assert.equal((next.items[1] as InboxTicketItem).unread, 0);
  assert.equal(next.total_unread, 1);
  // Already-zero and unknown items return the same reference.
  assert.equal(clearInboxUnread(next, "ticket", 31), next);
  assert.equal(clearInboxUnread(next, "suggestion", 123), next);
});

/* --------------------------------- row meta -------------------------------- */

test("inboxRowMeta: ticket rows use type emoji and status badge", () => {
  const meta = inboxRowMeta(ticketItem());
  assert.equal(meta.key, "ticket:31");
  assert.equal(meta.icon, TICKET_TYPES.find((t) => t.value === "players")!.emoji);
  assert.equal(meta.title, "Drops stopped tracking");
  assert.equal(meta.preview, "On it!");
  assert.equal(meta.unread, 2);
  assert.deepEqual(meta.badge, { label: "Open", tone: "green" });

  const pending = inboxRowMeta(ticketItem({ ticket: ticketSummary({ status: "pending" }) }));
  assert.deepEqual(pending.badge, { label: "Setting up", tone: "sky" });
  const untitled = inboxRowMeta(ticketItem({ ticket: ticketSummary({ subject: null }) }));
  assert.equal(untitled.title, "Ticket #31");
});

test("inboxRowMeta: suggestion rows split bug vs suggestion", () => {
  const idea = inboxRowMeta(suggestionItem());
  assert.equal(idea.icon, "\u{1F4A1}");
  assert.deepEqual(idea.badge, { label: "Suggestion", tone: "purple" });
  assert.equal(idea.preview, "A darker theme would be nice.");

  const bug = inboxRowMeta(
    suggestionItem({ suggestion: suggestionSummary({ type: "bug", excerpt: undefined }) }),
  );
  assert.equal(bug.icon, "\u{1F41B}");
  assert.deepEqual(bug.badge, { label: "Bug", tone: "red" });
  assert.equal(bug.preview, null);
});

test("inboxRowMeta: chat rows branch on thread kind", () => {
  const invite = inboxRowMeta(chatItem());
  assert.equal(invite.title, "Iron Wolves vs Clan B");
  assert.deepEqual(invite.badge, { label: "Event", tone: "sky" });
  assert.equal(invite.unread, 1);

  const staff = inboxRowMeta(
    chatItem({ thread: chatThread({ kind: "staff_dm", title: null }), preview: "Hey there" }),
  );
  assert.equal(staff.title, "DropTracker staff");
  assert.deepEqual(staff.badge, { label: "Staff", tone: "gold" });
  assert.equal(staff.preview, "Hey there");

  // Unknown future kinds degrade to a plain conversation row.
  const future = inboxRowMeta(chatItem({ thread: chatThread({ kind: "mystery", title: null }) }));
  assert.equal(future.title, "Conversation");
  assert.equal(future.badge, null);
});

test("inboxRowMeta: group_notice rows carry the notice badge", () => {
  const base = chatItem({
    thread: chatThread({ kind: "group_notice", title: "Notification channel unreachable" }),
  });
  assert.deepEqual(inboxRowMeta({ ...base, notice: undefined }).badge, {
    label: "Notice",
    tone: "bronze",
  });
  assert.deepEqual(
    inboxRowMeta({
      ...base,
      notice: { code: "notify_channel_forbidden", severity: "warning", status: "open" },
    }).badge,
    { label: "warning", tone: "ember" },
  );
  assert.deepEqual(
    inboxRowMeta({
      ...base,
      notice: { code: "notify_channel_forbidden", severity: "error", status: "open" },
    }).badge,
    { label: "error", tone: "red" },
  );
  assert.deepEqual(
    inboxRowMeta({
      ...base,
      notice: { code: "notify_channel_forbidden", severity: "error", status: "resolved" },
    }).badge,
    { label: "Resolved", tone: "green" },
  );
  const meta = inboxRowMeta({
    ...base,
    notice: { code: "x", severity: "info", status: "open" },
  });
  assert.deepEqual(meta.badge, { label: "info", tone: "sky" });
  assert.equal(meta.title, "Notification channel unreachable");
});

test("noticeSeverityTone maps the backend vocabulary plus legacy values", () => {
  assert.equal(noticeSeverityTone("info"), "sky");
  assert.equal(noticeSeverityTone("minor"), "gold");
  assert.equal(noticeSeverityTone("major"), "ember");
  assert.equal(noticeSeverityTone("critical"), "red");
  // Legacy/loose values degrade sensibly; unknowns read as informational.
  assert.equal(noticeSeverityTone("warning"), "ember");
  assert.equal(noticeSeverityTone("error"), "red");
  assert.equal(noticeSeverityTone("Critical"), "red");
  assert.equal(noticeSeverityTone("whatever"), "sky");
});

/* -------------------------------- ticket types ----------------------------- */

test("TICKET_TYPES covers every ticket type with copy", () => {
  assert.deepEqual(
    TICKET_TYPES.map((t) => t.value),
    ["players", "clans", "support", "other"],
  );
  for (const t of TICKET_TYPES) {
    assert.ok(t.label.length > 0);
    assert.ok(t.emoji.length > 0);
    assert.ok(t.hint.length > 0);
  }
});
