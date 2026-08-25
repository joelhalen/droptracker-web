"use client";

/**
 * A chat thread inside the widget: loads the thread + first page via server
 * actions, then mounts the existing `ChatThreadPanel` with its built-in header
 * hidden — the widget draws a slim strip (counterparty/status + live dot)
 * instead. The live dot subscribes to the SAME `chat:{id}` key as the panel,
 * so the shared registry keeps one EventSource between them.
 */
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChatMessagePage, ChatThread } from "@droptracker/api-types";
import { loadChatMessages, loadChatThread } from "@/app/(site)/chat-actions";
import { ChatLiveDot, ChatThreadPanel } from "@/components/chat/chat-thread";
import { Alert, SkeletonRows } from "@/components/ui";
import { counterpartyLabel } from "@/lib/chat";
import { getErrorMessage } from "@/lib/errors";
import { useEventStream } from "@/lib/use-event-stream";
import { useChatWidget } from "./widget-context";

export function ChatView({ threadId }: { threadId: number }) {
  const { clearUnread, hint } = useChatWidget();
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [page, setPage] = useState<ChatMessagePage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setThread(null);
    setPage(null);
    setError(null);
    Promise.all([loadChatThread(threadId), loadChatMessages(threadId)])
      .then(([t, p]) => {
        if (!active) return;
        setThread(t);
        setPage(p);
        // The panel reports the read pointer server-side; mirror it locally so
        // the badge drops without waiting for a refetch.
        clearUnread("chat", threadId);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err, "Couldn't load this conversation."));
      });
    return () => {
      active = false;
    };
  }, [threadId, clearUnread]);

  // While this thread is on screen, its frames land in the panel — keep the
  // inbox row at zero rather than letting hints re-inflate it.
  useEffect(() => {
    if (hint && hint.surface === "chat" && hint.refId === threadId) {
      clearUnread("chat", threadId);
    }
  }, [hint, threadId, clearUnread]);

  // Same key as ChatThreadPanel's internal subscription → one shared stream.
  const channels = useMemo(() => [`chat:${threadId}`], [threadId]);
  const noop = useCallback(() => {}, []);
  const { state: streamState } = useEventStream(channels, noop);

  if (error) {
    return (
      <div className="p-3">
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }
  if (!thread || !page) {
    return (
      <div className="p-3">
        <SkeletonRows rows={5} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-osrs-bronze/25 flex shrink-0 items-center gap-2 border-b px-4 py-1.5">
        <span className="text-osrs-parchment-dark/70 min-w-0 flex-1 truncate text-xs">
          {thread.title ?? counterpartyLabel(thread)}
        </span>
        <Link
          href={`/messages/${threadId}` as Route}
          className="text-osrs-gold-bright shrink-0 text-xs hover:underline"
        >
          Open full page →
        </Link>
        <ChatLiveDot state={streamState} />
      </div>
      <ChatThreadPanel
        thread={thread}
        initialMessages={page.messages}
        initialHasMore={page.has_more}
        hideHeader
        scrollerClassName="min-h-0 flex-1"
        className="m-2 min-h-0 flex-1"
      />
    </div>
  );
}
