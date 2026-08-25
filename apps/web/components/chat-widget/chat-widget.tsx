"use client";

/**
 * The support widget root (web102a): a bottom-right launcher on every `(site)`
 * page. Signed-out visitors get nothing (the `useMe` gate renders null before
 * any other work); signed-in users get the unread badge, one PERMANENT
 * `user:{id}` SSE subscription for the life of the tab, and a lazy-loaded
 * panel on first open.
 *
 * Realtime strategy (per plan): the channel key never changes, so the shared
 * `useEventStream` registry keeps a single EventSource; thread views add at
 * most one more (`chat:{id}`). `inbox_unread` frames are bodyless hints —
 * patch the fetched inbox locally for instant feedback, then let a debounced
 * refetch make previews/ordering authoritative.
 */
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Inbox, Me } from "@droptracker/api-types";
import { loadInbox } from "@/app/(site)/support-actions";
import { ChatIcon } from "@/components/icons";
import {
  applyUnreadHint,
  clearInboxUnread,
  inboxTotalUnread,
  initialStack,
  popView,
  pushView,
  replaceView,
  unreadHintFromFrame,
  viewMatchesHint,
  zeroAllUnread,
  DEFAULT_INBOX_TAB,
  type InboxSurface,
  type InboxTab,
  type WidgetView,
} from "@/lib/chat-widget";
import { getErrorMessage } from "@/lib/errors";
import { useEventStream } from "@/lib/use-event-stream";
import { useMe } from "@/lib/use-me";
import { ChatWidgetProvider, type ChatWidgetContextValue, type WidgetHint } from "./widget-context";

// Lazy: the panel (and everything it imports — thread panel, transcript,
// forms) stays out of every page's bundle until the first open.
const WidgetPanel = dynamic(() => import("./widget-panel").then((m) => m.WidgetPanel), {
  ssr: false,
});

const REFRESH_DEBOUNCE_MS = 2_000;

export function ChatWidget() {
  const me = useMe();
  // Loading and signed-out render nothing — zero cost for visitors.
  if (!me) return null;
  return <ChatWidgetInner me={me} />;
}

function ChatWidgetInner({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const [stack, setStack] = useState<WidgetView[]>(initialStack);
  const [tab, setTab] = useState<InboxTab>(DEFAULT_INBOX_TAB);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [hint, setHint] = useState<WidgetHint | null>(null);

  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const refreshing = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintSeq = useRef(0);

  const refreshInbox = useCallback(() => {
    if (refreshing.current) return;
    refreshing.current = true;
    loadInbox()
      .then((next) => {
        setInbox(next);
        setInboxError(null);
      })
      .catch((err) => {
        // Keep any previously-loaded inbox; only surface the error when there
        // is nothing better to show.
        setInboxError(getErrorMessage(err, "Couldn't load your messages."));
      })
      .finally(() => {
        refreshing.current = false;
      });
  }, []);

  // First load on mount — the badge must work with the panel closed.
  useEffect(() => {
    refreshInbox();
  }, [refreshInbox]);

  const scheduleRefresh = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      refreshInbox();
    }, REFRESH_DEBOUNCE_MS);
  }, [refreshInbox]);

  useEffect(
    () => () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    },
    [],
  );

  // The permanent per-tab subscription. The key is stable for the session, so
  // the shared registry holds exactly one EventSource across opens/closes.
  const channels = useMemo(() => [`user:${me.user_id}`], [me.user_id]);
  useEventStream(channels, (event) => {
    const parsed = unreadHintFromFrame(event);
    if (!parsed) return;
    hintSeq.current += 1;
    setHint({ ...parsed, seq: hintSeq.current });

    // Suppress the local bump for the conversation currently on screen — that
    // view refetches and marks itself read instead of inflating the badge.
    const top = stack[stack.length - 1]!;
    const onScreen = open && viewMatchesHint(top, parsed);
    if (!onScreen && inbox) {
      const { inbox: patched, stale } = applyUnreadHint(inbox, parsed, event.ts);
      if (!stale) setInbox(patched);
    }
    // The hint is bodyless: always refetch (debounced) so previews, ordering
    // and brand-new items become authoritative.
    scheduleRefresh();
  });

  const clearUnread = useCallback((surface: InboxSurface, refId: number) => {
    setInbox((prev) => (prev ? clearInboxUnread(prev, surface, refId) : prev));
  }, []);

  const clearAllUnread = useCallback(() => {
    setInbox((prev) => (prev ? zeroAllUnread(prev) : prev));
  }, []);

  // Opening always lands on the Inbox tab: the panel is a "what needs me?"
  // surface, and reopening into last week's Suggestions tab hides the thing
  // the badge was pointing at. The choice still persists WITHIN a session so
  // reading a suggestion and pressing back returns where you were.
  const toggleOpen = useCallback(() => {
    // Read `open` rather than resetting inside the updater — setState updaters
    // have to stay pure (StrictMode calls them twice).
    if (!open) setTab(DEFAULT_INBOX_TAB);
    setOpen((wasOpen) => !wasOpen);
  }, [open]);

  const push = useCallback((view: WidgetView) => setStack((prev) => pushView(prev, view)), []);
  const pop = useCallback(() => setStack((prev) => popView(prev)), []);
  const replace = useCallback(
    (view: WidgetView) => setStack((prev) => replaceView(prev, view)),
    [],
  );
  const close = useCallback(() => {
    setOpen(false);
    // Return focus to the launcher (dialog pattern).
    launcherRef.current?.focus();
  }, []);

  const totalUnread = inbox ? inboxTotalUnread(inbox.items) : 0;

  // "(n)" tab-title prefix while unread and the panel is closed. Re-applied on
  // client navigation (Next swaps the title per route); best-effort by design.
  const pathname = usePathname();
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\) /, "");
    const wantPrefix = totalUnread > 0 && !open;
    const next = wantPrefix ? `(${totalUnread > 9 ? "9+" : totalUnread}) ${base}` : base;
    if (document.title !== next) document.title = next;
  }, [totalUnread, open, pathname]);

  const context: ChatWidgetContextValue = useMemo(
    () => ({
      me,
      inbox,
      inboxError,
      refreshInbox,
      clearUnread,
      clearAllUnread,
      tab,
      setTab,
      stack,
      view: stack[stack.length - 1]!,
      push,
      pop,
      replace,
      close,
      hint,
    }),
    [
      me,
      inbox,
      inboxError,
      refreshInbox,
      clearUnread,
      clearAllUnread,
      tab,
      stack,
      push,
      pop,
      replace,
      close,
      hint,
    ],
  );

  return (
    <ChatWidgetProvider value={context}>
      <button
        ref={launcherRef}
        type="button"
        onClick={toggleOpen}
        aria-label={
          open
            ? "Close messages and support"
            : totalUnread > 0
              ? `Open messages and support — ${totalUnread} unread`
              : "Open messages and support"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        className="border-osrs-bronze/50 bg-osrs-surface-2 text-osrs-gold hover:border-osrs-gold/60 hover:text-osrs-gold-bright fixed right-4 bottom-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border shadow-lg transition-colors"
      >
        <ChatIcon className="size-6" />
        {totalUnread > 0 && (
          <span
            className="bg-osrs-gold text-osrs-brown-dark absolute -top-1 -right-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
            aria-hidden
          >
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>
      {open && <WidgetPanel launcherRef={launcherRef} />}
    </ChatWidgetProvider>
  );
}
