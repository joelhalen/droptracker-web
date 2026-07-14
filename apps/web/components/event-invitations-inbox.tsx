"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { EventInvitation } from "@droptracker/api-types";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";
import {
  acceptEventInvitation,
  declineEventInvitation,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";

/** Pending clan-vs-clan invites for one group's events admin page. */
export function EventInvitationsInbox({
  groupId,
  invitations,
}: {
  groupId: number;
  invitations: EventInvitation[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [handled, setHandled] = useState<Set<number>>(new Set());
  // Per-invitation opt-in: also mirror the Discord scheduled event into this
  // clan's own linked server. Off by default — accepting must not create
  // anything in the accepting clan's Discord unasked.
  const [mirror, setMirror] = useState<Set<number>>(new Set());

  if (!invitations.length) return null;

  const visible = invitations.filter(
    (inv) => inv.group_id === groupId && !handled.has(inv.event.id),
  );

  if (!visible.length) return null;

  const toggleMirror = (eventId: number) =>
    setMirror((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });

  const respond = (inv: EventInvitation, accept: boolean) => {
    setError(null);
    startTransition(async () => {
      try {
        if (accept) {
          await acceptEventInvitation(groupId, inv.event.id, inv.group_id, {
            createDiscordEvent: mirror.has(inv.event.id),
          });
        } else {
          await declineEventInvitation(groupId, inv.event.id, inv.group_id);
        }
        setHandled((prev) => new Set(prev).add(inv.event.id));
      } catch (err) {
        setError(getErrorMessage(err, accept ? "Couldn't accept." : "Couldn't decline."));
      }
    });
  };

  return (
    <section className="border-osrs-gold/30 bg-osrs-gold/5 mb-8 rounded border p-4">
      <h2 className="text-osrs-gold mb-3 text-lg font-semibold">Event invitations</h2>
      {error && <Alert variant="error">{error}</Alert>}
      <ul className="space-y-3">
        {visible.map((inv) => (
          <li
            key={`${inv.event.id}-${inv.group_id}`}
            className="border-osrs-bronze/20 space-y-2 rounded border px-3 py-2 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-medium">{inv.event.name}</span>
                {inv.host_group_name && (
                  <span className="text-osrs-parchment-dark/60 ml-2 text-xs">
                    from {inv.host_group_name}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => respond(inv, true)}
                  disabled={pending}
                  className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1 text-xs font-medium disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  onClick={() => respond(inv, false)}
                  disabled={pending}
                  className="text-osrs-parchment-dark/70 hover:text-osrs-red rounded px-2 py-1 text-xs disabled:opacity-50"
                >
                  Decline
                </button>
                <Link
                  href={`/events/${inv.event.id}` as Route}
                  className="text-osrs-gold-bright hover:underline px-2 py-1 text-xs"
                >
                  Preview
                </Link>
              </div>
            </div>
            <label className="text-osrs-parchment-dark/70 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={mirror.has(inv.event.id)}
                onChange={() => toggleMirror(inv.event.id)}
                disabled={pending}
              />
              Also add the Discord scheduled event to our own server when the event goes live
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
