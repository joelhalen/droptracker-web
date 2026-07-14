import type { Metadata } from "next";
import { api } from "@/lib/api";
import { StatTile } from "@/components/ui";
import { AdminTicketTable } from "@/components/admin/ticket-table";

export const metadata: Metadata = { title: "Tickets · Admin" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string; type?: string; q?: string; page?: string }>;

export default async function AdminTicketsPage({ searchParams }: { searchParams: SearchParams }) {
  const { status = "", type = "", q = "", page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const data = await api.adminTickets({
    status: status || undefined,
    type: type || undefined,
    q: q || undefined,
    page: pageNum,
  });

  const busiestType = Object.entries(data.stats.open_by_type).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-osrs-gold text-lg font-bold">Support tickets</h2>
        <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
          Tickets are opened and answered in Discord; every conversation is archived here
          permanently. Closing a ticket from this dashboard archives and deletes its Discord
          channel.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Open" value={data.stats.open} />
        <StatTile
          label="Unclaimed"
          value={data.stats.unclaimed}
          hint={data.stats.unclaimed > 0 ? "waiting for a staff member" : undefined}
        />
        <StatTile label="Closed (archived)" value={data.stats.closed} />
        <StatTile
          label="Busiest open type"
          value={busiestType ? busiestType[0] : "—"}
          hint={busiestType ? `${busiestType[1]} open` : undefined}
        />
      </dl>

      <AdminTicketTable data={data} filters={{ status, type, q, page: pageNum }} />
    </div>
  );
}
