"use client";

/**
 * A live chat thread (web96a).
 *
 * Generic by construction: its props are a thread and its first page of
 * messages, and it knows nothing about events. The clan-vs-clan challenge is
 * the first surface to mount it; the next one drops it in unchanged.
 *
 * Realtime rides the existing SSE plumbing — `useEventStream` on the
 * `chat:{id}` scope, which the Web API gates on the same membership check that
 * guards the HTTP routes. No new transport, no polling.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ChatMessage, ChatThread } from "@droptracker/api-types";
import { CHAT_BODY_MAX_CHARS, CHAT_MAX_ATTACHMENTS } from "@droptracker/api-types";
import {
  composerState,
  counterpartyLabel,
  mergeMessage,
  mergeOlderPage,
  newestMessageId,
  startsNewDay,
} from "@/lib/chat";
import { getErrorMessage } from "@/lib/errors";
import { useEventStream } from "@/lib/use-event-stream";
import {
  deleteChatMessage,
  loadChatMessages,
  markChatThreadRead,
  sendChatMessage,
} from "@/app/(site)/chat-actions";
import { ChatMessageRow } from "@/components/chat/chat-message-row";
import { MAX_PROOF_BYTES, PROOF_ACCEPT, uploadProofViaBff } from "@/components/proof-attach";
import { Alert, Button } from "@/components/ui";
import { LocalTime } from "@/components/local-time";

type PendingAttachment = { key: string; url: string; name: string };

/** The header's live/connecting indicator, exported so a surface that hides
 * the built-in header (the support widget) can draw its own — sharing the same
 * `chat:{id}` stream via the refcounted `useEventStream` registry. */
export function ChatLiveDot({ state }: { state: "connecting" | "open" | "closed" }) {
  return (
    <span
      className={`shrink-0 text-xs ${
        state === "open" ? "text-osrs-green" : "text-osrs-parchment-dark/50"
      }`}
      title={
        state === "open"
          ? "Live — new messages appear instantly"
          : "Reconnecting; reload if this persists"
      }
    >
      {state === "open" ? "● Live" : "○ Connecting"}
    </span>
  );
}

