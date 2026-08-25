"use client";

/**
 * Staff clan-chats console (web102a follow-up): every clan-vs-clan negotiation
 * on the site, not just the ones the viewer's own clan is in.
 *
 * Group leaders already see their own challenges in their inbox — those arrive
 * because their clan is a party on the thread. This view is the staff-side
 * counterpart: when two clans are arguing about a start date and one of them
 * opens a ticket about it, staff need to be able to read the thread and answer
 * in it. The backend seats a staff viewer with a synthetic party when the
 * thread is fetched BY ID, which is what a row click does — so the composer
 * comes up enabled even though the rows below all report `can_post: false`
 * (the list endpoint doesn't resolve membership; see `StaffChatsPageSchema`).
 */
import { useEffect, useState, useTransition } from "react";
import type { ChatThread } from "@droptracker/api-types";
import { loadStaffChats } from "@/app/(site)/support-actions";
import { Alert, Badge, EmptyState, SkeletonRows } from "@/components/ui";
import { counterpartyLabel } from "@/lib/chat";
import { getErrorMessage } from "@/lib/errors";
import { formatRelativeTime } from "@/lib/format";
import { useChatWidget } from "./widget-context";

export function StaffClanChats() {
  const { push } = useChatWidget();
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, startLoadingMore] = useTransition();

  useEffect(() => {
    let active = true;
    loadStaffChats({ kind: "event_invite" })
      .then((page) => {
        if (!active) return;
        setThreads(page.items);
        setTotal(page.meta.total);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err, "Couldn't load clan chats."));
      });
    return () => {
      active = false;
    };
  }, []);

  const loadMore = () => {
    if (!threads) return;
    const nextPage = Math.floor(threads.length / 25) + 1;
    startLoadingMore(async () => {
      try {
        const page = await loadStaffChats({ kind: "event_invite", page: nextPage });
        // Id-keyed append: a thread that bubbled to page 1 between fetches
        // would otherwise show up twice.
        setThreads((prev) => {
          const have = new Set((prev ?? []).map((t) => t.id));
          return [...(prev ?? []), ...page.items.filter((t) => !have.has(t.id))];
        });
        setTotal(page.meta.total);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't load more clan chats."));
      }
    });
  };

  return (
    <div className="flex h-full flex-col">
      <p className="border-osrs-bronze/25 text-osrs-parchment-dark/60 shrink-0 border-b px-3 py-2 text-xs">
        Every clan-vs-clan conversation. Open one to read it — you can reply as staff.
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && (
          <Alert variant="error" className="m-3">
            {error}
          </Alert>
        )}
        {threads == null ? (
          !error && (
            <div className="p-3">
              <SkeletonRows rows={4} />
            </div>
          )
        ) : threads.length === 0 ? (
          <EmptyState
            className="m-3"
            icon="⚔️"
            title="No clan chats yet"
            hint="Clan-vs-clan challenges open a thread between the two clans; they'll all be listed here."
          />
        ) : (
          <>
            <ul className="divide-osrs-bronze/15 divide-y">
              {threads.map((thread) => {
                const time = thread.last_message_at ?? thread.created_at;
                return (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => push({ kind: "chat", threadId: thread.id })}
                      className="hover:bg-osrs-bronze/10 block w-full px-3 py-2.5 text-left"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-osrs-parchment min-w-0 flex-1 truncate text-sm font-medium">
                          {thread.title ?? counterpartyLabel(thread)}
                        </span>
                        {time != null && (
                          <span className="text-osrs-parchment-dark/50 shrink-0 text-[11px]">
                            {formatRelativeTime(time)}
                          </span>
                        )}
                        {thread.unread > 0 && (
                          <span
                            className="bg-osrs-gold text-osrs-brown-dark shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                            aria-label={`${thread.unread} unread`}
                          >
                            {thread.unread > 9 ? "9+" : thread.unread}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        {thread.status !== "open" && (
                          <Badge variant="neutral" size="sm">
                            {thread.status}
                          </Badge>
                        )}
                        {/* The two clans. With no `my_parties` (staff), the
                            counterparty helper lists every participant — which
                            is exactly "Iron Wolves, Clan 1" here. */}
                        <span className="text-osrs-parchment-dark/60 min-w-0 flex-1 truncate text-xs">
                          {counterpartyLabel(thread)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {threads.length < total && (
              <div className="flex justify-center py-3">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-osrs-gold-bright text-xs hover:underline disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : `Load more (${threads.length} of ${total})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
