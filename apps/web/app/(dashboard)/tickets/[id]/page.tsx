import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
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
    // 403 renders as not-found on purpose: don't leak which ticket ids exist.
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }

  return (
    <div className="space-y-4">
      <Link href="/tickets" className="text-osrs-parchment-dark/70 hover:text-osrs-gold text-sm">
        ← My tickets
      </Link>
      <TicketMetaHeader ticket={ticket} />
      {ticket.status !== "closed" && (
        <p className="text-osrs-parchment-dark/70 text-sm">
          This ticket is still open — reply in its Discord channel. The transcript below updates as
          the conversation continues.
        </p>
      )}
      <TicketTranscript ticket={ticket} />
    </div>
  );
}
