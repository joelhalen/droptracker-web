"use client";

/**
 * EHE — Efficient Hours towards Event.
 *
 * One home for the label, the explanation and the chip, because the number
 * needs a caveat wherever it appears: it is an ESTIMATE of time spent
 * progressing an event's tasks, and it is wrong in knowable ways (bosses with
 * no published rate score zero, rates are averages, and anything the tracker
 * can't see never counted). Saying that once, next to every instance, is
 * cheaper than fielding "why is my EHE 0" forever.
 *
 * The tooltip is a HoverCard rather than a `title` attribute deliberately —
 * `title` never appears on touch, and this is the number people will most want
 * explained on a phone.
 */
import type { ReactNode } from "react";
import type { EventEffort } from "@droptracker/api-types";
import { HoverCard } from "@/components/hover-card";
import { effortSummary, formatEheHours } from "@/lib/events";

export const EHE_FULL_NAME = "Efficient Hours towards Event";

/** Copy for the one state where the number is not a measurement at all. */
export const EHE_UNAVAILABLE = "EHE unavailable";

/**
 * Whether an EHE figure is currently meaningful.
 *
 * The rate table lives in a cache the backend keeps warm; when it is cold
 * every boss with a published rate prices at 0 and the total collapses to
 * whatever our own derived rates happened to cover. That is an undercount, not
 * a measurement, and it is indistinguishable from "this player did nothing"
 * unless we say so — which is exactly how a site-wide outage went unnoticed
 * for a day on 2026-08-28.
 *
 * Defaults to true when the flag is absent so an older API response, or a
 * payload that carries only a scalar, renders exactly as it did before.
 */
export function eheRatesKnown(ratesKnown?: boolean | null): boolean {
  return ratesKnown !== false;
}

/** The explanation body, shared by every EHE tooltip on the site. */
export function EheExplainer({
  effort,
  estimated = false,
  ratesKnown,
}: {
  effort?: EventEffort | null;
  /** True when the figure includes hours priced with DropTracker-derived
   * rates (bosses WOM publishes no rate for) — adds the tilde explanation. */
  estimated?: boolean;
  /** False when the rate table could not be read — see `eheRatesKnown`. */
  ratesKnown?: boolean | null;
}) {
  const hasEstimate = estimated || (effort?.ehb_estimated_hours ?? 0) > 0;
  const known = eheRatesKnown(ratesKnown ?? effort?.rates_known);
  return (
    <div className="space-y-2 text-xs">
      <div>
        <div className="text-osrs-gold-bright font-semibold">EHE</div>
        <div className="text-osrs-parchment-dark/70">{EHE_FULL_NAME}</div>
      </div>
      {!known && (
        <p className="text-osrs-gold-bright/90">
          Efficiency rates are temporarily unavailable, so hours can&apos;t be
          calculated right now. Kills are still being recorded — the figures
          fill back in on their own once rates return.
        </p>
      )}
      <p className="text-osrs-parchment/85">
        An estimate of the time this player spent working towards this event&apos;s tasks
        — counted from kills at the bosses those tasks care about, whether or not
        anything dropped.
      </p>
      {effort && (effort.kills ?? 0) > 0 && (
        <p className="text-osrs-parchment-dark/70">{effortSummary(effort)}.</p>
      )}
      {hasEstimate && (
        <p className="text-osrs-parchment-dark/70">
          The ~ marks hours priced with DropTracker&apos;s own kill-rate estimates,
          used for bosses that have no published efficiency rate (usually new
          content). Published rates always win where they exist.
        </p>
      )}
      <p className="text-osrs-parchment-dark/60">
        It is approximate and can be skewed: bosses with no rate at all count as
        0 hours, rates are averages rather than this player&apos;s real pace, and
        anything the tracker never saw was never counted.
      </p>
    </div>
  );
}

/** The word "EHE" with its explainer attached. Use beside a bare number. */
export function EheLabel({ className = "" }: { className?: string }) {
  return (
    <HoverCard content={<EheExplainer />} width={272}>
      <span
        className={`cursor-help decoration-dotted underline-offset-2 hover:underline ${className}`}
      >
        EHE
      </span>
    </HoverCard>
  );
}

