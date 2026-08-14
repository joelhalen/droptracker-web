import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { getUser, canManageEvents } from "@/lib/auth";
import { ChatThreadPanel } from "@/components/chat/chat-thread";
import { InvitationResponsePanel } from "@/components/event-invitation-response";
import { EventWindow } from "@/components/local-time";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Clan challenge" };

type Params = Promise<{ id: string; eventId: string }>;
type Search = Promise<{ clan?: string }>;

/**
 * One clan's view of a clan-vs-clan challenge (web96a).
 *
 * This is where the Discord DM's button lands. Everything a clan leader needs
 * to answer a challenge is here: what the event is, who sent it, accept/decline,
 * and a live thread to negotiate in first — which is the part that did not
 * exist before, and the reason an invitation used to be a dead end.
 *
 * Access is already gated by `groups/[id]/layout.tsx` (owner/admin/event
 * manager); the backend independently enforces the same on every call.
 */
export default async function ClanChallengePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id, eventId: rawEventId } = await params;
  const { clan } = await searchParams;
  const groupId = Number(id);
  const eventId = Number(rawEventId);
  if (!Number.isFinite(groupId) || !Number.isFinite(eventId)) notFound();

  const user = await getUser();
  if (!user || !canManageEvents(user, groupId)) notFound();

  const participants = await api.eventParticipants(eventId).catch(() => []);
  const host = participants.find((p) => p.role === "host");

  // Threads pair the host with ONE invited clan, so "which conversation?" has
  // two answers depending on who is looking. An invited clan sees its own; the
  // host picks an opponent with `?clan=` (its own row has no counterpart).
  const isHost = host?.group_id === groupId;
  const requested = Number(clan);
  const targetClanId =
    Number.isFinite(requested) && requested > 0
      ? requested
      : isHost
        ? (participants.find((p) => p.role !== "host")?.group_id ?? 0)
        : groupId;
  if (!targetClanId) notFound();

  // The thread resolver is get-or-create, so this works for invitations sent
  // before chat existed and for clans that already answered.
  const [event, thread] = await Promise.all([
    api.event(eventId).catch(() => null),
    api.eventParticipantThread(eventId, targetClanId).catch(() => null),
  ]);
  if (!event || !thread) notFound();

  const page = await api.chatMessages(thread.id).catch(() => ({
    messages: [],
    has_more: false,
  }));

  const target = participants.find((p) => p.group_id === targetClanId);
  const status = target?.status ?? thread.participant_status ?? "invited";
  // Only the invited side answers; the host is here to talk, not to accept on
  // somebody else's behalf.
  const canAnswer = targetClanId === groupId && !isHost;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-osrs-parchment-dark/60 text-xs uppercase tracking-wide">
          Clan challenge
        </p>
        <h1 className="text-osrs-gold text-2xl font-semibold">{event.name}</h1>
        <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
          {isHost ? (
            <>
              Your conversation with{" "}
              <span className="font-medium">
                {target?.group_name ?? `Clan ${targetClanId}`}
              </span>{" "}
              about this event.
            </>
          ) : host?.group_name ? (
            <>
              <span className="font-medium">{host.group_name}</span> challenged your clan.
            </>
          ) : (
            <>Your clan has been challenged to this event.</>
          )}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-6">
          <Card>
            <h2 className="text-osrs-gold mb-3 text-sm font-semibold">The event</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-osrs-parchment-dark/60">When</dt>
                <dd className="text-right">
                  <EventWindow
                    startsAt={event.starts_at}
                    endsAt={event.ends_at}
                    status={event.status}
                  />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-osrs-parchment-dark/60">Status</dt>
                <dd className="uppercase">{event.status}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-osrs-parchment-dark/60">Clans</dt>
                <dd>{participants.length || "—"}</dd>
              </div>
            </dl>
            {event.description && (
              <p className="text-osrs-parchment-dark/70 mt-3 text-sm whitespace-pre-wrap">
                {event.description}
              </p>
            )}
            <Link
              href={`/events/${eventId}` as Route}
              className="text-osrs-gold-bright mt-3 inline-block text-xs hover:underline"
            >
              View the full event page →
            </Link>
          </Card>

          {canAnswer && (
            <InvitationResponsePanel
              groupId={groupId}
              eventId={eventId}
              status={status}
              hostName={host?.group_name ?? null}
            />
          )}
        </div>

        <ChatThreadPanel
          thread={thread}
          initialMessages={page.messages}
          initialHasMore={page.has_more}
          heading={
            isHost
              ? `Talk to ${target?.group_name ?? "this clan"}`
              : host?.group_name
                ? `Talk to ${host.group_name}`
                : "Talk to the other clan"
          }
        />
      </div>
    </div>
  );
}
