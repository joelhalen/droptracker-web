"use client";

/**
 * Staff thread browser (web102a follow-up): every thread of one kind on the
 * site, not just the ones the viewer's own clan is in.
 *
 * Group leaders already see their own threads in their inbox — those arrive
 * because their clan is a party on them. This view is the staff-side
 * counterpart: when two clans are arguing about a start date and one of them
 * opens a ticket about it, staff need to be able to read the thread and answer
 * in it. The backend seats a staff viewer with a synthetic party when the
 * thread is fetched BY ID, which is what a row click does — so the composer
 * comes up enabled even though the rows below may report `can_post: false`
 * (see `StaffChatsPageSchema`).
 *
 * Parameterised by kind because a developer who is not a superadmin cannot
 * reach the richer `/admin/group-notices` console, and would otherwise have no
 * way at all to open a group-notice thread. Each row's subtitle is the thread's
 * parties, which for a notice is the clan it was raised against — the thing its
 * title never says.
 */
import { useEffect, useState, useTransition } from "react";
import type { ChatThread, StaffChatKind } from "@droptracker/api-types";
import { loadStaffChats } from "@/app/(site)/support-actions";
import { Alert, Badge, EmptyState, SkeletonRows } from "@/components/ui";
import { counterpartyLabel } from "@/lib/chat";
import { getErrorMessage } from "@/lib/errors";
import { formatRelativeTime } from "@/lib/format";
import { useChatWidget } from "./widget-context";

interface BrowserCopy {
  intro: string;
  emptyIcon: string;
  emptyTitle: string;
  emptyHint: string;
  loadError: string;
}

const COPY: Record<StaffChatKind, BrowserCopy> = {
  event_invite: {
    intro: "Every clan-vs-clan conversation. Open one to read it — you can reply as staff.",
    emptyIcon: "\u2694\uFE0F",
    emptyTitle: "No clan chats yet",
    emptyHint:
      "Clan-vs-clan challenges open a thread between the two clans; they'll all be listed here.",
    loadError: "Couldn't load clan chats.",
  },
  group_notice: {
    intro:
      "Every problem the bot has reported to a clan. The clan it concerns is named under each row.",
    emptyIcon: "\u26A0\uFE0F",
    emptyTitle: "No group notices yet",
    emptyHint:
      "When the bot can't post to a clan's channel it raises a notice here and DMs their leadership.",
    loadError: "Couldn't load group notices.",
  },
  staff_dm: {
    intro: "Every staff conversation with an individual user.",
    emptyIcon: "\u{1F6E1}\uFE0F",
    emptyTitle: "No staff messages yet",
    emptyHint: "Threads opened from \u201CMessage a user\u201D appear here.",
    loadError: "Couldn't load staff messages.",
  },
};

export function StaffThreadBrowser({ kind }: { kind: StaffChatKind }) {
  const { push } = useChatWidget();
  const copy = COPY[kind];
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, startLoadingMore] = useTransition();

  useEffect(() => {
    let active = true;
    loadStaffChats({ kind })
      .then((page) => {
        if (!active) return;
        setThreads(page.items);
        setTotal(page.meta.total);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err, copy.loadError));
      });
    return () => {
      active = false;
    };
  }, [kind, copy.loadError]);

  const loadMore = () => {
    if (!threads) return;
    const nextPage = Math.floor(threads.length / 25) + 1;
    startLoadingMore(async () => {
      try {
        const page = await loadStaffChats({ kind, page: nextPage });
        // Id-keyed append: a thread that bubbled to page 1 between fetches
        // would otherwise show up twice.
        setThreads((prev) => {
          const have = new Set((prev ?? []).map((t) => t.id));
          return [...(prev ?? []), ...page.items.filter((t) => !have.has(t.id))];
        });
        setTotal(page.meta.total);
      } catch (err) {
        setError(getErrorMessage(err, copy.loadError));
      }
    });
  };

  return (
    <div className="flex h-full flex-col">
      <p className="border-osrs-bronze/25 text-osrs-parchment-dark/60 shrink-0 border-b px-3 py-2 text-xs">
        {copy.intro}
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
            icon={copy.emptyIcon}
            title={copy.emptyTitle}
            hint={copy.emptyHint}
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
                        {/* The thread's parties. With no `my_parties` (staff),
                            the counterparty helper lists every participant —
                            "Iron Wolves, Clan 1" for a challenge, and the clan
                            a notice concerns for a notice. */}
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
