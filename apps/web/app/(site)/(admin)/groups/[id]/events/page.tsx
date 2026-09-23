import type { Metadata, Route } from "next";
import Link from "next/link";
import type { EventSummary } from "@droptracker/api-types";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { canAdminGroup, getUser } from "@/lib/auth";
import { EventInvitationsInbox } from "@/components/event-invitations-inbox";
import { EventTemplatesManager } from "@/components/event-templates-manager";
import { FeatureGate } from "@/components/feature-gate";
import { EmptyState } from "@/components/ui";
import { DraftStartNote, EventWindow } from "@/components/local-time";
import { sortEventsChronologically } from "@/lib/events";

export const metadata: Metadata = { title: "Events" };

type Params = Promise<{ id: string }>;

const STATUS_CHIP: Record<string, string> = {
  draft: "bg-osrs-bronze/20 text-osrs-parchment-dark/80",
  active: "bg-green-500/15 text-green-400",
  past: "bg-osrs-brown-dark/60 text-osrs-parchment-dark/50",
};

export default async function GroupEventsPage({ params }: { params: Params }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();

  // Authed list so the backend includes this admin's drafts (Task 21).
  const [events, subscription, tiers, user, invitations, templates] = await Promise.all([
    api.eventsForAdmin({ groupId }),
    api.groupSubscription(groupId).catch(() => null),
    api.subscriptionTiers().catch(() => []),
    getUser(),
    api.eventInvitations().catch(() => []),
    // The group's own saved templates (management card below the grid).
    api.eventTemplates({ groupId }).catch(() => []),
  ]);

  // Tier concurrency (PRD D9): shown as "active X / Y"; the limit binds at
  // activation (drafts are unlimited). Superadmins resolve to an effectively
  // unlimited entitlement — render that as ∞ rather than a huge number.
  const activeCount = events.filter((e) => e.status === "active").length;
  const rawLimit = Number(subscription?.entitlements?.["events_max_active"] ?? 1);
  const limitLabel = rawLimit >= 1_000_000 ? "∞" : String(rawLimit);

  // Clan-vs-clan events this group was CHALLENGED into (group_id is the host,
  // not us). These are co-managed without our own paid tier, so they live
  // OUTSIDE the events paywall — as do pending invitations.
  // Both lists read by date (live by end, upcoming by start, past by most
  // recent end) rather than the API's newest-created-first.
  const battles = sortEventsChronologically(
    events.filter((e) => e.mode === "clan_vs_clan" && e.group_id !== groupId),
  );
  const ownEvents = sortEventsChronologically(
    events.filter((e) => !(e.mode === "clan_vs_clan" && e.group_id !== groupId)),
  );

  // Always visible (even to a group without the events entitlement): respond to
  // invitations and manage the clan battles you've accepted.
  const openToEveryone = (
    <div className="space-y-8">
      <EventInvitationsInbox groupId={groupId} invitations={invitations} />
      {battles.length > 0 && (
        <section>
          <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
            Clan battles you&apos;re in
          </h2>
          <ul className="divide-osrs-bronze/20 divide-y">
            {battles.map((e) => (
              <li key={e.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/groups/${groupId}/events/${e.id}` as Route}
                    className="hover:text-osrs-gold-bright min-w-0 truncate font-medium"
                  >
                    {e.name}
                  </Link>
                  <span
                    className={`${STATUS_CHIP[e.status] ?? ""} shrink-0 rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide`}
                  >
                    {e.status}
                  </span>
                </div>
                <EventDates event={e} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );

  const gated = (
    <div className="space-y-8">
      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">New event</h2>
          <p className="text-osrs-parchment-dark/60 mb-3 text-sm">
            Guided setup walks through everything one step at a time — name and format, schedule,
            joining rules, tasks, teams, Discord — with nothing required up front. Stop anywhere
            and your draft is saved; nothing goes live until you launch it.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/groups/${groupId}/events/new` as Route}
              className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium"
            >
              Create event →
            </Link>
            <span className="text-osrs-parchment-dark/50 text-xs">
              Re-running a past event? Templates live there too.
            </span>
          </div>
        </section>

        <section>
          <div className="heading-rule mb-4 flex items-baseline justify-between pb-1">
            <h2 className="text-osrs-gold text-lg font-semibold">Events</h2>
            <span
              className="text-osrs-parchment-dark/60 text-xs"
              title="Simultaneously active events allowed by the group's subscription tier"
            >
              active {activeCount} / {limitLabel} (tier limit)
            </span>
          </div>
          {ownEvents.length ? (
            <ul className="divide-osrs-bronze/20 divide-y">
              {ownEvents.map((e) => (
                <li key={e.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/groups/${groupId}/events/${e.id}` as Route}
                      className="hover:text-osrs-gold-bright min-w-0 truncate font-medium"
                    >
                      {e.name}
                    </Link>
                    <span className="flex shrink-0 items-center gap-2">
                      {e.status === "draft" && (
                        <Link
                          href={`/groups/${groupId}/events/new?event=${e.id}` as Route}
                          className="text-osrs-gold-bright text-xs hover:underline"
                        >
                          Continue setup →
                        </Link>
                      )}
                      <span
                        className={`${STATUS_CHIP[e.status] ?? ""} rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide`}
                      >
                        {e.status}
                      </span>
                    </span>
                  </div>
                  <EventDates
                    event={e}
                    scheduleHref={`/groups/${groupId}/events/new?event=${e.id}&step=1`}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No events yet"
              hint="Create one to add tasks, teams, and bingo boards."
            />
          )}
        </section>
      </div>
      <EventTemplatesManager groupId={groupId} initial={templates} />
    </div>
  );

  return (
    <div className="space-y-8">
      {openToEveryone}
      <FeatureGate
        entitlement="events"
        subscription={subscription}
        tiers={tiers}
        groupId={groupId}
        isSuperadmin={user?.is_superadmin}
        canUpgrade={user != null && canAdminGroup(user, groupId)}
      >
        {gated}
      </FeatureGate>
    </div>
  );
}

/** A row's dates under its name: the start–end window with a relative hint,
 * and for drafts how they go live. A draft with a start date starts on its own
 * at that time (the events worker needs no launch), so it is called out with a
 * link straight to the wizard's Schedule step (step 1 for every event kind). */
function EventDates({ event: e, scheduleHref }: { event: EventSummary; scheduleHref?: string }) {
  return (
    <div className="text-osrs-parchment-dark/55 mt-1 space-y-0.5 text-xs">
      <p>
        <EventWindow startsAt={e.starts_at} endsAt={e.ends_at} status={e.status} />
      </p>
      {e.status === "draft" && (
        <p className="text-osrs-gold-bright/80">
          <DraftStartNote startsAt={e.starts_at} />
          {scheduleHref && (
            <>
              {" · "}
              <Link href={scheduleHref as Route} className="underline-offset-2 hover:underline">
                {e.starts_at == null ? "Set a start date" : "Change start date"}
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
