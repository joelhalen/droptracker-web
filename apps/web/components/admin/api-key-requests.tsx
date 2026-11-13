"use client";

/**
 * Staff queue of Data API key requests (web163a).
 *
 * The usual place to decide one is the request's support ticket, where the
 * card carries Approve / Deny buttons and the requester is in the room. This
 * list is the same decision from the admin page, for when Discord is not to
 * hand. Approving here mints the key and posts its one-time claim link in the
 * ticket; the link is never shown to staff.
 */
import { useState, useTransition } from "react";
import type { Route } from "next";
import Link from "next/link";
import type { ApiKeyRequest } from "@droptracker/api-types";
import { decideApiKeyRequest } from "@/app/(site)/(admin)/admin/api-keys/actions";
import { formatRelativeTime } from "@/lib/format";
import { Alert, Card } from "@/components/ui";

function Row({
  req,
  canDecide,
  onDecided,
}: {
  req: ApiKeyRequest;
  canDecide: boolean;
  onDecided: (r: ApiKeyRequest) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const decide = (action: "approve" | "deny") =>
    start(async () => {
      setError(null);
      const res = await decideApiKeyRequest(req.id, action);
      if (res.ok) onDecided(res.value);
      else setError(res.error);
    });
  const subject =
    req.scope === "group" ? (
      <Link href={`/groups/${req.group_id}` as Route} className="underline">
        {req.group_name ?? `group ${req.group_id}`}
      </Link>
    ) : (
      "personal key"
    );
  return (
    <li className="space-y-2 py-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-medium">{req.label || "(not named)"}</span>{" "}
          <span className="text-osrs-parchment-dark/60">
            · {subject} · asked by {req.requested_by_name ?? `user ${req.requested_by_user_id}`}{" "}
            {formatRelativeTime(req.created_at)}
          </span>
        </div>
        <span className="text-osrs-parchment-dark/60 text-xs uppercase tracking-wide">
          {req.status}
          {req.api_key_id != null ? ` · key ${req.api_key_id}` : ""}
        </span>
      </div>
      <p className="text-osrs-parchment-dark/80 whitespace-pre-wrap">{req.purpose}</p>
      <div className="flex flex-wrap items-center gap-3">
        {req.ticket_id != null && (
          <Link href={`/tickets/${req.ticket_id}` as Route} className="text-osrs-gold underline">
            Ticket #{req.ticket_id}
          </Link>
        )}
        {req.status === "pending" && canDecide && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => decide("approve")}
              className="rounded border border-emerald-500/50 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
            >
              Approve and create key
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => decide("deny")}
              className="rounded border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              Deny
            </button>
          </>
        )}
      </div>
      {error && <Alert variant="error">{error}</Alert>}
    </li>
  );
}

export function ApiKeyRequestsPanel({
  initial,
  canDecide,
}: {
  initial: ApiKeyRequest[];
  canDecide: boolean;
}) {
  const [requests, setRequests] = useState(initial);
  const [showAll, setShowAll] = useState(false);
  const pending = requests.filter((r) => r.status === "pending");
  const shown = showAll ? requests : pending;
  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-osrs-gold text-lg font-semibold">
          Key requests{pending.length > 0 ? ` (${pending.length} waiting)` : ""}
        </h2>
        {requests.length > pending.length && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-osrs-parchment-dark/70 text-xs underline"
          >
            {showAll ? "Show waiting only" : `Show all ${requests.length}`}
          </button>
        )}
      </div>
      <p className="text-osrs-parchment-dark/60 mb-2 text-xs">
        Each request has a support ticket with the same Approve / Deny buttons. Approving creates
        the key on the entry tier and posts a one-time claim link in the ticket; a new key then
        appears in the list below, where its tier can be raised.
      </p>
      {shown.length === 0 ? (
        <p className="text-osrs-parchment-dark/60 text-sm">Nothing is waiting.</p>
      ) : (
        <ul className="divide-osrs-bronze/20 divide-y">
          {shown.map((r) => (
            <Row
              key={r.id}
              req={r}
              canDecide={canDecide}
              onDecided={(next) =>
                setRequests((prev) => prev.map((p) => (p.id === next.id ? { ...p, ...next } : p)))
              }
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
