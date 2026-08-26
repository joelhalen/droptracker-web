/**
 * Delivery wording (web103a) — `lib/chat-delivery.ts`.
 *
 * The whole panel exists to answer "did this reach anyone?", so its strings
 * are load-bearing in a way most UI copy is not:
 *
 * * **Reached is not notified.** Somebody who can read the thread but was
 *   never DM'd (a Discord MANAGE_GUILD-only admin) is the normal case, not a
 *   failure, and must never be described in failure language.
 * * **A party nobody was notifying gets reach language only.** Saying "0 of 3
 *   notified" about the clan that *sent* the message reports a delivery
 *   failure that never happened.
 * * **Redaction still answers the question.** A clan-vs-clan host may not see
 *   the other clan's roster, but "were they told?" is not a secret.
 * * **Problems sort first**, because one bounce in a list of thirty is the
 *   only reason anyone opened the panel.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ChatDelivery, ChatDeliveryParty, ChatRecipient } from "@droptracker/api-types";
import {
  deliveryChips,
  deliveryHeadline,
  hasDeliveryDetail,
  orderedParties,
  orderedRecipients,
  partyLabel,
  partySummary,
  recipientDetail,
  recipientStatus,
  redactedSummary,
} from "@/lib/chat-delivery";

function recipient(over: Partial<ChatRecipient> = {}): ChatRecipient {
  return {
    user_id: 1,
    name: "zezima",
    discord_id: "100",
    role: "admin",
    delivery: "sent",
    at: 1,
    error: null,
    attempts: 1,
    ...over,
  };
}

function party(over: Partial<ChatDeliveryParty> = {}): ChatDeliveryParty {
  return {
    party_type: "group",
    party_id: 101,
    name: "Clan 1",
    role: "member",
    visible: true,
    dm_target: true,
    counts: { reached: 1, sent: 1, failed: 0, pending: 0, missed: 0 },
    recipients: [recipient()],
    hidden: 0,
    ...over,
  };
}

function delivery(over: Partial<ChatDelivery> = {}): ChatDelivery {
  return {
    thread_id: 1,
    kind: "group_notice",
    dm_expected: true,
    parties: [party()],
    others: [],
    others_count: 0,
    counts: { reached: 1, sent: 1, failed: 0, pending: 0, missed: 0 },
    ...over,
  };
}

/* -- recipient status ------------------------------------------------------ */

test("a recipient with no DM is stated as fact, not as an error", () => {
  const status = recipientStatus(recipient({ delivery: "none" }));
  assert.equal(status.label, "No DM sent");
  assert.equal(status.tone, "neutral");
});

test("each delivery state gets its own tone", () => {
  assert.equal(recipientStatus(recipient({ delivery: "sent" })).tone, "green");
  assert.equal(recipientStatus(recipient({ delivery: "failed" })).tone, "red");
  assert.equal(recipientStatus(recipient({ delivery: "pending" })).tone, "sky");
});

test("a bounce shows Discord's own reason", () => {
  const detail = recipientDetail(
    recipient({ delivery: "failed", error: "Cannot send messages to this user" }),
  );
  assert.equal(detail, "Cannot send messages to this user");
});

test("a bounce with no reason still says something", () => {
  assert.equal(
    recipientDetail(recipient({ delivery: "failed", error: null })),
    "Discord rejected the message.",
  );
});

test("an unmessaged recipient is told apart from an unmessageable one", () => {
  assert.match(
    recipientDetail(recipient({ delivery: "none", discord_id: "100" })) ?? "",
    /No notification was queued/,
  );
  assert.match(
    recipientDetail(recipient({ delivery: "none", discord_id: null })) ?? "",
    /No linked Discord account/,
  );
});

test("a delivered recipient needs no explanation", () => {
  assert.equal(recipientDetail(recipient({ delivery: "sent" })), null);
});

/* -- headline -------------------------------------------------------------- */

test("the headline leads with how many people were notified", () => {
  const d = delivery({
    counts: { reached: 5, sent: 3, failed: 1, pending: 0, missed: 1 },
  });
  assert.equal(deliveryHeadline(d), "Notified 3 people");
});

test("one person is not '1 people'", () => {
  const d = delivery({ counts: { reached: 1, sent: 1, failed: 0, pending: 0, missed: 0 } });
  assert.equal(deliveryHeadline(d), "Notified 1 person");
});

test("a queue that hasn't drained yet reads as in-progress, not as failure", () => {
  const d = delivery({ counts: { reached: 2, sent: 0, failed: 0, pending: 2, missed: 0 } });
  assert.equal(deliveryHeadline(d), "Notifying 2 people…");
});

test("an all-bounced fan-out says so instead of claiming zero notified", () => {
  const d = delivery({ counts: { reached: 2, sent: 0, failed: 2, pending: 0, missed: 0 } });
  assert.equal(deliveryHeadline(d), "2 notifications bounced");
});

