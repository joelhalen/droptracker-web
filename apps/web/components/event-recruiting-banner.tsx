import type { Route } from "next";
import Link from "next/link";
import type { EventRecruitingItem } from "@droptracker/api-types";

/** Banner for clan-vs-clan events the viewer's clans are recruiting for. */
export function EventRecruitingBanner({ items }: { items: EventRecruitingItem[] }) {
  if (!items.length) return null;

  return (
    <section className="border-osrs-gold/30 bg-osrs-gold/5 rounded border p-4">
      <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Your clans are recruiting</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={`${item.event.id}-${item.group_id}`} className="text-sm">
            <Link
              href={`/events/${item.event.id}` as Route}
              className="text-osrs-gold-bright hover:underline font-medium"
            >
              {item.event.name}
            </Link>
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
