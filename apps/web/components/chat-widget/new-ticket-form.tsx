"use client";

/**
 * Open a ticket from the widget: type radio-cards (copy mirrored from the
 * backend's welcome-card meta) + the first message. The POST returns the full
 * detail, so success swaps this form for the ticket view in place.
 */
import { useState, useTransition } from "react";
import { TICKET_BODY_MAX_CHARS, type TicketType } from "@droptracker/api-types";
import { createTicket } from "@/app/(site)/support-actions";
import { Alert, Button } from "@/components/ui";
import { TICKET_TYPES } from "@/lib/chat-widget";
import { getErrorMessage } from "@/lib/errors";
import { useChatWidget } from "./widget-context";

const MIN_BODY_CHARS = 10;

export function NewTicketForm() {
  const { inbox, push, replace, refreshInbox } = useChatWidget();
  const [type, setType] = useState<TicketType>("players");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmitting] = useTransition();

  const trimmed = body.trim();
  const tooShort = trimmed.length < MIN_BODY_CHARS;
  const overLimit = body.length > TICKET_BODY_MAX_CHARS;
  const openTicketId = inbox?.open_ticket_id ?? null;

  const submit = () => {
    if (tooShort || overLimit || submitting) return;
    setError(null);
    startSubmitting(async () => {
      try {
        const created = await createTicket({ type, body: trimmed });
        refreshInbox();
        // Back from the ticket should land on the inbox, not this stale form.
        replace({ kind: "ticket", ticketId: created.ticket_id });
      } catch (err) {
        // Defensive 409 handling: the CTA gating makes this a race, but the
        // backend has the final say on the one-open-ticket rule.
        setError(
          getErrorMessage(
            err,
            "Couldn't open that ticket. If you already have one open, reply there instead.",
          ),
        );
      }
    });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      {openTicketId != null && (
        <Alert variant="info" className="mb-3">
          You already have an open ticket —{" "}
          <button
            type="button"
            onClick={() => push({ kind: "ticket", ticketId: openTicketId })}
            className="text-osrs-gold-bright hover:underline"
          >
            continue it here
          </button>
          .
        </Alert>
      )}

      <p className="text-osrs-parchment-dark/70 mb-2 text-xs">What do you need help with?</p>
      <div className="mb-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Ticket type">
        {TICKET_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={type === t.value}
            onClick={() => setType(t.value)}
            title={t.hint}
            className={`rounded border px-2.5 py-2 text-left text-xs transition-colors ${
              type === t.value
                ? "border-osrs-gold/60 bg-osrs-gold/10 text-osrs-parchment"
                : "border-osrs-bronze/30 text-osrs-parchment-dark/80 hover:border-osrs-gold/40"
            }`}
          >
            <span className="mr-1" aria-hidden>
              {t.emoji}
            </span>
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-osrs-parchment-dark/50 mb-3 text-xs">
        {TICKET_TYPES.find((t) => t.value === type)?.hint}
      </p>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        placeholder="Describe the problem — what happened, which account or group, and roughly when."
        disabled={submitting}
        aria-label="Ticket message"
        className="border-osrs-bronze/30 bg-osrs-brown-dark/40 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 focus:border-osrs-gold/50 mb-1 w-full resize-y rounded border px-3 py-2 text-sm outline-none disabled:opacity-50"
      />
      <p className={`mb-3 text-xs ${overLimit ? "text-osrs-red" : "text-osrs-parchment-dark/50"}`}>
        {overLimit
          ? `${body.length} / ${TICKET_BODY_MAX_CHARS} characters — too long to send.`
          : tooShort
            ? `At least ${MIN_BODY_CHARS} characters.`
            : `${body.length} / ${TICKET_BODY_MAX_CHARS}`}
      </p>

      {error && (
        <Alert variant="error" className="mb-3">
          {error}
        </Alert>
      )}

      <div className="mt-auto flex items-center justify-between gap-2">
        <p className="text-osrs-parchment-dark/50 text-xs">
          Staff will reply here and in a private Discord channel.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={submit}
          disabled={submitting || tooShort || overLimit || openTicketId != null}
        >
          {submitting ? "Opening…" : "Open ticket"}
        </Button>
      </div>
    </div>
  );
}
