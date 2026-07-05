import type { Metadata, Route } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { EventCreateForm } from "@/components/event-create-form";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Events" };

// Superadmin oversight (Task 21 / PRD D6): every event on the site — group
// events link into their group's manager (superadmin bypasses group checks);
// global events (group_id null) are managed right here under /admin/events.
export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  draft: "bg-osrs-bronze/20 text-osrs-parchment-dark/80",
  active: "bg-green-500/15 text-green-400",
  past: "bg-osrs-brown-dark/60 text-osrs-parchment-dark/50",
};

export default async function AdminEventsPage() {
  // Authed list: as a superadmin this includes every draft (group + global).
  const events = await api.eventsForAdmin({});

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
          New global event
        </h2>
        <p className="text-osrs-parchment-dark/70 mb-3 text-sm">
          Global events belong to no group — any player with a linked account can join. They
          start as drafts: add tasks, teams, and a board, then activate. Group events are
          created from each group&apos;s own Events tab.
        </p>
        <EventCreateForm groupId={null} />
      </section>

      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
          All events
        </h2>
        {events.length ? (
          <ul className="divide-osrs-bronze/20 divide-y">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link
                    href={
                      (e.group_id == null
                        ? `/admin/events/${e.id}`
                        : `/groups/${e.group_id}/events/${e.id}`) as Route
                    }
                    className="hover:text-osrs-gold-bright block truncate font-medium"
                  >
                    {e.name}
                  </Link>
                  <span className="text-osrs-parchment-dark/50 text-xs">
                    {e.group_id == null ? "Global" : `Group #${e.group_id}`}
                    {e.has_bingo ? " · bingo" : ""}
                  </span>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={`${STATUS_CHIP[e.status] ?? ""} rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide`}
                  >
                    {e.status}
                  </span>
                  <Link
                    href={
                      (e.group_id == null
                        ? `/admin/events/${e.id}`
                        : `/groups/${e.group_id}/events/${e.id}`) as Route
                    }
                    className="text-osrs-gold-bright text-xs hover:underline"
                  >
                    Manage →
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No events yet" hint="Create a global event, or check back once groups start running theirs." />
        )}
      </section>
    </div>
  );
}
