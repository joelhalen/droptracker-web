import type { Metadata } from "next";
import Link from "next/link";
import type { EventSummary } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { EventRecruitingBanner } from "@/components/event-recruiting-banner";
import { EventWindow } from "@/components/local-time";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Events",
  description: "Active and past DropTracker clan events, bingos, and competitions.",
};

export default async function EventsPage() {
  const user = await getUser().catch(() => null);
  const [active, past, recruiting] = await Promise.all([
    api.events({ status: "active" }),
    api.events({ status: "past" }),
    user ? api.eventRecruiting().catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-10">
      <h1 className="text-osrs-gold text-3xl font-bold">Events</h1>
      {recruiting.length > 0 && <EventRecruitingBanner items={recruiting} />}
      <EventSection title="Active" events={active} empty="No active events right now." />
      <EventSection title="Past" events={past} empty="No past events yet." />
    </div>
  );
}

function EventSection({
  title,
  events,
  empty,
}: {
  title: string;
  events: EventSummary[];
  empty: string;
}) {
  return (
    <section>
      <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">{title}</h2>
      {events.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/events/${e.id}`}
                className="border-osrs-bronze/20 hover:border-osrs-gold/50 block rounded border p-4 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-osrs-gold-bright font-medium">{e.name}</span>
                  {e.has_bingo && (
                    <span className="bg-osrs-gold/20 text-osrs-gold rounded px-1.5 py-0.5 text-xs">
                      Bingo
                    </span>
                  )}
                </div>
                {e.description && (
                  <p className="text-osrs-parchment-dark/70 mt-1 line-clamp-2 text-sm">
                    {e.description}
                  </p>
                )}
                <p className="text-osrs-parchment-dark/50 mt-2 text-xs">
                  <EventWindow startsAt={e.starts_at} endsAt={e.ends_at} status={e.status} />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-osrs-parchment-dark/60 text-sm">{empty}</p>
      )}
    </section>
  );
}