/**
 * The inline "3.5h EHE" chip used on roster cards and leaderboard rows.
 * Renders nothing when there is no tracked effort — an em-dash on every member
 * who hasn't been seen yet is noise, not information.
 */
export function EheChip({
  effort,
  className = "",
  children,
}: {
  effort?: EventEffort | null;
  className?: string;
  /** Optional prefix (e.g. a rank medal) rendered inside the trigger. */
  children?: ReactNode;
}) {
  if (!effort || (effort.kills ?? 0) <= 0) return null;
  const estimated = (effort.ehb_estimated_hours ?? 0) > 0;
  if (!eheRatesKnown(effort.rates_known)) {
    // The kills are real and worth showing; the hours are not. Saying so beats
    // a confident "0h EHE" next to a player who bossed all week.
    return (
      <HoverCard content={<EheExplainer effort={effort} />} width={272}>
        <span
          className={`cursor-help text-osrs-parchment-dark/60 italic ${className}`}
        >
          {children}
          {EHE_UNAVAILABLE}
        </span>
      </HoverCard>
    );
  }
  return (
    <HoverCard content={<EheExplainer effort={effort} />} width={272}>
      <span className={`cursor-help tabular-nums ${className}`}>
        {children}
        {formatEheHours(effort.ehb_hours, estimated)}{" "}
        <span className="uppercase">EHE</span>
      </span>
    </HoverCard>
  );
}

/**
 * "3.5h EHE" from a bare hours figure — for payloads that carry only the
 * scalar (the event-detail team rosters). Same chip, minus the per-player
 * gloss, because there are no per-boss numbers to gloss with.
 */
export function EheHoursChip({
  hours,
  estimatedHours,
  ratesKnown,
  className = "",
}: {
  hours: number | null | undefined;
  /** The estimated (derived-rate) portion of `hours` — >0 adds the tilde. */
  estimatedHours?: number | null;
  /** False when the rate table could not be read — see `eheRatesKnown`. */
  ratesKnown?: boolean | null;
  className?: string;
}) {
  const estimated = (estimatedHours ?? 0) > 0;
  if (!eheRatesKnown(ratesKnown)) {
    return (
      <HoverCard content={<EheExplainer ratesKnown={false} />} width={272}>
        <span className={`cursor-help text-osrs-parchment-dark/60 italic ${className}`}>
          {EHE_UNAVAILABLE}
        </span>
      </HoverCard>
    );
  }
  if (!hours || hours <= 0) return null;
  return (
    <HoverCard content={<EheExplainer estimated={estimated} />} width={272}>
      <span className={`cursor-help tabular-nums ${className}`}>
        {formatEheHours(hours, estimated)} <span className="uppercase">EHE</span>
      </span>
    </HoverCard>
  );
}

/**
 * A bare hours figure with the explainer — for stat tiles and team totals,
 * where a zero is meaningful ("this team has no tracked effort yet") and so is
 * rendered rather than hidden.
 */
export function EheValue({
  hours,
  estimatedHours,
  ratesKnown,
}: {
  hours: number | null | undefined;
  /** The estimated (derived-rate) portion of `hours` — >0 adds the tilde. */
  estimatedHours?: number | null;
  /** False when the rate table could not be read — see `eheRatesKnown`. */
  ratesKnown?: boolean | null;
}) {
  const estimated = (estimatedHours ?? 0) > 0;
  if (!eheRatesKnown(ratesKnown)) {
    return (
      <HoverCard content={<EheExplainer ratesKnown={false} />} width={272}>
        <span className="cursor-help text-osrs-parchment-dark/60 text-sm italic">
          unavailable
        </span>
      </HoverCard>
    );
  }
  return (
    <HoverCard content={<EheExplainer estimated={estimated} />} width={272}>
      <span className="cursor-help tabular-nums">
        {formatEheHours(hours, estimated)}
      </span>
    </HoverCard>
  );
}
