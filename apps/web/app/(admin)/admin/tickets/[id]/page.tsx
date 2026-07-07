import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";
import { TicketMetaHeader, TicketTranscript } from "@/components/ticket-transcript";
import { TicketAdminActions } from "@/components/admin/ticket-actions";

export const metadata: Metadata = { title: "Ticket · Admin" };
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function AdminTicketDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId) || ticketId < 1) notFound();
  const user = await requireSuperadmin("/admin/tickets");

  let ticket;
  try {
    ticket = await api.ticket(ticketId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div className="space-y-4">
      <Link
        href="/admin/tickets"
        className="text-osrs-parchment-dark/70 hover:text-osrs-gold text-sm"
      >
        ← All tickets
      </Link>
      <TicketMetaHeader ticket={ticket} />
      <TicketAdminActions ticket={ticket} currentUserId={user.user_id} />
      <TicketTranscript ticket={ticket} />
    </div>
  );
}
