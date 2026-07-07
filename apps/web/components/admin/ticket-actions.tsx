"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { TicketDetail } from "@droptracker/api-types";
import { ticketAction } from "@/app/(admin)/admin/tickets/actions";

/** Claim / unclaim / close controls on the admin transcript view. */
export function TicketAdminActions({
  ticket,
  currentUserId,
}: {
  ticket: TicketDetail;
  currentUserId: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const run = (action: "claim" | "unclaim" | "close") =>
    startTransition(async () => {
      setError(null);
      const result = await ticketAction(ticket.ticket_id, action);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirmClose(false);
      router.refresh();
    });

  if (ticket.status === "closed") return null;

  const mineToUnclaim = ticket.claimed_by === currentUserId;
  const buttonBase =
    "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {mineToUnclaim ? (
        <button
          onClick={() => run("unclaim")}
          disabled={pending}
          className={`${buttonBase} border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-bronze`}
        >
          Unclaim
        </button>
      ) : (
        <button
          onClick={() => run("claim")}
          disabled={pending}
          className={`${buttonBase} border-osrs-gold/40 bg-osrs-gold/15 text-osrs-gold hover:bg-osrs-gold/25`}
        >
          {ticket.claimed_by ? "Claim from " + (ticket.claimed_by_name ?? "current handler") : "Claim"}
        </button>
      )}

      {ticket.status === "open" &&
        (confirmClose ? (
          <span className="flex items-center gap-2">
            <span className="text-osrs-parchment-dark/80 text-sm">
              Archive the transcript and delete the Discord channel?
            </span>
            <button
              onClick={() => run("close")}
              disabled={pending}
              className={`${buttonBase} border-osrs-red/40 bg-osrs-red/15 text-osrs-red hover:bg-osrs-red/25`}
            >
              {pending ? "Closing…" : "Yes, close it"}
            </button>
            <button
              onClick={() => setConfirmClose(false)}
              disabled={pending}
              className={`${buttonBase} border-osrs-bronze/40 text-osrs-parchment-dark/80`}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmClose(true)}
            disabled={pending}
            className={`${buttonBase} border-osrs-red/40 text-osrs-red hover:bg-osrs-red/10`}
          >
            Close ticket
          </button>
        ))}

      {ticket.status === "closing" && (
        <span className="text-osrs-parchment-dark/70 text-sm">
          Close requested — the bot is archiving the channel (takes ~15s). Refresh to see it
          complete.
        </span>
      )}

      {error && <span className="text-osrs-red text-sm">{error}</span>}
    </div>
  );
}
