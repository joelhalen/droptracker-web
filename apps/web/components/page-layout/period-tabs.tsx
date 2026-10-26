"use client";

/**
 * Time-frame buttons for a page-builder board (clan points, loot boards).
 *
 * The server renders every offered period up front and hands the panels in,
 * so a switch is instant and needs no client-side fetching. Hidden panels
 * stay in the DOM with `hidden`; none of them may render `BlockEmpty`, or the
 * empty-block CSS would hide the whole slot.
 */
import { useState, type ReactNode } from "react";

export type PeriodPanel = { key: string; label: string; content: ReactNode };

export function PeriodTabs({ panels, initial }: { panels: PeriodPanel[]; initial: string }) {
  const [active, setActive] = useState(panels.some((p) => p.key === initial) ? initial : panels[0]?.key);
  return (
    <div>
      <div role="tablist" className="mb-3 flex flex-wrap gap-1.5">
        {panels.map((p) => (
          <button
            key={p.key}
            type="button"
            role="tab"
            aria-selected={p.key === active}
            onClick={() => setActive(p.key)}
            className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
              p.key === active
                ? "border-osrs-gold bg-osrs-gold/20 text-osrs-gold-bright"
                : "border-osrs-bronze/40 hover:border-osrs-gold/60 text-osrs-parchment-dark/80"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {panels.map((p) => (
        <div key={p.key} role="tabpanel" hidden={p.key !== active}>
          {p.content}
        </div>
      ))}
    </div>
  );
}

/** "No x this week yet" inside a panel (not BlockEmpty: see above). */
export function PeriodEmpty({ children }: { children: ReactNode }) {
  return <p className="text-osrs-parchment-dark/70 py-4 text-center text-sm">{children}</p>;
}
