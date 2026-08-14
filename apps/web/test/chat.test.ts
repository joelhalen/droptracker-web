/**
 * Chat shaping logic (web96a) — `lib/chat.ts`.
 *
 * These are the decisions that look trivial in JSX and are wrong in ways
 * nobody notices for a week:
 *
 * * **Which side a message is on** comes from the PARTY, not the author. In an
 *   inter-clan negotiation two different people speak for the same clan, and
 *   an admin who happens to hold rights on both clans must not see their own
 *   messages flip sides.
 * * **System wording lives here, not in stored rows** — the backend saves a
 *   code plus its nouns, so every one of these strings must survive missing
 *   data rather than rendering "undefined challenged undefined".
 * * **Merging is id-keyed and re-sorted**, because a posted message arrives
 *   twice (the POST response and the SSE frame) and frames can arrive out of
 *   order.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatMessage, ChatPartyRef, ChatThread } from "@droptracker/api-types";
import {
  composerState,
  continuesBlock,
  counterparties,
  counterpartyLabel,
  mergeMessage,
  mergeOlderPage,
  messageSide,
  newestMessageId,
  speakerLabel,
  startsNewDay,
  systemText,
  totalUnread,
} from "../lib/chat";

const NOW = 1_760_000_000;

const HOST: ChatPartyRef = { party_type: "group", party_id: 10, name: "Iron Wolves" };
const MINE: ChatPartyRef = { party_type: "group", party_id: 42, name: "Clan B" };

function message(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 1,
    thread_id: 7,
    kind: "message",
    author_user_id: 501,
    author_name: "wolfleader",
    party_type: "group",
    party_id: 10,
    created_at: NOW,
    deleted: false,
    body: "hello",
    attachments: [],
    system_code: null,
    system_data: null,
    ...over,
  };
}

function thread(over: Partial<ChatThread> = {}): ChatThread {
  return {
    id: 7,
    kind: "event_invite",
    subject_type: "event_group",
    subject_id: 55,
    title: "Iron Wolves vs Clan B",
    status: "open",
    created_at: NOW - 7200,
    last_message_at: NOW,
    unread: 0,
    participants: [
      { ...HOST, role: "owner" },
      { ...MINE, role: "member" },
    ],
    my_parties: [MINE],
    can_post: true,
    is_moderator: false,
    ...over,
  };
}

/* -------------------------------------------------------------------------- */
/* Sides                                                                      */
/* -------------------------------------------------------------------------- */

test("a message from my clan is mine, whoever typed it", () => {
  // A co-leader's message is still "our side" — the party decides, not the
  // author, which is the whole point of party-based participation.
  const mine = message({ party_id: 42, author_user_id: 9999, author_name: "someone-else" });
  assert.equal(messageSide(mine, [MINE]), "mine");
});

test("a message from the other clan is theirs", () => {
  assert.equal(messageSide(message({ party_id: 10 }), [MINE]), "theirs");
});

test("system entries are neither side", () => {
  assert.equal(messageSide(message({ kind: "system", party_id: 42 }), [MINE]), "system");
});

test("someone who administers both clans sees both as mine", () => {
  const both = [MINE, HOST];
  assert.equal(messageSide(message({ party_id: 10 }), both), "mine");
  assert.equal(messageSide(message({ party_id: 42 }), both), "mine");
});

test("a viewer with no party sees everything as theirs", () => {
  // Staff reading a thread for moderation: nothing is "ours".
  assert.equal(messageSide(message(), []), "theirs");
});

/* -------------------------------------------------------------------------- */
/* Attribution                                                                */
/* -------------------------------------------------------------------------- */

test("speaker is the clan first, the person second", () => {
  assert.equal(speakerLabel(message(), thread()), "Iron Wolves · wolfleader");
});

test("speaker falls back to the party when the author is unknown", () => {
  assert.equal(speakerLabel(message({ author_name: null }), thread()), "Iron Wolves");
});

test("speaker falls back to the author when the party is not on the roster", () => {
  assert.equal(speakerLabel(message({ party_id: 999 }), thread()), "wolfleader");
});

test("speaker never renders empty", () => {
  assert.equal(
    speakerLabel(message({ party_id: 999, author_name: null }), thread()),
    "Unknown",
  );
});

/* -------------------------------------------------------------------------- */
/* Counterparties                                                             */
/* -------------------------------------------------------------------------- */

test("counterparties exclude my own parties", () => {
  assert.deepEqual(
    counterparties(thread()).map((p) => p.party_id),
    [10],
  );
  assert.equal(counterpartyLabel(thread()), "Iron Wolves");
});

test("counterparty label falls back to the title when I am every party", () => {
  const t = thread({ my_parties: [HOST, MINE] });
  assert.equal(counterpartyLabel(t), "Iron Wolves vs Clan B");
});

/* -------------------------------------------------------------------------- */
/* System wording                                                             */
/* -------------------------------------------------------------------------- */

const SYSTEM_DATA = {
  event_id: 7,
  event_name: "Autumn Clash",
  host_group_name: "Iron Wolves",
  invited_group_name: "Clan B",
};

test("invite lifecycle codes read as sentences", () => {
  const say = (code: string) =>
    systemText(message({ kind: "system", system_code: code, system_data: SYSTEM_DATA }));
  assert.equal(say("invite_sent"), "Iron Wolves invited Clan B to Autumn Clash.");
  assert.equal(say("invite_accepted"), "Clan B accepted the challenge.");
  assert.equal(say("invite_declined"), "Clan B declined the challenge.");
  assert.equal(say("invite_withdrawn"), "Clan B was removed from Autumn Clash.");
  assert.equal(say("event_activated"), "Autumn Clash is now live.");
  assert.equal(say("event_ended"), "Autumn Clash has ended.");
});

