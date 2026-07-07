"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminTicketPage } from "@droptracker/api-types";
import { Card, EmptyState, fieldInputClass } from "@/components/ui";
import { TicketStatusBadge, TicketTypeBadge } from "@/components/ticket-transcript";
import { formatRelativeTime } from "@/lib/format";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "unclaimed", label: "Open · unclaimed" },
  { value: "closed", label: "Closed" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "players", label: "Players" },
  { value: "clans", label: "Clans" },
  { value: "support", label: "Support" },
  { value: "other", label: "Other" },
];

export function AdminTicketTable({
  data,
  filters,
}: {
  data: AdminTicketPage;
  filters: { status: string; type: string; q: string; page: number };
}) {
  const router = useRouter();
  const [form, setForm] = useState({ status: filters.status, type: filters.type, q: filters.q });
  const totalPages = Math.max(1, Math.ceil(data.meta.total / data.meta.limit));

  const navigate = (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "" && v !== 0) qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs}` : "";
    router.push(`/admin/tickets${suffix}` as Route);
  };

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ ...form, page: undefined });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={applyFilters} className="flex flex-wrap items-center gap-2">
        <select
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          className={fieldInputClass}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          className={fieldInputClass}
          aria-label="Filter by type"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          value={form.q}
          onChange={(e) => setForm((f) => ({ ...f, q: e.target.value }))}
          placeholder="Search subject or creator…"
          className={`${fieldInputClass} min-w-52 flex-1`}
          aria-label="Search tickets"
        />
        <button
          type="submit"
          className="bg-osrs-gold/15 text-osrs-gold border-osrs-gold/40 hover:bg-osrs-gold/25 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
        >
          Filter
        </button>
      </form>

      {data.items.length === 0 ? (
        <EmptyState title="No tickets match" hint="Try clearing a filter." />
      ) : (
        <Card padding="p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-osrs-brown-dark/60 text-osrs-parchment-dark/70">
              <tr>
                <th className="px-4 py-2 font-medium">Ticket</th>
                <th className="px-4 py-2 font-medium">Opened by</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Claimed by</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Msgs</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-osrs-bronze/15 divide-y">
              {data.items.map((t) => (
                <tr key={t.ticket_id} className="hover:bg-osrs-bronze/10 transition-colors">
                  <td className="max-w-72 px-4 py-2.5">
                    <Link
                      href={`/admin/tickets/${t.ticket_id}`}
                      className="text-osrs-gold-bright block truncate font-medium hover:underline"
                    >
                      #{t.ticket_id}
                      {t.subject ? ` — ${t.subject}` : ""}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{t.created_by_name ?? `user ${t.created_by}`}</td>
                  <td className="px-4 py-2.5">
                    <TicketTypeBadge type={t.type} />
                  </td>
                  <td className="px-4 py-2.5">
                    <TicketStatusBadge status={t.status} />
                  </td>
                  <td className="text-osrs-parchment-dark/80 hidden px-4 py-2.5 md:table-cell">
                    {t.claimed_by_name ?? <span className="text-osrs-parchment-dark/40">—</span>}
                  </td>
                  <td className="hidden px-4 py-2.5 md:table-cell">{t.message_count}</td>
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
          {filters.page > 1 && (
            <button
              onClick={() => navigate({ ...form, page: filters.page - 1 })}
              className="text-osrs-gold-bright hover:underline"
            >
              ← Newer
            </button>
          )}
          <span>
            Page {filters.page} of {totalPages} · {data.meta.total} tickets
          </span>
          {filters.page < totalPages && (
            <button
              onClick={() => navigate({ ...form, page: filters.page + 1 })}
              className="text-osrs-gold-bright hover:underline"
            >
              Older →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
