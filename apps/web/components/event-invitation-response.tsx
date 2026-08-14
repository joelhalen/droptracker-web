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
import { useRouter } from "next/navigation";
import {
  acceptEventInvitation,
  declineEventInvitation,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Card } from "@/components/ui";

export function InvitationResponsePanel({
  groupId,
  eventId,
  status,
  hostName,
}: {
  groupId: number;
  eventId: number;
  /** This clan's row on the event: invited | accepted | declined. */
  status: string;
  hostName: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Off by default — accepting must not create anything in the accepting
  // clan's own Discord server unasked.
  const [mirror, setMirror] = useState(false);

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
        Not sure yet? Ask {hostName ?? "them"} in the conversation first — answering
        is not urgent, and nothing is decided until you do.
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
        <button
          type="button"
          onClick={() => respond(true)}
          disabled={pending}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Working…" : "Accept challenge"}
        </button>
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
