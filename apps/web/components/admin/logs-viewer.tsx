"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { AdminLogEntry } from "@/lib/api";

const LEVEL_STYLES: Record<string, string> = {
  debug: "text-osrs-parchment-dark/50",
  info: "text-osrs-parchment-dark/80",
  notice: "text-sky-300",
  warning: "text-osrs-gold",
  warn: "text-osrs-gold",
  error: "text-osrs-red",
  critical: "text-osrs-red font-semibold",
  fatal: "text-osrs-red font-semibold",
};

function levelClass(level: string): string {
  return LEVEL_STYLES[level.toLowerCase()] ?? "text-osrs-parchment-dark/80";
}

function fmtTs(ts: number): string {
  const ms = ts > 1e12 ? ts : ts * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? String(ts) : d.toLocaleTimeString();
}

export function LogsViewer({
  entries,
  sources,
  source,
}: {
  entries: AdminLogEntry[];
  sources: string[];
  source: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const selectSource = (value: string) => {
    const qs = new URLSearchParams();
    if (value) qs.set("source", value);
    router.push(`/admin/logs${qs.toString() ? `?${qs}` : ""}` as Route);
  };

  const refresh = () => startTransition(() => router.refresh());

  const field =
    "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-2 text-sm outline-none";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-osrs-parchment-dark/70">Source</span>
          <select value={source} onChange={(e) => selectSource(e.target.value)} className={field}>
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={refresh}
          disabled={pending}
          className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-2 text-sm disabled:opacity-50"
        >
          {pending ? "Refreshing…" : "Refresh"}
        </button>
        <span className="text-osrs-parchment-dark/50 text-xs">{entries.length} lines</span>
      </div>

      {entries.length === 0 ? (
        <div className="border-osrs-bronze/20 text-osrs-parchment-dark/60 rounded border p-6 text-center text-sm">
          No log entries{source ? ` for “${source}”` : ""}.
        </div>
      ) : (
        <div className="bg-osrs-brown-dark/80 border-osrs-bronze/30 max-h-[65vh] overflow-auto rounded border p-3 font-mono text-xs leading-relaxed">
          {entries.map((e, i) => (
            <div key={i} className="flex gap-2 whitespace-pre-wrap break-words py-0.5">
              <span className="text-osrs-parchment-dark/40 shrink-0 tabular-nums">{fmtTs(e.ts)}</span>
              <span className={`shrink-0 uppercase ${levelClass(e.level)}`}>{e.level}</span>
              <span className="text-osrs-parchment-dark/50 shrink-0">[{e.source}]</span>
              <span className="text-osrs-parchment">{e.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
