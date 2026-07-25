"use client";

/**
 * Unsaved-changes guards for forms that save through an explicit button.
 *
 * Two layers, because a form can be left in two different ways:
 *
 *  1. `useUnsavedChanges(dirty)` — passive guard for *navigation away from the
 *     page*: the browser's native `beforeunload` prompt (reload / close / typed
 *     URL), plus a capture-phase click interceptor for in-app `<Link>`/`<a>`
 *     navigations. The App Router has no `routeChangeStart` event, so the
 *     anchor intercept is the only way to catch a client-side route change
 *     before it commits.
 *  2. `confirmDiscard(dirty, message)` — active guard for navigation *within*
 *     a page: tab bars, wizard steps, scope pickers. Call it in the click
 *     handler and bail when it returns false.
 *
 * Known limitation: browser back/forward can't be intercepted here — the
 * `popstate` event fires after the history entry has already changed, so
 * blocking it means pushing a sacrificial entry, which breaks the button for
 * everyone who has nothing unsaved. Anything reachable by back/forward is also
 * reachable by a link, which is covered.
 */
import { useEffect } from "react";

export const UNSAVED_CHANGES_MESSAGE =
  "You have unsaved changes that will be lost if you leave this page. Leave without saving?";

/**
 * `true` when it's safe to proceed — either nothing is unsaved, or the user
 * accepted the confirm. Use for in-page navigation (tabs, wizard steps).
 */
export function confirmDiscard(dirty: boolean, message: string = UNSAVED_CHANGES_MESSAGE): boolean {
  if (!dirty || typeof window === "undefined") return true;
  return window.confirm(message);
}

/** Warn before the page unloads or an in-app link navigates away while dirty. */
export function useUnsavedChanges(dirty: boolean, message: string = UNSAVED_CHANGES_MESSAGE) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // Browsers show their own wording; both calls are needed for coverage.
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onClick = (e: MouseEvent) => {
      // Let modified clicks (new tab/window/download) and already-handled
      // clicks through untouched — they don't navigate this document.
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href || href.startsWith("#")) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      // Same page, different hash — scrolls, doesn't navigate.
      if (
        url.origin === window.location.origin &&
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      if (window.confirm(message)) return;
      // Capture phase, so this runs before React's delegated handler and
      // before <Link>'s own navigation.
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty, message]);
}
