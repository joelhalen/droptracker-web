"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { B2Usage } from "@droptracker/api-types";
import { StatTile } from "@/components/ui";
import { formatBytes, formatRelativeTime } from "@/lib/format";

/** Friendly names for the bucket's top-level key prefixes. */
const PREFIX_LABELS: Record<string, string> = {
  dt_backups: "Database backups",
  dt_videos: "Processed videos",
  dt_raw: "Raw video uploads",
};

export function B2UsagePanel({ usage }: { usage: B2Usage }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAllLargest, setShowAllLargest] = useState(false);

  const { estimate } = usage;
  const freeTierGb = estimate.free_storage_bytes / 1_000_000_000;
  const underFreeTier = usage.total_bytes <= estimate.free_storage_bytes;
  const largest = showAllLargest ? usage.largest : usage.largest.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Total stored"
          value={formatBytes(usage.total_bytes)}
          hint={`${usage.objects.toLocaleString()} objects in ${usage.bucket}`}
        />
        <StatTile
          label="Est. storage cost"
          value={
            underFreeTier ? (
              <span className="text-osrs-green">$0.00/mo</span>
            ) : (
              `$${estimate.storage_usd_per_month.toFixed(2)}/mo`
            )
          }
          hint={
            underFreeTier
              ? `within the ${freeTierGb} GB free tier`
              : `$${(estimate.storage_rate_usd_per_gb_month * 1000).toFixed(0)}/TB/mo after ${freeTierGb} GB free`
          }
        />
        <StatTile
          label="Free egress"
          value={`${formatBytes(estimate.free_egress_bytes_per_month)}/mo`}
          hint="3× stored bytes; overage $0.01/GB"
        />
        <StatTile
          label="Scanned"
          value={formatRelativeTime(usage.generated_at)}
          hint="listed live from B2"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => startTransition(() => router.refresh())}
          disabled={pending}
          className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-2.5 py-1 text-xs disabled:opacity-50"
        >
          {pending ? "…" : "Rescan bucket"}
        </button>
        <span className="text-osrs-parchment-dark/50 text-xs">
          Estimates use current bytes; Backblaze bills on the monthly average.
        </span>
      </div>

      <section>
        <h3 className="text-osrs-gold mb-2 text-sm font-semibold">Storage by prefix</h3>
        <ul className="divide-osrs-bronze/20 divide-y">
          {usage.prefixes.map((p) => {
            const share = usage.total_bytes > 0 ? (p.total_bytes / usage.total_bytes) * 100 : 0;
            return (
              <li key={p.prefix} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="font-medium">{PREFIX_LABELS[p.prefix] ?? p.prefix}</span>
                    <span className="text-osrs-parchment-dark/50 ml-2 text-xs">{p.prefix}/</span>
                  </div>
                  <span className="text-osrs-parchment-dark/60 text-xs tabular-nums">
                    {p.objects.toLocaleString()} objects · {formatBytes(p.total_bytes)} ·{" "}
                    {share.toFixed(1)}%
                  </span>
                </div>
                <div className="bg-osrs-brown-dark/60 mt-1.5 h-1.5 overflow-hidden rounded">
                  <div
                    className="bg-osrs-gold/60 h-full rounded"
                    style={{ width: `${Math.max(share, 0.5)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="text-osrs-gold mb-2 text-sm font-semibold">Largest objects</h3>
        <ul className="divide-osrs-bronze/20 divide-y">
          {largest.map((obj) => (
            <li
              key={obj.key}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
            >
              <span className="min-w-0 break-all">{obj.key}</span>
              <span className="text-osrs-parchment-dark/60 shrink-0 text-xs tabular-nums">
                {formatBytes(obj.size)} · {formatRelativeTime(obj.modified)}
              </span>
            </li>
          ))}
        </ul>
        {usage.largest.length > 5 && (
          <button
            onClick={() => setShowAllLargest((v) => !v)}
            className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright mt-2 text-xs"
          >
            {showAllLargest ? "Show fewer" : `Show all ${usage.largest.length}`}
          </button>
        )}
      </section>
    </div>
  );
}
