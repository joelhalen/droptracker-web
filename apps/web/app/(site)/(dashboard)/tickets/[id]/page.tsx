import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { AccessDenied } from "@/components/access-denied";
import { TicketReplyComposer } from "@/components/chat-widget/ticket-reply-composer";
import { TicketMetaHeader, TicketTranscript } from "@/components/ticket-transcript";

export const metadata: Metadata = { title: "Ticket" };
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function TicketDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId) || ticketId < 1) notFound();
  await requireUser(`/tickets/${ticketId}`);

  let ticket;
  try {
    ticket = await api.ticket(ticketId);
  } catch (e) {
    // 403 and 404 render the SAME non-confirming denial (web57a): someone
    // else's ticket must stay indistinguishable from a nonexistent id, but a
    // tailored "no access" page beats the old bare 404 for the common case —
    // a user following a stale link or the wrong account's ticket.
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
      return (
        <AccessDenied
          icon="🎫"
          title="Ticket unavailable"
          message="This ticket doesn't exist, or your account doesn't have access to it. Tickets are visible only to the person who opened them and site staff — if this is your ticket, make sure you're signed in with the same Discord account you opened it with."
          back={{ href: "/tickets", label: "My tickets" }}
        />
      );
    }
    throw e;
  }

  return (
    <div className="space-y-4">
      <Link href="/tickets" className="text-osrs-parchment-dark/70 hover:text-osrs-gold text-sm">
        ← My tickets
      </Link>
      <TicketMetaHeader ticket={ticket} />
      {ticket.status === "open" && (
        <p className="text-osrs-parchment-dark/70 text-sm">
          This ticket is open — reply below or in its Discord channel; both sides see the same
          conversation.
        </p>
      )}
      {ticket.status === "pending" && (
        <p className="text-osrs-parchment-dark/70 text-sm">
          We&apos;re setting up this ticket&apos;s Discord channel — replies open in a moment.
        </p>
      )}
      <TicketTranscript ticket={ticket} />
      {/* web102a: web replies, status-gated like the widget's composer. */}
      {ticket.status === "open" && <TicketReplyComposer ticketId={ticket.ticket_id} />}
    </div>
  );
}
