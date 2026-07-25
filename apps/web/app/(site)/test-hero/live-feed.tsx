"use client";

/**
 * Live activity panel + platform stat grid for /test-hero.
 *
 * The panel is seeded server-side from `api.recentFeed()` (the capped Redis
 * history behind the site ticker) and then subscribes to the same `feed`
 * realtime scope through the BFF SSE proxy, so it keeps updating while the
 * visitor reads the page. New rows flash gold once and settle.
 */
import { useMemo, useRef, useState } from "react";
import { formatGp } from "@/lib/format";
import { useEventStream } from "@/lib/use-event-stream";
import { toRow, type FeedRow } from "./feed-rows";
import { CountUp } from "./motion";
import { MEASURED } from "./showcase-data";

const MAX_ROWS = 14;

export function LiveFeed({ seed }: { seed: FeedRow[] }) {
  const [rows, setRows] = useState<FeedRow[]>(seed);
  const seen = useRef(0);

  const { state } = useEventStream(["feed"], (event) => {
    seen.current += 1;
    const row = toRow(event.type, event.data, `live-${seen.current}-${event.ts}`, true);
    if (!row) return;
    setRows((prev) => [row, ...prev].slice(0, MAX_ROWS));
  });

  const label = state === "open" ? "connected" : state === "connecting" ? "connecting…" : "offline";

  return (
    <div className="th-feed">
      <div className="th-feed-head">
        <i className="th-dot" data-state={state} />
        Live submissions
        <span>{label}</span>
      </div>
      <div className="th-feed-list">
        {rows.map((row) => (
          <div key={row.key} className="th-feed-item" data-fresh={row.fresh}>
            <span className="th-feed-icon">
              {row.iconUrl ? <img src={row.iconUrl} alt="" loading="lazy" /> : <span>◆</span>}
            </span>
            <span className="th-feed-text">
              <b>{row.who}</b> {row.verb} <em>{row.what}</em>
              {row.detail && <span>{row.detail}</span>}
            </span>
            {row.value !== null && (
              <span className="th-value" data-tier={row.value >= 100_000_000 ? "100m" : "10m"}>
                {formatGp(row.value)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat grid                                                                  */
/* -------------------------------------------------------------------------- */

export function StatGrid({
  monthlyLoot,
  playersTracked,
  rankedClans,
}: {
  /** Total GP tracked this month, live from the global group. */
  monthlyLoot: number;
  /** Accounts tracked, live from the global group. */
  playersTracked: number;
  rankedClans: number;
}) {
  // Rendered once — the measured snapshot never changes within a session.
  const asOf = useMemo(
    () =>
      new Date(`${MEASURED.asOf}T00:00:00Z`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }),
    [],
  );

  return (
    <div className="th-stats">
      <div className="th-stat">
        <b>
          <CountUp to={monthlyLoot} format={(n) => formatGp(n)} />
        </b>
        <small>GP tracked this month</small>
        <i>live, every account</i>
      </div>
      <div className="th-stat">
        <b>
          <CountUp to={playersTracked} />
        </b>
        <small>Accounts tracked</small>
        <i>live</i>
      </div>
      <div className="th-stat">
        <b>
          <CountUp to={MEASURED.submissionsThisMonth} />
        </b>
        <small>Submissions this month</small>
        <i>measured {asOf}</i>
      </div>
      <div className="th-stat">
        <b>
          <CountUp to={rankedClans} />
        </b>
        <small>Clans on the board</small>
        <i>ranked this month</i>
      </div>
    </div>
  );
}
