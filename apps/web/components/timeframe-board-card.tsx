"use client";

import { useMemo, useState, useTransition } from "react";
import { generateTimeframeBoard } from "@/app/(admin)/groups/[id]/settings/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Card, fieldInputClass } from "@/components/ui";

/** Earliest day any loot data exists (rollup epoch, backend-enforced too). */
const MIN_DATE = "2024-10-01";

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Custom-timeframe lootboard generator (group settings page).
 *
 * Leaders pick an inclusive start/end date and get a shareable PNG rendered
 * from the same pipeline as the scheduled boards. Recent ranges come from the
 * Redis daily cache; older ranges from the hourly rollup — months whose
 * historical backfill hasn't landed yet are refused with a friendly message
 * from the backend, which is surfaced verbatim here.
 */
export function TimeframeBoardCard({ groupId }: { groupId: number }) {
  const today = useMemo(isoToday, []);
  const [startDate, setStartDate] = useState(isoDaysAgo(7));
  const [endDate, setEndDate] = useState(today);
  const [result, setResult] = useState<{ url: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const invalidReason = useMemo(() => {
    if (!startDate || !endDate) return "Pick both dates.";
    if (startDate > endDate) return "Start date must be on or before the end date.";
    if (endDate > today) return "End date cannot be in the future.";
    if (startDate < MIN_DATE) return `No loot data exists before ${MIN_DATE}.`;
    return null;
  }, [startDate, endDate, today]);

  const onGenerate = () => {
    if (invalidReason) {
      setError(invalidReason);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await generateTimeframeBoard(groupId, startDate, endDate);
        setResult({ url: res.url, label: `${res.start_date} → ${res.end_date}` });
      } catch (err) {
        setResult(null);
        setError(getErrorMessage(err, "Couldn't generate the board. Please try again."));
      }
    });
  };

  return (
    <Card padding="p-6" className="mb-6">
      <h2 className="text-osrs-gold mb-1 text-lg font-semibold">Custom timeframe lootboard</h2>
      <p className="text-osrs-parchment-dark/60 mb-4 text-xs">
        Generate a shareable lootboard image covering any date range — for events,
        competitions, or a look back. Uses your group&apos;s configured board style.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-sm font-medium">Start date</span>
          <input
            type="date"
            value={startDate}
            min={MIN_DATE}
            max={endDate || today}
            onChange={(e) => setStartDate(e.target.value)}
            className={`${fieldInputClass} mt-1`}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium">End date</span>
          <input
            type="date"
            value={endDate}
            min={startDate || MIN_DATE}
            max={today}
            onChange={(e) => setEndDate(e.target.value)}
            className={`${fieldInputClass} mt-1`}
          />
        </label>
        <button
          type="button"
          onClick={onGenerate}
          disabled={pending || Boolean(invalidReason)}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Generating…" : "Generate board"}
        </button>
      </div>

      {invalidReason && !pending && (
        <p className="text-osrs-parchment-dark/60 mt-2 text-xs">{invalidReason}</p>
      )}
      {error && (
        <div className="mt-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      {result && (
        <div className="mt-4">
          <p className="text-osrs-parchment-dark/70 mb-2 text-xs">
            Board for <span className="font-medium">{result.label}</span> —{" "}
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-osrs-gold-bright hover:underline"
            >
              open full size ↗
            </a>
          </p>
          {/* Plain <img>: the PNG lives on the external image host. */}
          <img
            src={result.url}
            alt={`Lootboard ${result.label}`}
            className="border-osrs-bronze/30 w-full max-w-2xl rounded-lg border"
          />
        </div>
      )}
    </Card>
  );
}