test("a kind with no fan-out talks about visibility, never delivery", () => {
  const d = delivery({
    dm_expected: false,
    counts: { reached: 4, sent: 0, failed: 0, pending: 0, missed: 0 },
  });
  assert.equal(deliveryHeadline(d), "Visible to 4 people");
});

test("nothing sent and nothing queued is stated plainly", () => {
  const d = delivery({ counts: { reached: 3, sent: 0, failed: 0, pending: 0, missed: 3 } });
  assert.equal(deliveryHeadline(d), "Nobody was notified");
});

/* -- chips ----------------------------------------------------------------- */

test("a clean delivery carries no chips at all", () => {
  assert.deepEqual(deliveryChips(delivery()), []);
});

test("chips name only the problems", () => {
  const d = delivery({
    counts: { reached: 6, sent: 3, failed: 1, pending: 1, missed: 1 },
  });
  assert.deepEqual(
    deliveryChips(d).map((c) => c.label),
    ["1 bounced", "1 queued", "1 not messaged"],
  );
});

test("a wholly pending fan-out doesn't repeat itself in a chip", () => {
  // The headline already says "Notifying 2 people…"; a "2 queued" chip beside
  // it is the same sentence twice.
  const d = delivery({ counts: { reached: 2, sent: 0, failed: 0, pending: 2, missed: 0 } });
  assert.deepEqual(deliveryChips(d), []);
});

/* -- parties --------------------------------------------------------------- */

test("the party being notified is listed above the one that sent it", () => {
  const d = delivery({
    parties: [
      party({ party_id: 10, name: "Iron Wolves", dm_target: false }),
      party({ party_id: 101, name: "Clan 1", dm_target: true }),
    ],
  });
  assert.deepEqual(
    orderedParties(d).map((p) => p.name),
    ["Clan 1", "Iron Wolves"],
  );
});

test("a party nobody was notifying gets reach language, not a 0-of-N score", () => {
  const p = party({
    dm_target: false,
    counts: { reached: 3, sent: 0, failed: 0, pending: 0, missed: 0 },
  });
  assert.equal(partySummary(p), "3 people can see this");
});

test("a notified party is scored against everyone it reaches", () => {
  const p = party({
    dm_target: true,
    counts: { reached: 5, sent: 3, failed: 1, pending: 0, missed: 1 },
  });
  assert.equal(partySummary(p), "3 of 5 notified");
});

test("a redacted party still answers whether they were told", () => {
  const p = party({
    visible: false,
    counts: { reached: 5, sent: 3, failed: 0, pending: 0, missed: 2 },
  });
  const summary = redactedSummary(p);
  assert.match(summary, /3 of 5 notified/);
  assert.match(summary, /names are only shown/);
});

test("a nameless party is still identifiable", () => {
  assert.equal(partyLabel(party({ name: null })), "Clan #101");
  assert.equal(partyLabel(party({ name: null, party_type: "user", party_id: 7 })), "User #7");
});

/* -- recipient ordering ---------------------------------------------------- */

test("problems come first so a single bounce isn't buried", () => {
  const p = party({
    recipients: [
      recipient({ user_id: 1, name: "delivered", delivery: "sent" }),
      recipient({ user_id: 2, name: "unmessaged", delivery: "none" }),
      recipient({ user_id: 3, name: "bounced", delivery: "failed" }),
      recipient({ user_id: 4, name: "queued", delivery: "pending" }),
    ],
  });
  assert.deepEqual(
    orderedRecipients(p).map((r) => r.name),
    ["bounced", "queued", "unmessaged", "delivered"],
  );
});

test("ordering is stable within a state, so the backend's role order survives", () => {
  const p = party({
    recipients: [
      recipient({ user_id: 1, name: "owner", role: "owner", delivery: "sent" }),
      recipient({ user_id: 2, name: "admin", role: "admin", delivery: "sent" }),
    ],
  });
  assert.deepEqual(
    orderedRecipients(p).map((r) => r.name),
    ["owner", "admin"],
  );
});

test("ordering does not mutate the payload", () => {
  const p = party({
    recipients: [
      recipient({ user_id: 1, name: "sent", delivery: "sent" }),
      recipient({ user_id: 2, name: "failed", delivery: "failed" }),
    ],
  });
  orderedRecipients(p);
  assert.deepEqual(
    p.recipients.map((r) => r.name),
    ["sent", "failed"],
  );
});

/* -- disclosure gate ------------------------------------------------------- */

test("an empty delivery grows no disclosure", () => {
  assert.equal(hasDeliveryDetail(null), false);
  assert.equal(hasDeliveryDetail(delivery({ parties: [], others: [] })), false);
  assert.equal(hasDeliveryDetail(delivery()), true);
});
