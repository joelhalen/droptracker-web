"use client";

/**
 * Member roster for group mini-sites (sites-v1).
 *
 * Replaces the original two-column name/GP list. Rank is always the member's
 * position by monthly GP (assigned server-side before any display sort), so
 * "#3" means the same thing however the visitor chooses to order the list.
 * Visitors can re-sort client-side when the block allows it — the payload is
 * already loaded, so sorting costs nothing extra.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { SiteRosterMember } from "@droptracker/api-types";
import { RankMedal } from "@/components/ui";

type SortKey = "monthly" | "all_time" | "name";

const SORT_LABELS: Array<{ key: SortKey; label: string }> = [
  { key: "monthly", label: "This month" },
  { key: "all_time", label: "All time" },
  { key: "name", label: "Name" },
];

function sortMembers(members: SiteRosterMember[], key: SortKey): SiteRosterMember[] {
  const out = [...members];
  if (key === "name") out.sort((a, b) => a.name.localeCompare(b.name));
  else if (key === "all_time")
    out.sort((a, b) => (b.all_time_loot?.value ?? 0) - (a.all_time_loot?.value ?? 0));
  else out.sort((a, b) => b.monthly_loot.value - a.monthly_loot.value);
  return out;
}

export function SiteRoster({
  members,
  total,
  initialSort = "monthly",
  layout = "cards",
  showRank = true,
  sortable = true,
}: {
  members: SiteRosterMember[];
  total: number;
  initialSort?: SortKey;
  layout?: "cards" | "table";
  showRank?: boolean;
  sortable?: boolean;
}) {
  const [sort, setSort] = useState<SortKey>(initialSort);
  const rows = useMemo(() => sortMembers(members, sort), [members, sort]);

  const controls = sortable ? (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="text-osrs-parchment-dark/60 mr-1 text-xs">Sort by</span>
      {SORT_LABELS.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => setSort(s.key)}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            sort === s.key
              ? "bg-osrs-bronze text-osrs-parchment"
              : "border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:bg-osrs-bronze/25 border"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  ) : null;

  const footer =
    total > members.length ? (
      <p className="text-osrs-parchment-dark/60 mt-3 text-xs">
        Showing {members.length} of {total.toLocaleString()} members.
      </p>
    ) : null;

  if (layout === "table") {
    return (
      <div>
        {controls}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-osrs-parchment-dark/60 border-osrs-bronze/30 border-b text-left text-xs uppercase">
                {showRank && <th className="w-14 py-2 pr-2 font-medium">#</th>}
                <th className="py-2 pr-3 font-medium">Member</th>
                <th className="py-2 pr-3 text-right font-medium">This month</th>
                <th className="py-2 text-right font-medium">All time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-osrs-bronze/15 hover:bg-osrs-surface-2/50 border-b">
                  {showRank && (
                    <td className="text-osrs-parchment-dark/70 py-2 pr-2 tabular-nums">
                      {m.rank || "—"}
                    </td>
                  )}
                  <td className="py-2 pr-3">
                    <Link
                      href={`/players/${m.id}` as Route}
                      className="hover:text-osrs-gold font-medium"
                    >
                      {m.name}
                    </Link>
                  </td>
                  <td className="text-osrs-gold-bright py-2 pr-3 text-right tabular-nums">
                    {m.monthly_loot.value > 0 ? m.monthly_loot.value_formatted : "—"}
                  </td>
                  <td className="text-osrs-parchment-dark/80 py-2 text-right tabular-nums">
                    {m.all_time_loot && m.all_time_loot.value > 0
                      ? m.all_time_loot.value_formatted
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div>
      {controls}
      <ul className="grid gap-2 sm:grid-cols-2">
        {rows.map((m) => (
          <li key={m.id}>
            <Link
              href={`/players/${m.id}` as Route}
              className="border-osrs-bronze/25 bg-osrs-surface-2/40 hover:border-osrs-gold/50 hover:bg-osrs-surface-2 flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors"
            >
              {showRank &&
                (m.rank && m.rank <= 3 ? (
                  <RankMedal rank={m.rank} />
                ) : (
                  <span className="text-osrs-parchment-dark/50 w-6 shrink-0 text-center text-sm tabular-nums">
                    {m.rank || "—"}
                  </span>
                ))}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{m.name}</span>
                {m.all_time_loot && m.all_time_loot.value > 0 && (
                  <span className="text-osrs-parchment-dark/55 block text-[11px]">
                    {m.all_time_loot.value_formatted} all time
                  </span>
                )}
              </span>
              <span className="text-osrs-gold-bright shrink-0 text-sm tabular-nums">
                {m.monthly_loot.value > 0 ? m.monthly_loot.value_formatted : "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {footer}
    </div>
  );
}
