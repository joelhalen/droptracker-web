"use client";

import { useState, useTransition } from "react";
import type { EventDetail } from "@droptracker/api-types";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Button, Checkbox, Input } from "@/components/ui";
import { updateGroupEvent } from "@/app/(site)/(admin)/groups/[id]/events/actions";

/** Blank = no limit; otherwise a whole number of players. */
export function parseRosterLimit(v: string): number | null | "bad" {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 1 && n <= 500 ? n : "bad";
}

/**
 * Staff settings for a global clan-vs-clan event (web119a): how many players
 * each clan fields, and whether clan leaders can still change their roster
 * once the event is live. A clan under the minimum at the start is left out.
 */
export function EventClanRosterLimits({ event }: { event: EventDetail }) {
  const [min, setMin] = useState(event.clan_roster_min?.toString() ?? "");
  const [max, setMax] = useState(event.clan_roster_max?.toString() ?? "");
  const [locked, setLocked] = useState(event.clan_roster_locked_at_start ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const lo = parseRosterLimit(min);
    const hi = parseRosterLimit(max);
    if (lo === "bad" || hi === "bad") {
      setError("Limits are whole numbers from 1 to 500, or blank for no limit.");
      return;
    }
    if (lo != null && hi != null && lo > hi) {
      setError("The minimum can't be larger than the maximum.");
      return;
    }
    startTransition(async () => {
      try {
        await updateGroupEvent(null, event.id, {
          clan_roster_min: lo,
          clan_roster_max: hi,
          clan_roster_locked_at_start: locked,
        });
        setSaved(true);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save the roster limits."));
      }
    });
  };

  return (
    <form onSubmit={save} className="border-osrs-bronze/30 mb-6 rounded border p-4">
      <h4 className="text-osrs-gold mb-1 font-semibold">Players per clan</h4>
      <p className="text-osrs-parchment-dark/60 mb-3 text-xs">
        Each clan&apos;s leaders pick their roster from their members&apos; sign-ups. A clan with
        fewer than the minimum when the event starts is left out.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-osrs-parchment-dark/70 text-xs">
          Minimum
          <Input
            fieldSize="sm"
            inputMode="numeric"
            placeholder="None"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="mt-1 block w-24"
          />
        </label>
        <label className="text-osrs-parchment-dark/70 text-xs">
          Maximum
          <Input
            fieldSize="sm"
            inputMode="numeric"
            placeholder="None"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="mt-1 block w-24"
          />
        </label>
        <label className="text-osrs-parchment-dark/80 flex items-center gap-2 pb-1.5 text-xs">
          <Checkbox checked={locked} onChange={(e) => setLocked(e.target.checked)} />
          Lock rosters when the event starts
        </label>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          Save
        </Button>
        {saved && <span className="pb-1.5 text-xs text-green-400">Saved</span>}
      </div>
      {error && (
        <div className="mt-3">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
    </form>
  );
}
