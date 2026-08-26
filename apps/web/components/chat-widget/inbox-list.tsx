"use client";

/**
 * The widget's root view: two tabs over everything the viewer has going with
 * DropTracker.
 *
 * "Inbox" is conversations and tickets — the things somebody is waiting on an
 * answer to, plus the door to open a ticket. "Suggestions" is the backlog of
 * ideas and bug reports, which used to sit in the same list and bury the
 * messages that actually needed a reply.
 *
 * All shaping (partitioning, sort, row meta, per-tab unread) comes from
 * `lib/chat-widget.ts`; this file is layout.
 */
import { useState, useTransition } from "react";
import { markAllRead } from "@/app/(site)/support-actions";
import { Alert, Badge, Button, EmptyState, SkeletonRows } from "@/components/ui";
import { inboxItemView, inboxRowMeta, inboxTabs, inboxTotalUnread } from "@/lib/chat-widget";
import { getErrorMessage } from "@/lib/errors";
import { formatRelativeTime } from "@/lib/format";
import { useChatWidget } from "./widget-context";

export function InboxList() {
  const { me, inbox, inboxError, refreshInbox, clearAllUnread, tab, setTab, push } =
    useChatWidget();
  const [markError, setMarkError] = useState<string | null>(null);
  const [marking, startMarking] = useTransition();

  if (!inbox) {
    return (
      <div className="space-y-3 p-3">
        {inboxError ? (
          <>
            <Alert variant="error">{inboxError}</Alert>
            <Button variant="ghost" size="sm" onClick={refreshInbox}>
              Try again
            </Button>
          </>
        ) : (
          <SkeletonRows rows={5} />
        )}
      </div>
    );
  }

  const tabs = inboxTabs(inbox.items);
  const active = tabs.find((t) => t.id === tab) ?? tabs[0]!;
  const items = active.items;
  const openTicketId = inbox.open_ticket_id ?? null;
  const isStaff = me.is_developer || me.is_superadmin;
  const totalUnread = inboxTotalUnread(inbox.items);

  const markEverythingRead = () => {
    setMarkError(null);
    startMarking(async () => {
      try {
        await markAllRead();
        // Zero locally first so the launcher badge drops on the click; the
        // refetch then makes previews and ordering authoritative.
        clearAllUnread();
        refreshInbox();
      } catch (err) {
        setMarkError(getErrorMessage(err, "Couldn't mark everything as read."));
      }
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div
        className="border-osrs-bronze/25 flex shrink-0 items-center gap-1 border-b px-2 py-1.5"
        role="tablist"
        aria-label="Messages and support"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === active.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors ${
              t.id === active.id
                ? "bg-osrs-gold/15 text-osrs-gold font-semibold"
                : "text-osrs-parchment-dark/70 hover:text-osrs-gold-bright"
            }`}
          >
            {t.label}
            {t.unread > 0 && (
              <span
                className="bg-osrs-gold text-osrs-brown-dark rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                aria-label={`${t.unread} unread`}
              >
                {t.unread > 9 ? "9+" : t.unread}
              </span>
            )}
          </button>
        ))}
        {totalUnread > 0 && (
          <button
            type="button"
            onClick={markEverythingRead}
            disabled={marking}
            title="Mark everything in both tabs as read"
            className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright ml-auto shrink-0 rounded px-1.5 py-1 text-[11px] transition-colors disabled:opacity-50"
          >
            {marking ? "Marking…" : "✓ Mark all read"}
          </button>
        )}
      </div>

      {markError && (
        <Alert variant="error" className="m-2">
          {markError}
        </Alert>
      )}

      <div className="border-osrs-bronze/25 flex shrink-0 items-center gap-2 border-b px-3 py-2">
        {active.id === "inbox" ? (
          openTicketId != null ? (
            <>
              <Button
                variant="secondary"
                size="xs"
                disabled
                title="You already have an open ticket — one at a time keeps things tidy."
              >
                New ticket
              </Button>
              <button
                type="button"
                onClick={() => push({ kind: "ticket", ticketId: openTicketId })}
                className="text-osrs-gold-bright text-xs hover:underline"
              >
                View your open ticket →
              </button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="xs" onClick={() => push({ kind: "new-ticket" })}>
                New ticket
              </Button>
              <span className="text-osrs-parchment-dark/50 text-xs">
                Need a hand? Open one and staff will answer here.
              </span>
            </>
          )
        ) : (
          <>
            <Button
              variant="secondary"
              size="xs"
              onClick={() => push({ kind: "new-suggestion" })}
            >
              New suggestion
            </Button>
            <span className="text-osrs-parchment-dark/50 text-xs">Ideas and bug reports.</span>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <EmptyState
            className="m-3"
            icon={active.id === "inbox" ? "💬" : "💡"}
            title={active.id === "inbox" ? "No messages yet" : "No suggestions yet"}
            hint={
              active.id === "inbox"
                ? "Tickets and messages from the DropTracker team and your clan will show up here."
                : "Suggest a feature or report a bug — every one gets read, and you'll see replies here."
            }
          />
        ) : (
          <ul className="divide-osrs-bronze/15 divide-y">
            {items.map((item) => {
              const meta = inboxRowMeta(item);
              return (
                <li key={meta.key}>
                  <button
                    type="button"
                    onClick={() => push(inboxItemView(item))}
                    className="hover:bg-osrs-bronze/10 flex w-full items-start gap-3 px-3 py-2.5 text-left"
                  >
                    <span className="mt-0.5 shrink-0 text-lg" aria-hidden>
                      {meta.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span
                          className={`min-w-0 flex-1 truncate text-sm ${
                            meta.unread > 0
                              ? "text-osrs-parchment font-semibold"
                              : "text-osrs-parchment-dark/90"
                          }`}
                        >
                          {meta.title}
                        </span>
                        {meta.timestamp != null && (
                          <span className="text-osrs-parchment-dark/50 shrink-0 text-[11px]">
                            {formatRelativeTime(meta.timestamp)}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        {meta.badge && (
                          <Badge variant={meta.badge.tone} size="sm">
                            {meta.badge.label}
                          </Badge>
                        )}
                        {meta.context && (
                          <span className="text-osrs-parchment-dark/75 shrink-0 text-xs font-medium">
                            {meta.context}
                          </span>
                        )}
                        {meta.preview && (
                          <span className="text-osrs-parchment-dark/60 min-w-0 flex-1 truncate text-xs">
                            {meta.preview}
                          </span>
                        )}
                        {meta.unread > 0 && (
                          <span
                            className="bg-osrs-gold text-osrs-brown-dark ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                            aria-label={`${meta.unread} unread`}
                          >
                            {meta.unread > 9 ? "9+" : meta.unread}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {isStaff && (
        <div className="border-osrs-bronze/25 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-2 text-xs">
          <span className="text-osrs-parchment-dark/50">Staff</span>
          {me.is_developer && (
            <button
              type="button"
              onClick={() => push({ kind: "staff-new-chat" })}
              className="text-osrs-gold-bright hover:underline"
            >
              Message a user
            </button>
          )}
          {/* One entry, two destinations: a superadmin gets the console that
              can resolve a notice, a developer gets the thread browse they are
              actually allowed to use. Showing both would offer one of them a
              button that 403s. */}
          <button
            type="button"
            onClick={() =>
              push({ kind: me.is_superadmin ? "staff-notices" : "staff-notice-threads" })
            }
            className="text-osrs-gold-bright hover:underline"
          >
            Group notices
          </button>
          <button
            type="button"
            onClick={() => push({ kind: "staff-clan-chats" })}
            className="text-osrs-gold-bright hover:underline"
          >
            Clan chats
          </button>
        </div>
      )}
    </div>
  );
}
