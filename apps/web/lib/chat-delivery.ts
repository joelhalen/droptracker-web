/**
 * Pure shaping for the "who got this?" panel (web103a).
 *
 * A relayed thread — a group notice, a clan challenge — is written once and
 * fanned out to people who never open the site. Administrators kept asking two
 * questions the UI could not answer: which clan is this about, and who
 * actually received it. The backend answers both
 * (`GET /chat/threads/{id}/delivery`); this module turns that payload into
 * words.
 *
 * The wording carries a distinction that is easy to lose and expensive to get
 * wrong: **reached** is who can read the thread on the site, **notified** is
 * who the bot DM'd. Somebody reached but not notified is the normal state for
 * a Discord MANAGE_GUILD-only admin, not a failure — so they are never
 * described in failure language.
 *
 * Kept out of JSX per the repo rule, and because these are the strings most
 * likely to be re-argued.
 */
import type { ChatDelivery, ChatDeliveryParty, ChatRecipient } from "@droptracker/api-types";

import type { InboxBadgeTone } from "./chat-widget";

export interface DeliveryChip {
  label: string;
  tone: InboxBadgeTone;
}

function people(n: number): string {
  return n === 1 ? "1 person" : `${n} people`;
}

/** Per-recipient status. `none` deliberately reads as a statement of fact
 * ("no DM sent") rather than as an error — nothing went wrong. */
export function recipientStatus(recipient: ChatRecipient): DeliveryChip {
  switch (recipient.delivery) {
    case "sent":
      return { label: "Delivered", tone: "green" };
    case "failed":
      return { label: "Bounced", tone: "red" };
    case "pending":
      return { label: "Queued", tone: "sky" };
    default:
      return { label: "No DM sent", tone: "neutral" };
  }
}

/** Why a DM bounced, in one line. Discord's own text is the most useful thing
 * we have, so it is passed through rather than mapped to our own vocabulary. */
export function recipientDetail(recipient: ChatRecipient): string | null {
  if (recipient.delivery === "failed") {
    return recipient.error?.trim() || "Discord rejected the message.";
  }
  if (recipient.delivery === "none") {
    return recipient.discord_id
      ? "No notification was queued for them."
      : "No linked Discord account to message.";
  }
  return null;
}

/** The collapsed one-liner. This is the only part most readers ever see, so it
 * answers the question directly instead of listing every number. */
export function deliveryHeadline(delivery: ChatDelivery): string {
  const { reached, sent, failed, pending } = delivery.counts;
  if (!delivery.dm_expected) {
    return reached ? `Visible to ${people(reached)}` : "Nobody can see this yet";
  }
  if (sent > 0) return `Notified ${people(sent)}`;
  if (pending > 0) return `Notifying ${people(pending)}…`;
  if (failed > 0) return failed === 1 ? "1 notification bounced" : `${failed} notifications bounced`;
  return "Nobody was notified";
}

/** The qualifiers that belong beside the headline. Only the ones that are
 * non-zero, so a clean delivery renders as a single unadorned line. */
export function deliveryChips(delivery: ChatDelivery): DeliveryChip[] {
  const { failed, pending, missed } = delivery.counts;
  const chips: DeliveryChip[] = [];
  if (failed > 0) chips.push({ label: `${failed} bounced`, tone: "red" });
  if (pending > 0 && delivery.counts.sent > 0)
    chips.push({ label: `${pending} queued`, tone: "sky" });
  if (missed > 0) chips.push({ label: `${missed} not messaged`, tone: "neutral" });
  return chips;
}

/** Parties in the order they are worth reading: whoever was being notified
 * first, then by name. On a clan challenge that puts the challenged clan —
 * the side the question is actually about — above the host. */
export function orderedParties(delivery: ChatDelivery): ChatDeliveryParty[] {
  return [...delivery.parties].sort((a, b) => {
    if (a.dm_target !== b.dm_target) return a.dm_target ? -1 : 1;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}

export function partyLabel(party: ChatDeliveryParty): string {
  if (party.name) return party.name;
  return party.party_type === "group" ? `Clan #${party.party_id}` : `User #${party.party_id}`;
}

/** One line under a party heading. A party nobody was notifying gets reach
 * language only — saying "0 of 3 notified" about the clan that sent the
 * message would report a failure that never happened. */
export function partySummary(party: ChatDeliveryParty): string {
  const { reached, sent } = party.counts;
  if (!party.dm_target) {
    return reached ? `${people(reached)} can see this` : "Nobody can see this";
  }
  if (!reached) return "No recipients";
  return `${sent} of ${reached} notified`;
}

/** What a redacted party may still be told. Names are withheld from other
 * clans, but "were they told?" is not a secret worth keeping. */
export function redactedSummary(party: ChatDeliveryParty): string {
  return `${partySummary(party)} — names are only shown to that clan's own admins`;
}

/** Recipients in the order an administrator scans them: problems first, then
 * by role, so a single bounce in a list of thirty is not something you have to
 * hunt for. Backend order (role, then name) is the tiebreak, so this is a
 * stable partition rather than a re-sort. */
const TROUBLE_FIRST: Record<ChatRecipient["delivery"], number> = {
  failed: 0,
  pending: 1,
  none: 2,
  sent: 3,
};

export function orderedRecipients(party: ChatDeliveryParty): ChatRecipient[] {
  return [...party.recipients].sort(
    (a, b) => TROUBLE_FIRST[a.delivery] - TROUBLE_FIRST[b.delivery],
  );
}

/** Whether the panel has anything worth opening. A thread with no parties and
 * no delivery record should not grow a disclosure that expands into nothing. */
export function hasDeliveryDetail(delivery: ChatDelivery | null | undefined): boolean {
  if (!delivery) return false;
  return delivery.parties.length > 0 || delivery.others.length > 0;
}
