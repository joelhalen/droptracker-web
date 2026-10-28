/**
 * A group's public events, for its page and the filtered /events view
 * (suggestion #210).
 *
 * Pure (client-safe, unit-tested). The API already hides drafts and private
 * events from anonymous lists; the private filter here is a second guard for
 * signed-in fetches, which can include them.
 */
import type { EventSummary } from "@droptracker/api-types";

export type GroupEvents = {
  /** Running now, soonest to finish first (open-ended last). */
  live: EventSummary[];
  /** Finished, most recent first. */
  past: EventSummary[];
};

export function publicGroupEvents(active: EventSummary[], past: EventSummary[]): GroupEvents {
  const shown = (e: EventSummary) => e.visibility !== "private";
  return {
    live: active
      .filter((e) => shown(e) && e.status === "active")
      .sort((a, b) => (a.ends_at ?? Infinity) - (b.ends_at ?? Infinity)),
    past: past
      .filter((e) => shown(e) && e.status === "past")
      .sort((a, b) => (b.ends_at ?? b.starts_at ?? 0) - (a.ends_at ?? a.starts_at ?? 0)),
  };
}

export function hasGroupEvents(events: GroupEvents | null | undefined): boolean {
  return !!events && events.live.length + events.past.length > 0;
}

/** The /events list for one group. Takes the group's slug when it has one. */
export function groupEventsHref(group: { id: number; canonical_slug?: string | null }): string {
  return `/events?group=${encodeURIComponent(group.canonical_slug || String(group.id))}`;
}

/** The `?group=` value from /events search params, or null when absent/blank. */
export function groupFilterParam(raw: string | string[] | undefined): string | null {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value ? value : null;
}
