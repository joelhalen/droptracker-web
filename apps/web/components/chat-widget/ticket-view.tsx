"use client";

/**
 * A ticket inside the widget: compact transcript (reusing the exported
 * `MessageRow`/`AttachmentList` renderers via `MessageRow`) + the status-gated
 * reply composer. Replies optimistic-append the POST response; realtime
 * `inbox_unread`/`ticket_message` hints for this ticket trigger a refetch so
 * staff replies appear without reopening.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { TicketDetail, TicketMessage } from "@droptracker/api-types";
import { loadTicket, markTicketRead } from "@/app/(site)/support-actions";
import { MessageRow, TicketStatusBadge, TicketTypeBadge } from "@/components/ticket-transcript";
import { Alert, SkeletonRows } from "@/components/ui";
import { getErrorMessage } from "@/lib/errors";
import { useChatWidget } from "./widget-context";
import { TicketReplyComposer } from "./ticket-reply-composer";

export function TicketView({ ticketId }: { ticketId: number }) {
  const { clearUnread, hint, refreshInbox } = useChatWidget();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seenHintSeq = useRef(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const detail = await loadTicket(ticketId);
    setTicket(detail);
    setError(null);
    // Reading is what this view IS — advance the pointer and drop the badge.
    const newest = detail.messages.reduce((max, m) => Math.max(max, m.id), 0);
    if (newest > 0) {
      void markTicketRead(ticketId, newest).catch(() => {
        // A failed read receipt is cosmetic; never surface it as an error.
      });
    }
    clearUnread("ticket", ticketId);
  }, [ticketId, clearUnread]);

  useEffect(() => {
    setTicket(null);
    setError(null);
    load().catch((err) => setError(getErrorMessage(err, "Couldn't load this ticket.")));
  }, [load]);

  // Refetch when a realtime hint targets this ticket (new staff reply).
  useEffect(() => {
    if (!hint || hint.seq === seenHintSeq.current) return;
    seenHintSeq.current = hint.seq;
    if (hint.surface === "ticket" && hint.refId === ticketId) {
      load().catch(() => {
        // Keep showing the current transcript; the next hint retries.
      });
    }
  }, [hint, ticketId, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [ticket?.messages.length]);

  if (error) {
    return (
      <div className="p-3">
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }
  if (!ticket) {
    return (
      <div className="p-3">
        <SkeletonRows rows={5} />
      </div>
    );
  }

  const onPosted = (message: TicketMessage) => {
    setTicket((prev) =>
      prev
        ? {
            ...prev,
            messages: [...prev.messages.filter((m) => m.id !== message.id), message],
            message_count: prev.message_count + 1,
          }
        : prev,
    );
    refreshInbox();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-osrs-bronze/25 flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
        <TicketStatusBadge status={ticket.status} />
        <TicketTypeBadge type={ticket.type} />
        <Link
          href={`/tickets/${ticket.ticket_id}` as Route}
          className="text-osrs-gold-bright ml-auto text-xs hover:underline"
        >
          Open full page →
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {ticket.subject && (
          <p className="text-osrs-parchment mb-3 text-sm font-semibold">{ticket.subject}</p>
        )}
        <ol className="space-y-4">
          {ticket.messages.map((m) => (
            <li key={m.id}>
              <MessageRow message={m} mentions={ticket.mentions} />
            </li>
          ))}
        </ol>
        <div ref={bottomRef} />
      </div>

      <div className="border-osrs-bronze/25 shrink-0 border-t px-4 py-3">
        {ticket.status === "open" ? (
          <TicketReplyComposer ticketId={ticket.ticket_id} onPosted={onPosted} />
        ) : ticket.status === "pending" ? (
          <p className="text-osrs-parchment-dark/60 text-xs">
            We&apos;re setting up your ticket&apos;s Discord channel — replies open in a moment.
          </p>
        ) : (
          <p className="text-osrs-parchment-dark/60 text-xs">
            This ticket is closed. Open a new one if you need anything else.
          </p>
        )}
      </div>
    </div>
  );
}
