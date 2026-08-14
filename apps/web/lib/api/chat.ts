import { apiGet, apiSend, withFallback } from "./_client";
import {
  ChatThreadSchema,
  ChatMessageSchema,
  ChatMessagePageSchema,
  type ChatThread,
  type ChatMessage,
  type ChatMessagePage,
  type ChatPartyRef,
} from "@droptracker/api-types";
import { mockChatMessages, mockChatThreads } from "../mock-data";

export const chatApi = {

  // --- Chat (web96a) -------------------------------------------------------
  // A generic threaded-messaging surface. The clan-vs-clan challenge is the
  // only caller today; nothing here is event-specific, so the next surface
  // reuses these as-is.

  /** Threads the caller can speak in, newest activity first. */
  async chatThreads(): Promise<ChatThread[]> {
    return withFallback(
      async () =>
        ChatThreadSchema.array().parse(await apiGet(`/chat/threads`, { authed: true })),
      () => mockChatThreads,
    );
  },

  async chatThread(threadId: number): Promise<ChatThread> {
    return withFallback(
      async () =>
        ChatThreadSchema.parse(await apiGet(`/chat/threads/${threadId}`, { authed: true })),
      () => mockChatThreads[0]!,
    );
  },

  /** One page of a thread, oldest-first. `before` pages backwards. */
  async chatMessages(
    threadId: number,
    opts?: { before?: number; limit?: number },
  ): Promise<ChatMessagePage> {
    const params = new URLSearchParams();
    if (opts?.before) params.set("before", String(opts.before));
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return withFallback(
      async () =>
        ChatMessagePageSchema.parse(
          await apiGet(`/chat/threads/${threadId}/messages${qs ? `?${qs}` : ""}`, {
            authed: true,
          }),
        ),
      () => ({ messages: mockChatMessages, has_more: false }),
    );
  },

  async postChatMessage(
    threadId: number,
    body: { body?: string; attachments?: { key: string }[]; as_party?: ChatPartyRef },
  ): Promise<ChatMessage> {
    // No mock fallback: a composer that silently "succeeds" against mocks
    // teaches the wrong thing about whether a message was really sent.
    return ChatMessageSchema.parse(
      await apiSend("POST", `/chat/threads/${threadId}/messages`, body),
    );
  },

  async markChatRead(
    threadId: number,
    messageId: number,
  ): Promise<{ last_read_message_id: number; unread: number }> {
    return withFallback(
      async () =>
        (await apiSend("POST", `/chat/threads/${threadId}/read`, {
          message_id: messageId,
        })) as { last_read_message_id: number; unread: number },
      () => ({ last_read_message_id: messageId, unread: 0 }),
    );
  },

  /** Staff-only takedown — the only way a message or an uploaded image comes
   * down, since v1 has no author edit/delete. */
  async deleteChatMessage(messageId: number): Promise<{ ok: true }> {
    await apiSend("DELETE", `/chat/messages/${messageId}`, {});
    return { ok: true } as const;
  },

  /** The host↔clan negotiation thread for one clan-vs-clan participant.
   * Get-or-create, so it resolves for invitations sent before chat shipped and
   * for clans that already answered. */
  async eventParticipantThread(eventId: number, groupId: number): Promise<ChatThread> {
    return withFallback(
      async () =>
        ChatThreadSchema.parse(
          await apiGet(`/events/${eventId}/participants/${groupId}/thread`, {
            authed: true,
          }),
        ),
      () => mockChatThreads[0]!,
    );
  },
};
