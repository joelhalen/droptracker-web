"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Select, ToggleChip } from "@/components/ui";
import { periodLabel, periodOptions } from "@/lib/group-stats";

/** Period switcher for the clan stats page: quick picks plus every month and year. */
export function GroupStatsPeriod({ base, period, dataSince }: { base: string; period: string; dataSince: string }) {
  const router = useRouter();
  const { months, years } = periodOptions(dataSince);
  const go = (p: string) => router.push(`${base}/stats?period=${p}` as Route);
  const quick = [
    { key: months[0], label: "This month" },
    { key: months[1], label: "Last month" },
    { key: years[0], label: "This year" },
    { key: "all", label: "All time" },
  ].filter((q): q is { key: string; label: string } => Boolean(q.key));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {quick.map((q) => (
        <ToggleChip key={q.key} shape="tab" active={period === q.key} onClick={() => go(q.key)}>
          {q.label}
        </ToggleChip>
      ))}
      <Select fieldSize="sm" className="w-auto" value={period} onChange={(e) => go(e.target.value)} aria-label="Choose a period">
        <optgroup label="Months">
          {months.map((m) => (
            <option key={m} value={m}>
              {periodLabel(m)}
            </option>
          ))}
        </optgroup>
        <optgroup label="Years">
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </optgroup>
        <option value="all">All time</option>
      </Select>
    </div>
  );
}