export function ChatThreadPanel({
  thread,
  initialMessages,
  initialHasMore = false,
  heading,
  className = "",
  hideHeader = false,
  scrollerClassName = "max-h-[28rem] min-h-[16rem]",
}: {
  thread: ChatThread;
  initialMessages: ChatMessage[];
  initialHasMore?: boolean;
  /** Overrides the derived "conversation with X" title. */
  heading?: string;
  className?: string;
  /** The support widget draws its own header (title + ChatLiveDot). */
  hideHeader?: boolean;
  /** Sizing for the message scroller — the default caps the standalone panel;
   * a flex host passes e.g. `min-h-0 flex-1` to fill itself instead. */
  scrollerClassName?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, startSending] = useTransition();
  const [loadingOlder, startLoadingOlder] = useTransition();

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // The read pointer we last told the server about, so a burst of frames
  // doesn't fire a POST each.
  const reportedRead = useRef(thread.last_read_message_id ?? 0);

  const composer = composerState(thread);
  const title = heading ?? `Conversation with ${counterpartyLabel(thread)}`;

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  // --- live frames --------------------------------------------------------
  const channels = useMemo(() => [`chat:${thread.id}`], [thread.id]);
  const { state: streamState } = useEventStream(channels, (event) => {
    if (event.type !== "chat_message") return;
    const incoming = event.data as unknown as ChatMessage;
    if (!incoming || typeof incoming.id !== "number") return;
    if (incoming.thread_id !== thread.id) return;
    setMessages((prev) => mergeMessage(prev, incoming));
  });

  // Scroll and clear the badge whenever the tail moves.
  const newestId = newestMessageId(messages);
  useEffect(() => {
    scrollToBottom();
    if (newestId > reportedRead.current) {
      reportedRead.current = newestId;
      void markChatThreadRead(thread.id, newestId).catch(() => {
        // A failed read receipt is cosmetic — the badge simply stays until the
        // next successful one. Never surface it as a chat error.
      });
    }
  }, [newestId, thread.id, scrollToBottom]);

  // --- actions ------------------------------------------------------------
  const loadOlder = () => {
    const oldest = messages[0]?.id;
    if (!oldest) return;
    startLoadingOlder(async () => {
      try {
        const page = await loadChatMessages(thread.id, { before: oldest });
        setMessages((prev) => mergeOlderPage(prev, page.messages));
        setHasMore(page.has_more);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't load earlier messages."));
      }
    });
  };

  const pickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const room = CHAT_MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      setError(`You can attach at most ${CHAT_MAX_ATTACHMENTS} images per message.`);
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, room)) {
        if (file.size > MAX_PROOF_BYTES) {
          throw new Error(`${file.name} is larger than 10 MB.`);
        }
        // Two-step, same contract as proof screenshots: the bytes go to
        // storage first and only the returned KEY is posted, so a client can
        // never point a message at an arbitrary remote image.
        const uploaded = await uploadProofViaBff(file);
        setAttachments((prev) => [
          ...prev,
          { key: uploaded.key, url: uploaded.public_url, name: file.name },
        ]);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't upload that image."));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const send = () => {
    const body = draft.trim();
    if (!body && !attachments.length) return;
    setError(null);
    startSending(async () => {
      try {
        const posted = await sendChatMessage(thread.id, {
          body: body || undefined,
          attachments: attachments.map((a) => ({ key: a.key })),
          asParty: thread.my_parties[0],
        });
        // The SSE frame for our own message is suppressed server-side (the
        // author is excluded from the fan-out), so append it here. mergeMessage
        // is id-keyed anyway, so a duplicate would be harmless.
        setMessages((prev) => mergeMessage(prev, posted));
        setDraft("");
        setAttachments([]);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't send that message."));
      }
    });
  };

  const remove = (messageId: number) => {
    startSending(async () => {
      try {
        await deleteChatMessage(messageId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, deleted: true, body: null, attachments: [] } : m,
          ),
        );
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't remove that message."));
      }
    });
  };

  const overLimit = draft.length > CHAT_BODY_MAX_CHARS;
  const busy = sending || uploading;

  return (
    <section
      className={`border-osrs-bronze/25 bg-osrs-brown-dark/20 flex flex-col rounded border ${className}`}
    >
      {!hideHeader && (
        <header className="border-osrs-bronze/25 flex items-center justify-between gap-3 border-b px-4 py-2">
          <h2 className="text-osrs-gold min-w-0 truncate text-sm font-semibold">{title}</h2>
          <ChatLiveDot state={streamState} />
        </header>
      )}

      <div className={`overflow-y-auto px-4 py-2 ${scrollerClassName}`}>
        {hasMore && (
          <div className="flex justify-center py-2">
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="text-osrs-gold-bright text-xs hover:underline disabled:opacity-50"
            >
              {loadingOlder ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        )}

        {messages.length === 0 ? (
          <p className="text-osrs-parchment-dark/60 py-8 text-center text-sm">
            No messages yet. Say hello — the other clan&apos;s leaders will see it straight away.
          </p>
        ) : (
          <ul>
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              return (
                <div key={message.id}>
                  {startsNewDay(message, previous) && message.created_at != null && (
                    <li className="my-3 flex items-center gap-3">
                      <span className="bg-osrs-bronze/20 h-px flex-1" />
                      <span className="text-osrs-parchment-dark/50 text-[11px]">
                        <LocalTime unix={message.created_at} mode="date" />
                      </span>
                      <span className="bg-osrs-bronze/20 h-px flex-1" />
                    </li>
                  )}
                  <ChatMessageRow
                    message={message}
                    previous={previous}
                    thread={thread}
                    canModerate={thread.is_moderator}
                    onDelete={remove}
                  />
                </div>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-osrs-bronze/25 border-t px-4 py-3">
        {error && <Alert variant="error">{error}</Alert>}

        {!composer.enabled ? (
          <p className="text-osrs-parchment-dark/60 text-xs">{composer.reason}</p>
        ) : (
          <>
            {attachments.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <li key={att.key} className="relative">
                    <img
                      src={att.url}
                      alt={att.name}
                      className="border-osrs-bronze/30 h-14 w-14 rounded border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((prev) => prev.filter((a) => a.key !== att.key))
                      }
                      className="bg-osrs-brown-dark text-osrs-parchment absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full text-xs leading-none"
                      aria-label={`Remove ${att.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends, Shift+Enter breaks the line.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!busy && !overLimit) send();
                  }
                }}
                rows={2}
                placeholder="Write a message…"
                disabled={busy}
                className="border-osrs-bronze/30 bg-osrs-brown-dark/40 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 focus:border-osrs-gold/50 min-w-0 flex-1 resize-y rounded border px-3 py-2 text-sm outline-none disabled:opacity-50"
              />
              <div className="flex shrink-0 flex-col gap-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept={PROOF_ACCEPT}
                  multiple
                  className="hidden"
                  onChange={(e) => void pickFiles(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy || attachments.length >= CHAT_MAX_ATTACHMENTS}
                  className="border-osrs-bronze/30 text-osrs-parchment-dark/80 hover:border-osrs-gold/50 rounded border px-2 py-1 text-xs disabled:opacity-40"
                  title="Attach an image"
                >
                  {uploading ? "…" : "📎"}
                </button>
                <Button
                  variant="secondary"
                  size="xs"
                  className="px-3"
                  onClick={send}
                  disabled={busy || overLimit || (!draft.trim() && !attachments.length)}
                >
                  {sending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>

            {overLimit && (
              <p className="text-osrs-red mt-1 text-xs">
                {draft.length} / {CHAT_BODY_MAX_CHARS} characters — too long to send.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
