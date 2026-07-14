import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { Card, EmptyState } from "@/components/ui";
import { TicketStatusBadge, TicketTypeBadge } from "@/components/ticket-transcript";
import { formatRelativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "My tickets" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ page?: string }>;

export default async function MyTicketsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser("/tickets");
  const { page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const data = await api.myTickets({ page: pageNum });
  const totalPages = Math.max(1, Math.ceil(data.meta.total / data.meta.limit));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-osrs-gold text-xl font-bold">My tickets</h1>
        <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
          Support conversations you were part of, archived from Discord. Need help with something
          new?{" "}
          <a
            href="/discord"
            className="text-osrs-gold-bright hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Open a ticket in our Discord
          </a>
          .
        </p>
      </div>

      {data.items.length === 0 ? (
        <EmptyState
          title="No tickets yet"
          hint="Tickets you open (or help with) in the DropTracker Discord will be archived here after they're handled."
        />
      ) : (
        <Card padding="p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-osrs-brown-dark/60 text-osrs-parchment-dark/70">
              <tr>
                <th className="px-4 py-2 font-medium">Ticket</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">Messages</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-osrs-bronze/15 divide-y">
              {data.items.map((t) => (
                <tr key={t.ticket_id} className="hover:bg-osrs-bronze/10 transition-colors">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/tickets/${t.ticket_id}`}
                      className="text-osrs-gold-bright font-medium hover:underline"
                    >
                      #{t.ticket_id}
                      {t.subject ? ` — ${t.subject.slice(0, 70)}${t.subject.length > 70 ? "…" : ""}` : ""}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <TicketTypeBadge type={t.type} />
                  </td>
                  <td className="px-4 py-2.5">
                    <TicketStatusBadge status={t.status} />
                  </td>
                  <td className="hidden px-4 py-2.5 sm:table-cell">{t.message_count}</td>
                  <td className="text-osrs-parchment-dark/70 hidden px-4 py-2.5 sm:table-cell">
                    {formatRelativeTime(t.date_updated ?? t.date_added)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="text-osrs-parchment-dark/70 flex items-center gap-3 text-sm">
          {pageNum > 1 && (
            <Link href={`/tickets?page=${pageNum - 1}`} className="text-osrs-gold-bright hover:underline">
              ← Newer
            </Link>
          )}
          <span>
            Page {pageNum} of {totalPages}
          </span>
          {pageNum < totalPages && (
            <Link href={`/tickets?page=${pageNum + 1}`} className="text-osrs-gold-bright hover:underline">
              Older →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