test("system wording survives missing nouns", () => {
  const text = systemText(
    message({ kind: "system", system_code: "invite_sent", system_data: {} }),
  );
  assert.equal(text, "The host clan invited the invited clan to the event.");
  assert.ok(!text.includes("undefined"));
});

test("system wording survives null data and blank strings", () => {
  const text = systemText(
    message({
      kind: "system",
      system_code: "invite_accepted",
      system_data: { invited_group_name: "   " },
    }),
  );
  assert.equal(text, "the invited clan accepted the challenge.");
});

test("an unknown code still says something", () => {
  const text = systemText(
    message({ kind: "system", system_code: "from_a_future_release", system_data: null }),
  );
  assert.equal(text, "Something changed on this event.");
});

/* -------------------------------------------------------------------------- */
/* Merging                                                                    */
/* -------------------------------------------------------------------------- */

test("newestMessageId is the max, not the last", () => {
  assert.equal(newestMessageId([message({ id: 5 }), message({ id: 3 })]), 5);
  assert.equal(newestMessageId([]), 0);
});

test("merging an already-present id replaces it rather than duplicating", () => {
  // Posting shows the message immediately AND the stream may deliver it.
  const existing = [message({ id: 1 }), message({ id: 2, body: "old" })];
  const merged = mergeMessage(existing, message({ id: 2, body: "new" }));
  assert.equal(merged.length, 2);
  assert.equal(merged[1]!.body, "new");
});

test("merging an out-of-order frame re-sorts by id", () => {
  const merged = mergeMessage([message({ id: 1 }), message({ id: 3 })], message({ id: 2 }));
  assert.deepEqual(
    merged.map((m) => m.id),
    [1, 2, 3],
  );
});

test("an older page prepends and drops overlaps", () => {
  const current = [message({ id: 5 }), message({ id: 6 })];
  const older = [message({ id: 3 }), message({ id: 4 }), message({ id: 5 })];
  assert.deepEqual(
    mergeOlderPage(current, older).map((m) => m.id),
    [3, 4, 5, 6],
  );
});

/* -------------------------------------------------------------------------- */
/* Grouping and separators                                                    */
/* -------------------------------------------------------------------------- */

test("the first message always starts a day", () => {
  assert.equal(startsNewDay(message()), true);
});

test("messages on the same local day share a separator", () => {
  const a = message({ id: 1, created_at: NOW });
  const b = message({ id: 2, created_at: NOW + 3600 });
  assert.equal(startsNewDay(b, a), false);
});

test("crossing a local day boundary inserts a separator", () => {
  const a = message({ id: 1, created_at: NOW });
  const b = message({ id: 2, created_at: NOW + 2 * 86_400 });
  assert.equal(startsNewDay(b, a), true);
});

test("consecutive messages from the same speaker group", () => {
  const a = message({ id: 1, created_at: NOW });
  const b = message({ id: 2, created_at: NOW + 60 });
  assert.equal(continuesBlock(b, a), true);
});

test("a different speaker breaks the block", () => {
  const a = message({ id: 1, created_at: NOW, author_user_id: 1 });
  const b = message({ id: 2, created_at: NOW + 60, author_user_id: 2 });
  assert.equal(continuesBlock(b, a), false);
});

test("the same person speaking for a different clan breaks the block", () => {
  // The dual-admin case: whose behalf they are speaking on is the thing being
  // communicated, so it must never be collapsed away.
  const a = message({ id: 1, created_at: NOW, party_id: 10 });
  const b = message({ id: 2, created_at: NOW + 60, party_id: 42 });
  assert.equal(continuesBlock(b, a), false);
});

test("a long gap breaks the block", () => {
  const a = message({ id: 1, created_at: NOW });
  const b = message({ id: 2, created_at: NOW + 3600 });
  assert.equal(continuesBlock(b, a), false);
});

test("system entries never group", () => {
  const a = message({ id: 1, created_at: NOW });
  const b = message({ id: 2, created_at: NOW + 10, kind: "system" });
  assert.equal(continuesBlock(b, a), false);
  assert.equal(continuesBlock(a, b), false);
});

/* -------------------------------------------------------------------------- */
/* Composer + badges                                                          */
/* -------------------------------------------------------------------------- */

test("an open thread I belong to is writable", () => {
  assert.deepEqual(composerState(thread()), { enabled: true, reason: null });
});

test("a locked thread explains itself", () => {
  const state = composerState(thread({ status: "locked", can_post: false }));
  assert.equal(state.enabled, false);
  assert.match(state.reason!, /closed to new messages/);
});

test("an archived thread explains itself", () => {
  const state = composerState(thread({ status: "archived", can_post: false }));
  assert.equal(state.enabled, false);
  assert.match(state.reason!, /archived/);
});

test("staff reading someone else's thread get a read-only composer", () => {
  const state = composerState(thread({ my_parties: [], is_moderator: true }));
  assert.equal(state.enabled, false);
  assert.match(state.reason!, /as staff/);
});

test("total unread sums across threads and tolerates missing counts", () => {
  assert.equal(totalUnread([thread({ unread: 3 }), thread({ id: 8, unread: 2 })]), 5);
  assert.equal(totalUnread([]), 0);
});
