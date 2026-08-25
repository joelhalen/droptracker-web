"use client";

/**
 * Shared state for the support widget (web102a). The provider lives at the
 * widget ROOT (`chat-widget.tsx`), not the panel, so the inbox, unread math
 * and the view stack survive the panel closing and client-side navigation.
 */
import { createContext, useContext } from "react";
import type { Inbox, Me } from "@droptracker/api-types";
import type { InboxSurface, UnreadHint, WidgetView } from "@/lib/chat-widget";

/** The latest realtime unread hint. `seq` is monotonic so a view can tell a
 * fresh hint from the one it already reacted to. */
export type WidgetHint = UnreadHint & { seq: number };

export interface ChatWidgetContextValue {
  me: Me;
  /** null while the first load is in flight. */
  inbox: Inbox | null;
  inboxError: string | null;
  /** Immediate refetch (retry buttons); realtime frames use the debounced
   * variant internally. */
  refreshInbox: () => void;
  /** Zero one item's unread locally (the viewer just opened it). */
  clearUnread: (surface: InboxSurface, refId: number) => void;
  stack: WidgetView[];
  /** Top of the stack — what the panel renders. */
  view: WidgetView;
  push: (view: WidgetView) => void;
  pop: () => void;
  /** Swap the top view (a create form → its created result). */
  replace: (view: WidgetView) => void;
  close: () => void;
  /** Latest hint from the `user:{id}` stream; open views refetch when it
   * targets them. */
  hint: WidgetHint | null;
}

const ChatWidgetContext = createContext<ChatWidgetContextValue | null>(null);

export const ChatWidgetProvider = ChatWidgetContext.Provider;

export function useChatWidget(): ChatWidgetContextValue {
  const value = useContext(ChatWidgetContext);
  if (!value) throw new Error("useChatWidget must be used inside <ChatWidget />");
  return value;
}
