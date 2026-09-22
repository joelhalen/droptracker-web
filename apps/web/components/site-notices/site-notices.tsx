"use client";

/**
 * Targeted pop-ups for signed-in visitors (web118a). Mounted once in the site
 * chrome; renders nothing for visitors, and nothing at all unless staff have
 * sent this user a notice they haven't closed.
 *
 * How it stays out of the way:
 * - it waits for the page to settle, for the tab to be visible, and for the
 *   visitor to stop typing before it opens;
 * - one notice at a time, "1 of 3" when more are waiting, with "Close all";
 * - closing is permanent: the server records it for every device, and this
 *   browser remembers it too (see `lib/site-notices`), so a close that never
 *   reached the server still sticks and is re-sent on the next visit;
 * - a second tab hides the notice as soon as the first one closes it;
 * - following a site link or the notice's button counts as closing it, since
 *   the layout (and so the dialog) survives client-side navigation.
 *
 * It lives in the layout, so it loads once per full page load, not on every
 * client-side navigation.
 */
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PopupNotice } from "@droptracker/api-types";
import { dismissNotices, loadMyNotices, markNoticesSeen } from "@/app/(site)/notice-actions";
import {
  NOTICE_OPEN_DELAY_MS,
  closedStorageKey,
  isTypingTarget,
  parseClosedMemory,
  pruneClosedMemory,
  rememberClosed,
  splitByClosed,
  toSitePath,
  type ClosedMemory,
} from "@/lib/site-notices";
import { useMe } from "@/lib/use-me";
import { NoticeDialog } from "./notice-dialog";

/** Pages where a pop-up would get in the way of the work being done there. */
const QUIET_PREFIXES = ["/admin/notices"];

function readMemory(key: string): ClosedMemory {
  try {
    return parseClosedMemory(window.localStorage.getItem(key));
  } catch {
    return {};
  }
}

function writeMemory(key: string, memory: ClosedMemory) {
  try {
    window.localStorage.setItem(key, JSON.stringify(memory));
  } catch {
    /* private mode / storage full: the server record still holds */
  }
}

export function SiteNotices() {
  const me = useMe();
  if (!me) return null;
  return <SiteNoticesInner userId={me.user_id} />;
}

function SiteNoticesInner({ userId }: { userId: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const storageKey = closedStorageKey(userId);
  const [queue, setQueue] = useState<PopupNotice[]>([]);
  const [ready, setReady] = useState(false);
  const [total, setTotal] = useState(0);
  const seen = useRef(new Set<number>());

  // Load once, after the page settles and the tab is visible.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = () => {
      loadMyNotices()
        .then((items) => {
          if (cancelled) return;
          const now = Date.now();
          const memory = pruneClosedMemory(readMemory(storageKey), now);
          writeMemory(storageKey, memory);
          const { show, resend } = splitByClosed(items, memory);
          if (resend.length) dismissNotices(resend).catch(() => {});
          setQueue(show);
          setTotal(show.length);
        })
        .catch(() => {
          /* never surface an error for an unsolicited pop-up */
        });
    };

    const start = () => {
      timer = setTimeout(load, NOTICE_OPEN_DELAY_MS);
    };
    if (document.visibilityState === "visible") {
      start();
      return () => {
        cancelled = true;
        if (timer) clearTimeout(timer);
      };
    }
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onVisible);
      start();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [storageKey]);

  // Hold off while the visitor is typing; open once focus leaves the field.
  useEffect(() => {
    if (queue.length === 0 || ready) return;
    if (!isTypingTarget(document.activeElement)) {
      setReady(true);
      return;
    }
    const onFocusOut = () => {
      // focusout fires before focus lands on the next element.
      setTimeout(() => {
        if (!isTypingTarget(document.activeElement)) setReady(true);
      }, 0);
    };
    document.addEventListener("focusout", onFocusOut);
    return () => document.removeEventListener("focusout", onFocusOut);
  }, [queue.length, ready]);

  // Another tab closed one: drop it here too.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      const memory = parseClosedMemory(e.newValue);
      setQueue((q) => q.filter((n) => memory[String(n.id)] == null));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  const quiet = QUIET_PREFIXES.some((p) => pathname?.startsWith(p));
  const current = ready && !quiet ? queue[0] : undefined;

  // Record the first time each notice is actually on screen.
  useEffect(() => {
    if (!current || seen.current.has(current.id)) return;
    seen.current.add(current.id);
    markNoticesSeen([current.id]).catch(() => {});
  }, [current]);

  const close = useCallback(
    (ids: number[]) => {
      if (ids.length === 0) return;
      // Remember locally first: a navigation right after this must not
      // bring the notice back if the request below never lands.
      writeMemory(storageKey, rememberClosed(readMemory(storageKey), ids, Date.now()));
      setQueue((q) => q.filter((n) => !ids.includes(n.id)));
      dismissNotices(ids).catch(() => {
        /* the local memory re-sends it on the next visit */
      });
    },
    [storageKey],
  );

  if (!current) return null;

  const position = total - queue.length + 1;
  return (
    <NoticeDialog
      key={current.id}
      notice={current}
      position={position}
      total={total}
      onClose={() => close([current.id])}
      onCloseAll={() => close(queue.map((n) => n.id))}
      onFollowLink={(href, external) => {
        close([current.id]);
        if (!external) router.push(toSitePath(href, window.location.origin) as Route);
      }}
    />
  );
}
