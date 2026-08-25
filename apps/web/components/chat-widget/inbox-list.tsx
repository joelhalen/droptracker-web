"use client";

/**
 * The widget's root view: every conversation the viewer has — chat threads,
 * tickets, suggestions — as one sorted list, plus the create CTAs and the
 * staff footer. All shaping (sort, row meta, unread) comes from
 * `lib/chat-widget.ts`; this file is layout.
 */
import { Alert, Badge, Button, EmptyState, SkeletonRows } from "@/components/ui";
import { inboxItemView, inboxRowMeta, sortInboxItems } from "@/lib/chat-widget";
import { formatRelativeTime } from "@/lib/format";
import { useChatWidget } from "./widget-context";

export function InboxList() {
  const { me, inbox, inboxError, refreshInbox, push } = useChatWidget();

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

  const items = sortInboxItems(inbox.items);
  const openTicketId = inbox.open_ticket_id ?? null;
  const isStaff = me.is_developer || me.is_superadmin;

  return (
    <div className="flex h-full flex-col">
      <div className="border-osrs-bronze/25 flex shrink-0 items-center gap-2 border-b px-3 py-2">
        {openTicketId != null ? (
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
          <Button variant="secondary" size="xs" onClick={() => push({ kind: "new-ticket" })}>
            New ticket
          </Button>
        )}
        <Button variant="ghost" size="xs" onClick={() => push({ kind: "new-suggestion" })}>
          New suggestion
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <EmptyState
            className="m-3"
            icon="💬"
            title="Nothing here yet"
            hint="Tickets, suggestions and messages from the DropTracker team will all show up here."
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
        <div className="border-osrs-bronze/25 flex shrink-0 items-center gap-4 border-t px-3 py-2 text-xs">
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
          {me.is_superadmin && (
            <button
              type="button"
              onClick={() => push({ kind: "staff-notices" })}
              className="text-osrs-gold-bright hover:underline"
            >
              Group notices
            </button>
          )}
        </div>
      )}
    </div>
  );
}
