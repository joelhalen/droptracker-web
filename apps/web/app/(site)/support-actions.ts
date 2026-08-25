"use server";

/**
 * Server actions for the support widget (web102a).
 *
 * The widget is a client island (the browser cannot reach `lib/api`, which
 * holds the session and talks to the internal Web API), so its inbox, ticket
 * and suggestion views drive these. They live at the `(site)` root beside
 * `chat-actions.ts` because the widget federates several subsystems — it isn't
 * owned by any one page tree.
 *
 * These are thin on purpose: every access decision (participant checks, the
 * one-open-ticket rule, status gating) is the backend's. Re-deriving those
 * rules here is exactly how two answers drift apart.
 */
import {
  StaffChatCreateSchema,
  TicketCreateSchema,
  TicketReplyCreateSchema,
  type AttachmentKey,
  type ChatThread,
  type GroupNotice,
  type GroupNoticePage,
  type Inbox,
  type InboxReadAll,
  type StaffChatCreate,
  type StaffChatKind,
  type StaffChatsPage,
  type StaffUserHit,
  type SuggestionDetail,
  type TicketCreate,
  type TicketDetail,
  type TicketMessage,
} from "@droptracker/api-types";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

/**
 * Cheap "is there a session?" gate. Deliberately NOT `requireUser`, which
 * redirects to OAuth — a redirect out of a fetch-driven action lands as an
 * opaque failure in the widget rather than a sign-in page. The real
 * authorization is the backend's.
 */
async function assertSignedIn() {
  const user = await getUser();
  if (!user) throw new Error("Sign in to use support.");
  return user;
}

/** The unified inbox: chat threads + tickets + suggestions, each with unread. */
export async function loadInbox(): Promise<Inbox> {
  await assertSignedIn();
  return api.myInbox();
}

/**
 * Mark the whole inbox read in one go — every chat thread, ticket and
 * suggestion. This is the "reset the counter" escape hatch: somebody who is
 * never going to read a three-month-old notice thread should be able to make
 * the badge stop shouting without opening each row. Read pointers move
 * server-side, so it sticks across devices.
 */
export async function markAllRead(): Promise<InboxReadAll> {
  await assertSignedIn();
  return api.markAllInboxRead();
}

export async function loadTicket(ticketId: number): Promise<TicketDetail> {
  await assertSignedIn();
  return api.ticket(ticketId);
}

/** Open a ticket from the web. Returns the full detail (status `pending` until
 * the bot provisions its Discord channel). The backend 409s a second open
 * ticket; the widget's CTA gating makes that a rare race, not the normal path. */
export async function createTicket(input: TicketCreate): Promise<TicketDetail> {
  const parsed = TicketCreateSchema.parse(input);
  await assertSignedIn();
  return api.createTicket(parsed);
}

/**
 * Reply on an open ticket; the bot relays it into the Discord channel.
 *
 * `attachments` are upload KEYS from `POST /api/uploads/proof` (max 4) — the
 * same two-step contract chat uses, so the backend re-derives every URL and a
 * client can never attach an arbitrary remote image. A reply may be images
 * only; the schema rejects a wholly empty one.
 */
export async function replyToTicket(
  ticketId: number,
  content: string,
  attachments: AttachmentKey[] = [],
): Promise<TicketMessage> {
  const parsed = TicketReplyCreateSchema.parse({
    content,
    ...(attachments.length ? { attachments } : {}),
  });
  await assertSignedIn();
  return api.ticketReply(ticketId, parsed);
}

/** Advance the viewer's ticket read pointer (advance-only server-side). */
export async function markTicketRead(
  ticketId: number,
  messageId: number,
): Promise<{ last_read_message_id: number; unread: number }> {
  await assertSignedIn();
  return api.markTicketRead(ticketId, messageId);
}

export async function loadSuggestion(suggestionId: number): Promise<SuggestionDetail> {
  await assertSignedIn();
  return api.suggestion(suggestionId);
}

/** Advance the viewer's suggestion read pointer (advance-only server-side). */
export async function markSuggestionRead(
  suggestionId: number,
  messageId: number,
): Promise<{ last_read_message_id: number; unread: number }> {
  await assertSignedIn();
  return api.markSuggestionRead(suggestionId, messageId);
}

// --- Staff surfaces (web102a phases 3–4) -----------------------------------
// assertSignedIn is enough client-side: every route below re-checks
// developer/superadmin on the backend and fails closed.

export async function searchStaffUsers(q: string): Promise<StaffUserHit[]> {
  await assertSignedIn();
  return (await api.staffUserSearch(q)).items;
}

/** Open (or reopen) a user's staff_dm thread with an opening message. */
export async function startStaffChat(input: StaffChatCreate): Promise<ChatThread> {
  const parsed = StaffChatCreateSchema.parse(input);
  await assertSignedIn();
  return api.createStaffChat(parsed);
}

/** Staff thread index. `kind` defaults to `staff_dm` (the "Message a user"
 * view); `event_invite` powers the clan-chats console. */
export async function loadStaffChats(
  params: { kind?: StaffChatKind; page?: number; limit?: number } = {},
): Promise<StaffChatsPage> {
  await assertSignedIn();
  return api.staffChats(params);
}

export async function loadGroupNotices(
  params: { status?: "open" | "resolved"; code?: string; group_id?: number; page?: number } = {},
): Promise<GroupNoticePage> {
  await assertSignedIn();
  return api.groupNotices(params);
}

export async function resolveGroupNotice(noticeId: number, note?: string): Promise<GroupNotice> {
  await assertSignedIn();
  return api.resolveGroupNotice(noticeId, note);
}
