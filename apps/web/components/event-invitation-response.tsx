"use client";

/**
 * Accept / decline a clan-vs-clan challenge (web96a).
 *
 * The same two calls the inbox makes, given room to breathe on the invitation
 * page: the Discord-mirror opt-in gets an explanation instead of a cramped
 * checkbox, and an already-answered invitation says so rather than silently
 * rendering dead buttons.
 */
import { useState, useTransition } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  acceptEventInvitation,
  declineEventInvitation,
  withdrawEventParticipant,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Button, Card } from "@/components/ui";

export function InvitationResponsePanel({
  groupId,
  eventId,
  status,
  hostName,
  staffHosted = false,
  eventStatus = "draft",
}: {
  groupId: number;
  eventId: number;
  /** This clan's row on the event: invited | accepted | declined (plus
   * withdrawn | dropped on a staff-hosted event). */
  status: string;
  hostName: string | null;
  /** web119a: a global event run by DropTracker staff. */
  staffHosted?: boolean;
  /** The event's own status; a clan can only withdraw from a draft. */
  eventStatus?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Off by default — accepting must not create anything in the accepting
  // clan's own Discord server unasked.
  const [mirror, setMirror] = useState(false);

  const withdraw = () => {
    if (!window.confirm("Withdraw your clan? Your team, roster and sign-ups will be removed.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await withdrawEventParticipant(eventId, groupId);
        router.refresh();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't withdraw."));
      }
    });
  };

  const respond = (accept: boolean) => {
    setError(null);
    startTransition(async () => {
      try {
        if (accept) {
          await acceptEventInvitation(groupId, eventId, groupId, {
            createDiscordEvent: mirror,
          });
        } else {
          await declineEventInvitation(groupId, eventId, groupId);
        }
        router.refresh();
      } catch (err) {
        setError(getErrorMessage(err, accept ? "Couldn't accept." : "Couldn't decline."));
      }
    });
  };

  if (staffHosted && status === "accepted") {
    return (
      <Card>
        <h2 className="text-osrs-gold mb-2 text-sm font-semibold">Your answer</h2>
        {error && <Alert variant="error">{error}</Alert>}
        <p className="text-osrs-green mb-3 text-sm">
          Your clan is in. Pick your roster, leaders and Discord channels on your clan&apos;s
          event page.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/groups/${groupId}/events/${eventId}` as Route}
            className="border-osrs-gold/50 text-osrs-gold-bright hover:bg-osrs-gold/10 rounded border px-4 py-2 text-sm"
          >
            Manage your clan&apos;s side
          </Link>
          {eventStatus === "draft" && (
            <button
              type="button"
              onClick={withdraw}
              disabled={pending}
              className="border-osrs-bronze/30 text-osrs-parchment-dark/80 hover:text-osrs-red rounded border px-4 py-2 text-sm disabled:opacity-50"
            >
              Withdraw
            </button>
          )}
        </div>
      </Card>
    );
  }

  if (status === "withdrawn" || status === "dropped") {
    return (
      <Card>
        <h2 className="text-osrs-gold mb-2 text-sm font-semibold">Your answer</h2>
        <p className="text-osrs-parchment-dark/70 text-sm">
          {status === "withdrawn"
            ? "Your clan withdrew from this event."
            : "Your clan was left out because the roster was under the minimum when the event started."}
        </p>
      </Card>
    );
  }

  if (status === "accepted") {
    return (
      <Card>
      <h2 className="text-osrs-gold mb-2 text-sm font-semibold">Your answer</h2>
        <p className="text-osrs-green text-sm">
          You accepted this challenge. Keep using the conversation to sort out
          rosters and timing — it stays open for the whole event.
        </p>
      </Card>
    );
  }

  if (status === "declined") {
    return (
      <Card>
      <h2 className="text-osrs-gold mb-2 text-sm font-semibold">Your answer</h2>
        <p className="text-osrs-parchment-dark/70 text-sm">
          You declined this challenge. {hostName ?? "The other clan"} can invite you
          again if plans change.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-osrs-gold mb-2 text-sm font-semibold">Your answer</h2>
      {error && <Alert variant="error">{error}</Alert>}
      <p className="text-osrs-parchment-dark/70 mb-3 text-sm">
        {staffHosted
          ? "If you accept, your members sign up for the event and you pick who plays. Questions? Ask DropTracker staff in the conversation."
          : `Not sure yet? Ask ${hostName ?? "them"} in the conversation first — answering is not urgent, and nothing is decided until you do.`}
      </p>

      <label className="text-osrs-parchment-dark/70 mb-3 flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={mirror}
          onChange={() => setMirror((v) => !v)}
          disabled={pending}
          className="mt-0.5"
        />
        <span>
          Also add the Discord scheduled event to our own server when this goes live.
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => respond(true)} disabled={pending}>
          {pending ? "Working…" : staffHosted ? "Accept invite" : "Accept challenge"}
        </Button>
        <button
          type="button"
          onClick={() => respond(false)}
          disabled={pending}
          className="border-osrs-bronze/30 text-osrs-parchment-dark/80 hover:text-osrs-red rounded border px-4 py-2 text-sm disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </Card>
  );
}
