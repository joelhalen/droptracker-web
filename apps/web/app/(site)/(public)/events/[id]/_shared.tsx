/**
 * Shared bits for the event tab pages (Overview / Players / Teams): the
 * auth-aware event load (with the web57a restricted-event AccessDenied / 404
 * branching) and the common header + tab bar. Colocated (not a `layout.tsx`)
 * because each tab page re-fetches only what it needs and the `teams/[teamId]`
 * leaf must keep its own header — matching the groups sub-page convention.
 */
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { api, ApiError, apiErrorCode } from "@/lib/api";
import type { EventDetail, EventSummary } from "@droptracker/api-types";
import { AccessDenied } from "@/components/access-denied";
import { EventWindow } from "@/components/local-time";
import { TabNav } from "@/components/tab-nav";

type Viewer = { players: unknown[] } | null;

/**
 * Load an event for a public tab page. Returns `{ event }` on success, or
 * `{ denied }` (a ready-to-return AccessDenied node) for a restricted event the
 * viewer can't see. Throws `notFound()` for a signed-in 404, rethrows the rest.
 * `returnTo` is the path an anonymous 404 sign-in link comes back to.
 */
export async function loadEventForView(
  eventId: number,
  user: Viewer,
  returnTo: string,
): Promise<{ event: EventDetail } | { denied: React.ReactNode }> {
  try {
    const event = await (user ? api.eventForAdmin(eventId) : api.event(eventId));
    return { event };
  } catch (err) {
    const code = apiErrorCode(err);
    if (code === "event_draft") {
      return {
        denied: (
          <AccessDenied
            title="This event isn't live yet"
            message="The organizers haven't published this event, so it's only visible to event admins and members of participating clans. If your clan is taking part, ask a clan admin to add you to the group on DropTracker — then this page will open right up."
            back={{ href: "/events", label: "Browse events" }}
          />
        ),
      };
    }
    if (code === "event_private") {
      return {
        denied: (
          <AccessDenied
            title="This event is private"
            message="The organizers have limited this event to members of participating clans. If your clan is taking part, ask a clan admin to add you to the group on DropTracker to get access."
            back={{ href: "/events", label: "Browse events" }}
          />
        ),
      };
    }
    if (err instanceof ApiError && err.status === 404) {
      if (!user) {
        return {
          denied: (
            <AccessDenied
              title="Event not available"
              message="This event doesn't exist — or it's restricted to participants. If someone shared this link with you, sign in with Discord and we'll bring you back here to check your access."
              signInReturnTo={returnTo}
              back={{ href: "/events", label: "Browse events" }}
            />
          ),
        };
      }
      notFound();
    }
    throw err;
  }
}

const STATUS_STYLES: Record<string, string> = {
  draft: "text-osrs-parchment-dark/60",
  active: "text-osrs-green",
  past: "text-osrs-parchment-dark/60",
};

/** Event header (name, status, window, description, draft note) + the
 * Overview / Players / Teams tab bar. Shared by all three tab pages. */
export function EventPageHeader({ event }: { event: EventSummary }) {
  const tabs = [
    { href: `/events/${event.id}`, label: "Overview" },
    { href: `/events/${event.id}/players`, label: "Players" },
    // matchPrefix keeps Teams active on the /teams/[teamId] drill-down.
    { href: `/events/${event.id}/teams`, label: "Teams", matchPrefix: true },
  ];
  return (
    <header>
      {event.group_id && (
        <Link
          href={`/groups/${event.group_id}` as Route}
          className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
        >
          ← Group
        </Link>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-osrs-gold text-3xl font-bold">{event.name}</h1>
        <span className={`text-sm capitalize ${STATUS_STYLES[event.status] ?? ""}`}>
          ● {event.status === "draft" ? "upcoming" : event.status}
        </span>
      </div>
      <p className="text-osrs-parchment-dark/60 mt-1 text-sm">
        <EventWindow startsAt={event.starts_at} endsAt={event.ends_at} status={event.status} />
      </p>
      {event.description && (
        <p className="text-osrs-parchment-dark/80 mt-3 max-w-2xl">{event.description}</p>
      )}
      {event.status === "draft" && (
        <p className="border-osrs-gold/30 bg-osrs-gold/10 text-osrs-parchment-dark/90 mt-3 max-w-2xl rounded border px-3 py-2 text-sm">
          This event hasn&apos;t started yet — you can preview it because you&apos;re part of a
          participating clan. Sign up now and you&apos;ll be ready when it goes live.
        </p>
      )}
      <TabNav tabs={tabs} className="mt-4" />
    </header>
  );
}
