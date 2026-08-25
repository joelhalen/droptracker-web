"use client";

/**
 * The support widget's panel shell: a desktop popup anchored above the
 * launcher, a full-height sheet with backdrop on mobile (the `task-detail.tsx`
 * sheet pattern). Portal-rendered so `overflow`/`transform` ancestors can't
 * clip it.
 *
 * Closes on Escape and outside-mousedown (the `site-header.tsx` UserMenu
 * pattern) but deliberately NOT on pathname change — the view stack and any
 * drafts survive client-side navigation.
 */
import { useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { viewTitle, type WidgetView } from "@/lib/chat-widget";
import { useChatWidget } from "./widget-context";
import { InboxList } from "./inbox-list";
import { ChatView } from "./chat-view";
import { TicketView } from "./ticket-view";
import { SuggestionView } from "./suggestion-view";
import { NewTicketForm } from "./new-ticket-form";
import { NewSuggestionForm } from "./new-suggestion-form";
import { StaffNewChat } from "./staff-new-chat";
import { StaffNoticesView } from "./staff-notices-view";
import { StaffClanChats } from "./staff-clan-chats";

function ViewBody({ view }: { view: WidgetView }) {
  switch (view.kind) {
    case "inbox":
      return <InboxList />;
    case "chat":
      return <ChatView threadId={view.threadId} />;
    case "ticket":
      return <TicketView ticketId={view.ticketId} />;
    case "suggestion":
      return <SuggestionView suggestionId={view.suggestionId} />;
    case "new-ticket":
      return <NewTicketForm />;
    case "new-suggestion":
      return <NewSuggestionForm />;
    // Staff surfaces: backend-gated (developer / superadmin); the widget only
    // decides what to show from `me` flags.
    case "staff-new-chat":
      return <StaffNewChat />;
    case "staff-notices":
      return <StaffNoticesView />;
    case "staff-clan-chats":
      return <StaffClanChats />;
  }
}

export function WidgetPanel({ launcherRef }: { launcherRef: RefObject<HTMLButtonElement | null> }) {
  const { view, stack, pop, close } = useChatWidget();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Dialog focus: land on the header close button when the panel opens.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      // The launcher toggles for itself — closing here too would reopen.
      if (launcherRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [close, launcherRef]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      {/* Mobile-only backdrop; desktop closes via outside-mousedown. */}
      <div className="fixed inset-0 z-[80] bg-black/55 sm:hidden" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Messages and support"
        className="card-pop menu-in fixed inset-x-0 bottom-0 z-[80] flex h-[85dvh] flex-col overflow-hidden rounded-t-2xl sm:inset-x-auto sm:right-4 sm:bottom-20 sm:z-50 sm:h-[min(70vh,34rem)] sm:w-[24rem] sm:rounded-xl"
      >
        <header className="border-osrs-bronze/25 flex shrink-0 items-center gap-2 border-b px-3 py-2">
          {stack.length > 1 && (
            <button
              type="button"
              onClick={pop}
              aria-label="Back"
              className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright rounded px-1 text-sm"
            >
              ←
            </button>
          )}
          <h2 className="text-osrs-gold min-w-0 flex-1 truncate text-sm font-semibold">
            {viewTitle(view)}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close"
            className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright rounded px-1 text-base leading-none"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <ViewBody view={view} />
        </div>
      </div>
    </>,
    document.body,
  );
}
