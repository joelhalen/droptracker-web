import type { Route } from "next";
import Link from "next/link";
import type { EventRecruitingItem } from "@droptracker/api-types";

/** Banner for clan-vs-clan events the viewer's clans are recruiting for.
 *
 * Shared by the site's events page and the Discord Activity's Events tab. The
 * Activity passes `onOpenEvent` (an in-app view push) — a site link would
 * navigate the iframe out of the Activity; the site leaves it unset. */
export function EventRecruitingBanner({
  items,
  onOpenEvent,
}: {
  items: EventRecruitingItem[];
  onOpenEvent?: (eventId: number) => void;
}) {
  if (!items.length) return null;

  return (
    <section className="border-osrs-gold/30 bg-osrs-gold/5 rounded border p-4">
      <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Your clans are recruiting</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={`${item.event.id}-${item.group_id}`} className="text-sm">
            {onOpenEvent ? (
              <button
                type="button"
                onClick={() => onOpenEvent(item.event.id)}
                className="text-osrs-gold-bright hover:underline text-left font-medium"
              >
                {item.event.name}
              </button>
            ) : (
              <Link
                href={`/events/${item.event.id}` as Route}
                className="text-osrs-gold-bright hover:underline font-medium"
              >
                {item.event.name}
              </Link>
            )}
            <span className="text-osrs-parchment-dark/70">
              {" "}
              — {item.group_name ?? `Clan ${item.group_id}`} is looking for players. Opt in on the
              event page.
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
