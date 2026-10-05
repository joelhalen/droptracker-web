"use client";

/**
 * A clan's or player's recap inside the Activity: the site's own `RecapCard`
 * (the poster a Discord recap post links to) with the archive of periods as a
 * picker. Used as the group view's Recaps tab and as the player recap view.
 */
import { useEffect, useState } from "react";
import { RecapCard, formatPeriod } from "@/components/recap-card";
import { recapView, type RecapView } from "@/lib/activity/api";
import { SITE_ORIGIN } from "@/lib/activity/external-url";
import { useActivityNav } from "@/lib/activity/nav";
import { BackBar, EmptyNote, ErrorNote, ExternalButton, LoadingBlock } from "@/components/activity/bits";

export function RecapPanel({ scope, id }: { scope: "group" | "player"; id: number }) {
  const [period, setPeriod] = useState<string | undefined>(undefined);
  const [view, setView] = useState<RecapView | null>(null);
  const [failed, setFailed] = useState(false);
  // The archive only comes with a read; keep it while the next period loads.
  const [periods, setPeriods] = useState<RecapView["periods"]>([]);

  useEffect(() => {
    let cancelled = false;
    setView(null);
    setFailed(false);
    recapView(scope, id, period)
      .then((v) => {
        if (cancelled) return;
        setView(v);
        if (v.periods.length) setPeriods(v.periods);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, id, period]);

  const shown = view?.period ?? period;
  const sitePath =
    scope === "group"
      ? `${SITE_ORIGIN}/groups/${id}/recap/${shown ?? ""}`
      : `${SITE_ORIGIN}/players/${id}/recap${shown ? `/${shown}` : ""}`;

  return (
    <div>
      {periods.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {periods.slice(0, 12).map((p) => (
            <button
              key={p.period}
              type="button"
              onClick={() => setPeriod(p.period)}
              aria-pressed={shown === p.period}
              className={`rounded-lg px-2.5 py-1 text-[12px] ${
                shown === p.period
                  ? "bg-osrs-bronze text-osrs-parchment font-semibold"
                  : "text-osrs-parchment-dark/70 hover:text-osrs-gold-bright"
              }`}
            >
              {formatPeriod(p.period)}
            </button>
          ))}
        </div>
      )}
      {failed ? (
        <ErrorNote>Couldn&apos;t load this recap.</ErrorNote>
      ) : !view ? (
        <LoadingBlock rows={6} />
      ) : !view.recap ? (
        <EmptyNote>
          {scope === "group"
            ? "No recaps yet. A clan's card is made at the end of each month once it has tracked loot."
            : "Not enough tracked activity for a recap this month yet."}
        </EmptyNote>
      ) : (
        <>
          <RecapCard recap={view.recap} fluid />
          {shown && <ExternalButton href={sitePath}>Open this recap on droptracker.io</ExternalButton>}
        </>
      )}
    </div>
  );
}

/** Pushed view: a player's recap (from their profile). */
export function PlayerRecapView({ id, name }: { id: number; name?: string }) {
  const nav = useActivityNav();
  return (
    <div>
      <BackBar title={name ? `${name}'s recap` : "Recap"} onBack={nav.pop} />
      <RecapPanel scope="player" id={id} />
    </div>
  );
}
