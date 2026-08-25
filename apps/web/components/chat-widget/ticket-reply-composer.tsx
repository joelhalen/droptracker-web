"use client";

/**
 * Reply composer for OPEN tickets (web102a) — used by the widget's ticket view
 * and the full `/tickets/[id]` page. The backend relays each reply into the
 * ticket's Discord channel, so replies work from either side.
 *
 * With `onPosted` the caller appends the returned row itself (the widget's
 * optimistic path); without it the composer refreshes the route so the server
 * transcript picks the reply up (the full page).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TICKET_BODY_MAX_CHARS, type TicketMessage } from "@droptracker/api-types";
import { replyToTicket } from "@/app/(site)/support-actions";
import { Alert, Button } from "@/components/ui";
import { getErrorMessage } from "@/lib/errors";

export function TicketReplyComposer({
  ticketId,
  onPosted,
}: {
  ticketId: number;
  onPosted?: (message: TicketMessage) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const router = useRouter();

  const overLimit = draft.length > TICKET_BODY_MAX_CHARS;

  const send = () => {
    const content = draft.trim();
    if (!content || sending || overLimit) return;
    setError(null);
    startSending(async () => {
      try {
        const posted = await replyToTicket(ticketId, content);
        setDraft("");
        if (onPosted) onPosted(posted);
        else router.refresh();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't send that reply."));
      }
    });
  };

  return (
    <div className="space-y-2">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line (chat-composer parity).
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="Write a reply…"
          disabled={sending}
          aria-label="Ticket reply"
          className="border-osrs-bronze/30 bg-osrs-brown-dark/40 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 focus:border-osrs-gold/50 min-w-0 flex-1 resize-y rounded border px-3 py-2 text-sm outline-none disabled:opacity-50"
        />
        <Button
          variant="secondary"
          size="xs"
          className="shrink-0 px-3"
          onClick={send}
          disabled={sending || overLimit || !draft.trim()}
        >
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
      {overLimit ? (
        <p className="text-osrs-red text-xs">
          {draft.length} / {TICKET_BODY_MAX_CHARS} characters — too long to send.
        </p>
      ) : (
        <p className="text-osrs-parchment-dark/50 text-xs">
          Replies also appear in your ticket&apos;s Discord channel.
        </p>
      )}
    </div>
  );
}
