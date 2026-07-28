import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { orAccessDenied } from "@/lib/fetch";
import { EventEffortPanel } from "@/components/event-effort-panel";

export const metadata: Metadata = { title: "Event effort report" };

type Params = Promise<{ id: string; eventId: string }>;

// Bingo EHB participation report — who is actually putting time into this
// event's bosses, and who has gone quiet. Manager-only (the API gates it too):
// it names people who look inactive, which is a leader's call to act on rather
// than a public scoreboard. Access to the subtree is gated by the
// (admin)/groups/[id] layout; the API re-checks on every request.
export default async function EventEffortPage({ params }: { params: Params }) {
  const { id, eventId } = await params;
  const groupId = Number(id);
  const evId = Number(eventId);
  if (!Number.isFinite(groupId) || !Number.isFinite(evId)) notFound();

  const report = await orAccessDenied(api.eventEffortReport(evId));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href={`/groups/${groupId}/events/${evId}` as Route}
          className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm"
        >
          ← Back to event manager
        </Link>
        <h2 className="text-osrs-gold mt-1 text-xl font-bold">Effort report</h2>
        <p className="text-osrs-parchment-dark/60 text-sm">
          {report.event.name} — kills at this event&apos;s bosses, whether or not anything
          dropped. Quietest members first.
        </p>
      </div>
      <EventEffortPanel report={report} />
    </div>
  );
}
