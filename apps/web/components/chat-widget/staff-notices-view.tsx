"use client";

/**
 * Superadmin group-notice console (web102a phase 4): every bot-raised
 * per-group problem, filterable Open/Resolved. A row opens the notice's chat
 * thread (an ordinary thread — superadmins post via the backend's membership
 * extension); "Resolve" flips the notice in place for the rare case the bot's
 * auto-resolve can't see the fix.
 */
import { useEffect, useState, useTransition } from "react";
import type { GroupNotice } from "@droptracker/api-types";
import { loadGroupNotices, resolveGroupNotice } from "@/app/(site)/support-actions";
import { Alert, Badge, Button, EmptyState, SkeletonRows } from "@/components/ui";
import { noticeSeverityTone } from "@/lib/chat-widget";
import { getErrorMessage } from "@/lib/errors";
import { formatRelativeTime } from "@/lib/format";
import { useChatWidget } from "./widget-context";

type StatusFilter = "open" | "resolved";

export function StaffNoticesView() {
  const { push } = useChatWidget();
  const [status, setStatus] = useState<StatusFilter>("open");
  const [notices, setNotices] = useState<GroupNotice[] | null>(null);
  const [openCount, setOpenCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resolving, startResolving] = useTransition();

  useEffect(() => {
    let active = true;
    setNotices(null);
    setError(null);
    loadGroupNotices({ status })
      .then((page) => {
        if (!active) return;
        setNotices(page.items);
        setOpenCount(page.stats.open);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err, "Couldn't load group notices."));
      });
    return () => {
      active = false;
    };
  }, [status]);

  const resolve = (notice: GroupNotice) => {
    if (!window.confirm(`Resolve "${notice.title}" for ${notice.group_name ?? "this group"}?`)) {
      return;
    }
    setActionError(null);
    startResolving(async () => {
      try {
        const updated = await resolveGroupNotice(notice.id);
        // Update in place; on the Open tab a resolved row simply disappears.
        setNotices((prev) =>
          prev
            ? prev
                .map((n) => (n.id === updated.id ? updated : n))
                .filter((n) => status !== "open" || n.notice_status === "open")
            : prev,
        );
        setOpenCount((prev) => (prev != null && prev > 0 ? prev - 1 : prev));
      } catch (err) {
        setActionError(getErrorMessage(err, "Couldn't resolve that notice."));
      }
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div
        className="border-osrs-bronze/25 flex shrink-0 items-center gap-2 border-b px-3 py-2"
        role="tablist"
        aria-label="Notice status"
      >
        {(["open", "resolved"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${
              status === s
                ? "bg-osrs-gold/15 text-osrs-gold font-semibold"
                : "text-osrs-parchment-dark/70 hover:text-osrs-gold-bright"
            }`}
          >
            {s === "open" ? `Open${openCount != null ? ` (${openCount})` : ""}` : "Resolved"}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {actionError && (
          <Alert variant="error" className="m-3">
            {actionError}
          </Alert>
        )}
        {error ? (
          <div className="p-3">
            <Alert variant="error">{error}</Alert>
          </div>
        ) : notices == null ? (
          <div className="p-3">
            <SkeletonRows rows={4} />
          </div>
        ) : notices.length === 0 ? (
          <EmptyState
            className="m-3"
            icon="✅"
            title={status === "open" ? "No open notices" : "No resolved notices"}
            hint={
              status === "open"
                ? "The bot hasn't flagged any group problems. Quiet is good."
                : "Resolved notices will show up here."
            }
          />
        ) : (
          <ul className="divide-osrs-bronze/15 divide-y">
            {notices.map((notice) => {
              const time = notice.last_message_at ?? notice.last_raised_at;
              return (
                <li key={notice.id}>
                  <div className="hover:bg-osrs-bronze/10 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (notice.thread_id != null) {
                          push({ kind: "chat", threadId: notice.thread_id });
                        }
                      }}
                      disabled={notice.thread_id == null}
                      className="block w-full text-left disabled:cursor-default"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-osrs-parchment min-w-0 flex-1 truncate text-sm font-medium">
                          {notice.group_name ?? `Group ${notice.group_id}`}
                        </span>
                        {time != null && (
                          <span className="text-osrs-parchment-dark/50 shrink-0 text-[11px]">
                            {formatRelativeTime(time)}
                          </span>
                        )}
                        {notice.unread > 0 && (
                          <span
                            className="bg-osrs-gold text-osrs-brown-dark shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                            aria-label={`${notice.unread} unread`}
                          >
                            {notice.unread > 9 ? "9+" : notice.unread}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant={noticeSeverityTone(notice.severity)} size="sm">
                          {notice.severity}
                        </Badge>
                        <span className="bg-osrs-brown-dark/50 text-osrs-parchment-dark/70 rounded px-1.5 py-0.5 font-mono text-[10px]">
                          {notice.code}
                        </span>
                        {notice.raise_count > 1 && (
                          <span
                            className="text-osrs-parchment-dark/50 text-[10px]"
                            title="Times this problem has recurred"
                          >
                            ×{notice.raise_count}
                          </span>
                        )}
                        <span className="text-osrs-parchment-dark/80 min-w-0 flex-1 truncate text-xs">
                          {notice.title}
                        </span>
                      </span>
                      {notice.latest_reply && (
                        <span className="text-osrs-parchment-dark/60 mt-0.5 block truncate text-xs">
                          {notice.latest_reply}
                        </span>
                      )}
                    </button>
                    {notice.notice_status === "open" && (
                      <div className="mt-1.5 flex justify-end">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => resolve(notice)}
                          disabled={resolving}
                        >
                          {resolving ? "Resolving…" : "Resolve"}
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
