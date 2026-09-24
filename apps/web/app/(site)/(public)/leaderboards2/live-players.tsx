"use client";

/**
 * Player board with live updates: the SSE `global` scope sends one
 * `leaderboard_delta` per credited drop, applied to the matching card in
 * place (same contract as components/leaderboard-table.tsx). Clan boards have
 * no live feed (deltas carry no group id), so they stay on ISR.
 */
import { useEffect, useRef, useState } from "react";
import { useEventStream } from "@/lib/use-event-stream";
import { formatGp } from "@/lib/format";
import { PlayerCard } from "./cards";
import type { CardEntry } from "./board-data";

const FLASH_MS = 2600;

export function LivePlayers({
  entries,
  leader,
  withPodium,
}: {
  entries: CardEntry[];
  leader: number;
  withPodium: boolean;
}) {
  const [rows, setRows] = useState(entries);
  const [flashing, setFlashing] = useState<Set<number>>(new Set());

  useEffect(() => setRows(entries), [entries]);

  // Ids on this page, read synchronously by the stream handler (~7 deltas/s
  // platform-wide; most are for players who are not on the page).
  const idsRef = useRef(new Set<number>());
  idsRef.current = new Set(rows.map((r) => r.id));

  const { state } = useEventStream(["global"], (event) => {
    if (event.type !== "leaderboard_delta") return;
    const id = Number(event.data.id);
    const delta = Number(event.data.delta ?? 0);
    if (!Number.isFinite(id) || delta <= 0 || !idsRef.current.has(id)) return;
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const value = r.loot.value + delta;
        return { ...r, loot: { value, value_formatted: formatGp(value) }, delta };
      }),
    );
    setFlashing((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setFlashing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, delta: undefined } : r)));
    }, FLASH_MS);
  });

  const podium = withPodium ? rows.slice(0, 3) : [];
  const rest = withPodium ? rows.slice(3) : rows;

  return (
    <>
      <p className="lb2-live" data-state={state} aria-live="polite">
        <span className="lb2-live-dot" aria-hidden />
        {state === "open" ? "Live" : state === "connecting" ? "Connecting" : "Offline"}
      </p>
      {podium.length > 0 && (
        <div className="lb2-podium">
          {podium.map((e) => (
            <PlayerCard key={e.id} entry={e} leader={leader} podium flash={flashing.has(e.id)} />
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <div className="lb2-grid">
          {rest.map((e) => (
            <PlayerCard key={e.id} entry={e} leader={leader} flash={flashing.has(e.id)} />
          ))}
        </div>
      )}
    </>
  );
}

