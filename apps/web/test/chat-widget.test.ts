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
  inboxItemTab,
  inboxItemTime,
  inboxItemView,
  inboxItemsForTab,
  inboxRowMeta,
  inboxTabUnread,
  inboxTabs,
  noticeSeverityTone,
  inboxTotalUnread,
  initialStack,
  popView,
  pushView,
  replaceView,
  sortInboxItems,
  zeroAllUnread,
  DEFAULT_INBOX_TAB,
  INBOX_TAB_ORDER,
  TICKET_TYPES,
  unreadHintFromFrame,
  viewMatchesHint,
  viewTitle,
  type InboxTabMeta,
  type WidgetView,
} from "../lib/chat-widget";
import { counterpartyLabel } from "../lib/chat";
import { mockInbox, mockStaffChats } from "../lib/mock-data";

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
    { kind: "staff-clan-chats" },
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

/* ----------------------------------- tabs ---------------------------------- */

test("the inbox tab is always first, and is what a fresh open selects", () => {
  assert.deepEqual(INBOX_TAB_ORDER, ["inbox", "suggestions"]);
  assert.equal(DEFAULT_INBOX_TAB, "inbox");
  assert.equal(inboxTabs([])[0]!.id, DEFAULT_INBOX_TAB);
});

test("inboxItemTab files chats and tickets under Inbox, suggestions under their own", () => {
  assert.equal(inboxItemTab(chatItem()), "inbox");
  assert.equal(inboxItemTab(ticketItem()), "inbox");
  assert.equal(inboxItemTab(suggestionItem()), "suggestions");
  // Every chat kind belongs to the inbox — including the clan-vs-clan invites
  // a group leader sees and the group notices the bot raises.
  for (const kind of ["staff_dm", "group_notice", "event_invite"]) {
    assert.equal(inboxItemTab(chatItem({ thread: chatThread({ kind }) })), "inbox");
  }
});

test("inboxItemsForTab partitions and sorts, losing nothing", () => {
  const items = [suggestionItem(), chatItem(), ticketItem()];
  const inboxTab = inboxItemsForTab(items, "inbox");
  const suggestionsTab = inboxItemsForTab(items, "suggestions");
  assert.deepEqual(inboxTab.map(inboxItemKey), ["chat:1", "ticket:31"]); // newest first
  assert.deepEqual(suggestionsTab.map(inboxItemKey), ["suggestion:9"]);
  // The partition is total: every item lands in exactly one tab.
  assert.equal(inboxTab.length + suggestionsTab.length, items.length);
});

test("tab unread counts only that tab's items, never the global total", () => {
  const items = [chatItem(), ticketItem(), suggestionItem({ unread: 5 })];
  assert.equal(inboxTotalUnread(items), 8); // 1 + 2 + 5
  assert.equal(inboxTabUnread(items, "inbox"), 3);
  assert.equal(inboxTabUnread(items, "suggestions"), 5);
});

test("inboxTabs returns both tabs with sorted items and their own unread", () => {
  const tabs = inboxTabs([suggestionItem({ unread: 5 }), ticketItem(), chatItem()]);
  assert.deepEqual(
    tabs.map((t) => [t.id, t.label, t.unread, t.items.length]),
    [
      ["inbox", "Inbox", 3, 2],
      ["suggestions", "Suggestions", 5, 1],
    ],
  );
  assert.deepEqual(tabs[0]!.items.map(inboxItemKey), ["chat:1", "ticket:31"]);
});

test("inboxTabs renders both tabs even when the inbox is empty", () => {
  const tabs = inboxTabs([]);
  assert.equal(tabs.length, 2);
  assert.ok(tabs.every((t) => t.items.length === 0 && t.unread === 0));
});

test("mock mode: the widget's two tabs both have something in them", () => {
  // USE_MOCK_API is how this UI gets driven without a backend, so the mock
  // inbox has to exercise both tabs — including the clan-vs-clan thread a
  // group leader sees, which belongs in the Inbox and not off in its own view.
  const tabs = inboxTabs(mockInbox().items);
  const [inboxTab, suggestionsTab] = tabs as [InboxTabMeta, InboxTabMeta];
  assert.ok(inboxTab.items.length >= 3, "inbox tab should carry chats + tickets");
  assert.equal(suggestionsTab.items.length, 1);
  const kinds = inboxTab.items.map((item) =>
    item.kind === "chat" ? item.thread.kind : item.kind,
  );
  for (const expected of ["staff_dm", "group_notice", "event_invite", "ticket"]) {
    assert.ok(kinds.includes(expected), `inbox tab is missing a ${expected} row`);
  }
  assert.ok(!kinds.includes("suggestion"));
});

test("mock mode: the staff clan-chats view lists CvC threads labelled by both clans", () => {
  const page = mockStaffChats("event_invite");
  assert.ok(page.items.length >= 2, "need more than the viewer's own clan chat");
  for (const thread of page.items) {
    assert.equal(thread.kind, "event_invite");
    // The list endpoint doesn't seat the viewer, so with no `my_parties` the
    // counterparty helper names EVERY participant — the two clans.
    const label = counterpartyLabel(thread);
    for (const party of thread.participants) {
      assert.ok(label.includes(party.name!), `${label} should name ${party.name}`);
    }
  }
  // Staff DMs stay on their own kind — the clan view must not mix them in.
  assert.ok(mockStaffChats("staff_dm").items.every((t) => t.kind === "staff_dm"));
});

/* ------------------------------ mark all read ------------------------------ */

test("zeroAllUnread clears every item and the total", () => {
  const box = inbox([chatItem(), ticketItem(), suggestionItem({ unread: 4 })]);
  assert.equal(box.total_unread, 7);
  const next = zeroAllUnread(box);
  assert.equal(next.total_unread, 0);
  assert.equal(inboxTotalUnread(next.items), 0);
  assert.equal((next.items[0] as InboxChatItem).thread.unread, 0);
  assert.equal((next.items[1] as InboxTicketItem).unread, 0);
  assert.equal((next.items[2] as InboxSuggestionItem).unread, 0);
  // Per-tab pills go quiet too — that's what "reset the counter" has to mean.
  assert.equal(inboxTabUnread(next.items, "inbox"), 0);
  assert.equal(inboxTabUnread(next.items, "suggestions"), 0);
  // The original is untouched, and nothing else about the inbox changed.
  assert.equal(box.total_unread, 7);
  assert.equal(next.items.length, box.items.length);
  assert.equal(next.open_ticket_id, box.open_ticket_id);
});

test("zeroAllUnread no-ops on an already-read or empty inbox", () => {
  const read = inbox([suggestionItem()]); // the only item is already at 0
  assert.equal(zeroAllUnread(read), read); // same reference — setState no-ops
  const empty = inbox([]);
  assert.equal(zeroAllUnread(empty), empty);
  // A stale server total with no unread items still gets cleared, so a bad
  // snapshot can't keep the badge lit forever.
  const stale = inbox([suggestionItem()], { total_unread: 3 });
  assert.equal(zeroAllUnread(stale).total_unread, 0);
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
