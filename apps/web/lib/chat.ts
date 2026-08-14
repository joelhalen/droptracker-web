/**
 * Pure shaping logic for chat threads (web96a).
 *
 * Kept out of the components on purpose (repo rule: logic in `lib`, not JSX) so
 * the things that are easy to get subtly wrong — whose "side" a message is on,
 * what a system entry actually says, when a date separator belongs — are unit
 * tested rather than eyeballed.
 *
 * Nothing here knows about events. The clan-vs-clan challenge is the first
 * surface for this subsystem, not its definition.
 */
import type { ChatMessage, ChatPartyRef, ChatThread } from "@droptracker/api-types";

/** Which side of the conversation a message belongs to, from the viewer's seat. */
export type MessageSide = "mine" | "theirs" | "system";

export function messageSide(message: ChatMessage, myParties: ChatPartyRef[]): MessageSide {
  if (message.kind === "system") return "system";
  const mine = myParties.some(
    (p) => p.party_type === message.party_type && p.party_id === message.party_id,
  );
  return mine ? "mine" : "theirs";
}

/** Display name for whoever spoke, preferring the party (the clan) over the
 * individual — in an inter-clan negotiation "Iron Wolves" is the useful
 * attribution and the person is secondary. */
export function speakerLabel(message: ChatMessage, thread: ChatThread): string {
  const party = thread.participants.find(
    (p) => p.party_type === message.party_type && p.party_id === message.party_id,
  );
  const partyName = party?.name;
  const author = message.author_name;
  if (partyName && author) return `${partyName} · ${author}`;
  return partyName ?? author ?? "Unknown";
}

/** The other side(s) of the thread — who the viewer is talking to. */
export function counterparties(thread: ChatThread): ChatPartyRef[] {
  return thread.participants.filter(
    (p) =>
      !thread.my_parties.some(
        (mine) => mine.party_type === p.party_type && mine.party_id === p.party_id,
      ),
  );
}

export function counterpartyLabel(thread: ChatThread): string {
  const others = counterparties(thread);
  if (!others.length) return thread.title ?? "Conversation";
  return others.map((p) => p.name ?? `#${p.party_id}`).join(", ");
}

/**
 * Human wording for a system entry. The backend stores only a code plus the
 * nouns, so rephrasing any of these never touches a stored row.
 */
export function systemText(message: ChatMessage): string {
  const data = (message.system_data ?? {}) as Record<string, unknown>;
  const host = str(data.host_group_name) ?? "The host clan";
  const invited = str(data.invited_group_name) ?? "the invited clan";
  const event = str(data.event_name) ?? "the event";

  switch (message.system_code) {
    case "invite_sent":
      return `${host} invited ${invited} to ${event}.`;
    case "invite_accepted":
      return `${invited} accepted the challenge.`;
    case "invite_declined":
      return `${invited} declined the challenge.`;
    case "invite_withdrawn":
      return `${invited} was removed from ${event}.`;
    case "event_activated":
      return `${event} is now live.`;
    case "event_ended":
      return `${event} has ended.`;
    default:
      return "Something changed on this event.";
  }
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** Newest message id in a page, or 0 — what the read-pointer POST sends. */
export function newestMessageId(messages: ChatMessage[]): number {
  return messages.reduce((max, m) => (m.id > max ? m.id : max), 0);
}

/**
 * Insert the given message into an already-sorted list, ignoring duplicates.
 *
 * Live SSE frames and the POST response race: posting a message shows it
 * immediately AND the stream may deliver the same row. Keyed by id so it
 * lands once either way, and re-sorted because a slow frame can arrive after
 * a newer one.
 */
export function mergeMessage(messages: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const index = messages.findIndex((m) => m.id === incoming.id);
  if (index >= 0) {
    const next = messages.slice();
    next[index] = incoming;
    return next;
  }
  return [...messages, incoming].sort((a, b) => a.id - b.id);
}

/** Prepend an older page, dropping anything already present. */
export function mergeOlderPage(
  messages: ChatMessage[],
  older: ChatMessage[],
): ChatMessage[] {
  const have = new Set(messages.map((m) => m.id));
  const fresh = older.filter((m) => !have.has(m.id));
  return [...fresh, ...messages].sort((a, b) => a.id - b.id);
}

/**
 * Whether a date separator belongs above `message`.
 *
 * Compared in the VIEWER's local timezone, which is the only one they can
 * reason about; both clans see their own day boundaries.
 */
export function startsNewDay(message: ChatMessage, previous?: ChatMessage): boolean {
  if (!message.created_at) return false;
  if (!previous?.created_at) return true;
  const a = new Date(message.created_at * 1000);
  const b = new Date(previous.created_at * 1000);
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  );
}

/**
 * Whether two consecutive messages should render as one visual block (avatar
 * and speaker shown once). Same speaker, same side, within five minutes.
 */
const GROUPING_WINDOW_SECONDS = 300;

export function continuesBlock(message: ChatMessage, previous?: ChatMessage): boolean {
  if (!previous) return false;
  if (message.kind === "system" || previous.kind === "system") return false;
  if (message.author_user_id !== previous.author_user_id) return false;
  if (message.party_id !== previous.party_id) return false;
  if (startsNewDay(message, previous)) return false;
  if (!message.created_at || !previous.created_at) return false;
  return message.created_at - previous.created_at <= GROUPING_WINDOW_SECONDS;
}

/** Unread count across every thread — the shape a header badge would want. */
export function totalUnread(threads: ChatThread[]): number {
  return threads.reduce((sum, t) => sum + (t.unread ?? 0), 0);
}

/** Whether the composer should be enabled, and why not when it shouldn't be. */
export function composerState(thread: ChatThread): {
  enabled: boolean;
  reason: string | null;
} {
  if (!thread.my_parties.length) {
    return { enabled: false, reason: "You're viewing this conversation as staff." };
  }
  if (thread.status === "archived") {
    return { enabled: false, reason: "This conversation has been archived." };
  }
  if (!thread.can_post) {
    return { enabled: false, reason: "This conversation is closed to new messages." };
  }
  return { enabled: true, reason: null };
}
