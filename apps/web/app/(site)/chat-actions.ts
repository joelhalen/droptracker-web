"use server";

/**
 * Server actions for the chat subsystem (web96a).
 *
 * The browser cannot reach `lib/api.ts` (it holds the session and talks to the
 * internal Web API), so the thread UI drives these instead. They live at the
 * `(site)` root rather than under the events admin tree because chat is
 * deliberately generic — the clan-vs-clan challenge is its first surface, not
 * its owner.
 *
 * These are thin: every access decision is the backend's, made from the
 * thread's own participant list. Re-deriving "may this person post here?" in
 * two places is exactly how the two answers drift apart, so this file does not
 * try.
 */
import type { ChatMessage, ChatMessagePage, ChatPartyRef } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

/**
 * Cheap "is there a session?" gate. Deliberately NOT `requireUser`, which
 * redirects to OAuth — a redirect out of a fetch-driven action lands as an
 * opaque failure in the composer rather than a sign-in page. The real
 * authorization is the backend's, from the thread's participant list.
 */
async function assertSignedIn() {
  const user = await getUser();
  if (!user) throw new Error("Sign in to use chat.");
  return user;
}

/** One page of a thread, oldest-first. `before` pages backwards through it. */
export async function loadChatMessages(
  threadId: number,
  opts?: { before?: number; limit?: number },
): Promise<ChatMessagePage> {
  await assertSignedIn();
  return api.chatMessages(threadId, opts);
}

export async function sendChatMessage(
  threadId: number,
  input: { body?: string; attachments?: { key: string }[]; asParty?: ChatPartyRef },
): Promise<ChatMessage> {
  await assertSignedIn();
  return api.postChatMessage(threadId, {
    body: input.body,
    attachments: input.attachments,
    as_party: input.asParty,
  });
}

export async function markChatThreadRead(
  threadId: number,
  messageId: number,
): Promise<{ last_read_message_id: number; unread: number }> {
  await assertSignedIn();
  return api.markChatRead(threadId, messageId);
}

/** Staff takedown — the only removal path, since authors cannot edit or delete
 * their own messages in v1. The backend enforces the superadmin check. */
export async function deleteChatMessage(messageId: number): Promise<{ ok: true }> {
  await assertSignedIn();
  return api.deleteChatMessage(messageId);
}
