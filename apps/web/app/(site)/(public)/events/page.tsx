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
  const [active, past, upcoming, recruiting] = await Promise.all([
    api.events({ status: "active" }),
    api.events({ status: "past" }),
    // Drafts the signed-in viewer may see: events of clans they belong to
    // (pre-publication landing) plus drafts they administer.
    user ? api.eventsForAdmin({ status: "draft" }).catch(() => []) : Promise.resolve([]),
    user ? api.eventRecruiting().catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-osrs-gold text-2xl font-bold">Events & Competitions</h1>
        <p className="text-osrs-parchment-dark/70 mt-2 max-w-3xl text-sm">
          Events are competitions hosted by DropTracker groups — bingo boards, team races, and
          task lists built from real in-game goals: boss drops, killcounts, XP, personal bests,
          pets, and more. Progress tracks itself — play with the DropTracker RuneLite plugin
          installed and the moment a drop lands or a record falls, the matching tile is credited
          and the scoreboard updates live, both here and in the hosting group&apos;s Discord.
        </p>
        <p className="text-osrs-parchment-dark/70 mt-2 max-w-3xl text-sm">
          Joining is free: be a member of the hosting group, run the plugin, and you&apos;re in.
          Hosting your own is available to groups subscribed to the{" "}
          <Link href="/premium" className="text-osrs-gold-bright hover:underline">
            Patron tier
          </Link>
          .
        </p>
      </header>
      {recruiting.length > 0 && <EventRecruitingBanner items={recruiting} />}
      {upcoming.length > 0 && (
        <EventSection title="Upcoming" events={upcoming} empty="" />
      )}
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
                  {e.status === "draft" && (
                    <span className="bg-osrs-green/15 text-osrs-green rounded px-1.5 py-0.5 text-xs">
                      Upcoming
                    </span>
                  )}
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
