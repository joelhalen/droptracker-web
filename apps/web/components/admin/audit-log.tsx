"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import type { AdminAuditEntry, AdminAuditLog } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-2 text-sm outline-none";

function actorLabel(actor: AdminAuditEntry["actor"]): string {
  if (!actor) return "system";
  return actor.username || actor.discord_id || `#${actor.user_id}`;
}

/** Best-effort pretty-print: JSON if it parses, otherwise the raw string. */
function prettyValue(raw: string | null): string {
  if (raw == null) return "—";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function AuditLogViewer({
  data,
  filters,
}: {
  data: AdminAuditLog;
  filters: { action: string; actor: string; group: string; q: string };
}) {
  const router = useRouter();
  const { entries, meta } = data;
  const [form, setForm] = useState(filters);
  const [expanded, setExpanded] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(meta.total / Math.max(1, meta.limit)));

  const navigate = (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    }
    router.push(`/admin/audit?${qs}` as Route);
  };

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ ...form, page: 1 });
  };

  const clearFilters = () => {
    const cleared = { action: "", actor: "", group: "", q: "" };
    setForm(cleared);
    navigate({ page: 1 });
  };

  const hasFilters = filters.action || filters.actor || filters.group || filters.q;

  return (
    <div className="space-y-4">
      <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-osrs-parchment-dark/60 mb-1 block text-xs">Search (action/target)</span>
          <input
            value={form.q}
            onChange={(e) => setForm((f) => ({ ...f, q: e.target.value }))}
            placeholder="e.g. service, tier:vip…"
            className={`${field} w-56`}
          />
        </label>
        <label className="block">
          <span className="text-osrs-parchment-dark/60 mb-1 block text-xs">Action</span>
          <input
            value={form.action}
            onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
            placeholder="e.g. service.stop"
            className={`${field} w-36`}
          />
        </label>
        <label className="block">
          <span className="text-osrs-parchment-dark/60 mb-1 block text-xs">Actor user ID</span>
          <input
            value={form.actor}
            onChange={(e) => setForm((f) => ({ ...f, actor: e.target.value }))}
            className={`${field} w-28`}
          />
        </label>
        <label className="block">
          <span className="text-osrs-parchment-dark/60 mb-1 block text-xs">Group ID</span>
          <input
            value={form.group}
            onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
            className={`${field} w-24`}
          />
        </label>
        <button
          type="submit"
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium"
        >
          Filter
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-2 text-sm"
          >
            Clear
          </button>
        )}
      </form>

      {entries.length === 0 ? (
        <div className="border-osrs-bronze/20 text-osrs-parchment-dark/60 rounded border p-6 text-center text-sm">
          No matching audit entries.
        </div>
      ) : (
        <div className="border-osrs-bronze/20 overflow-x-auto rounded border">
          <table className="w-full text-left text-sm">
            <thead className="bg-osrs-brown-dark/60 text-osrs-parchment-dark/70">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium">When</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Actor</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Group</th>
              </tr>
            </thead>
            <tbody className="divide-osrs-bronze/15 divide-y">
              {entries.map((entry) => (
                <Fragment key={entry.id}>
                  <tr
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    className="hover:bg-osrs-bronze/10 cursor-pointer"
                  >
                    <td className="text-osrs-parchment-dark/70 whitespace-nowrap px-3 py-2 tabular-nums">
                      {formatRelativeTime(entry.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{actorLabel(entry.actor)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{entry.action}</td>
                    <td className="max-w-xs truncate px-3 py-2">{entry.target ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{entry.group_id ?? "—"}</td>
                  </tr>
                  {expanded === entry.id && (entry.before || entry.after) && (
                    <tr className="bg-osrs-brown-dark/40">
                      <td colSpan={5} className="px-3 py-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <div className="text-osrs-parchment-dark/50 mb-1 text-xs uppercase">Before</div>
                            <pre className="bg-osrs-brown-dark/80 border-osrs-bronze/20 max-h-48 overflow-auto rounded border p-2 text-xs">
                              {prettyValue(entry.before)}
                            </pre>
                          </div>
                          <div>
                            <div className="text-osrs-parchment-dark/50 mb-1 text-xs uppercase">After</div>
                            <pre className="bg-osrs-brown-dark/80 border-osrs-bronze/20 max-h-48 overflow-auto rounded border p-2 text-xs">
                              {prettyValue(entry.after)}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {entries.length > 0 && (
        <div className="text-osrs-parchment-dark/60 flex items-center justify-between text-sm">
          <span>
            Page {meta.page} of {totalPages} · {meta.total} total
          </span>
          <div className="flex gap-2">
            <button
              disabled={meta.page <= 1}
              onClick={() => navigate({ ...filters, page: meta.page - 1 })}
              className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={meta.page >= totalPages}
              onClick={() => navigate({ ...filters, page: meta.page + 1 })}
              className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
