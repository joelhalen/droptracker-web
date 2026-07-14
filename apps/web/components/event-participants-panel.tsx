"use client";

import { useEffect, useState, useTransition } from "react";
import type { EventParticipant } from "@droptracker/api-types";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";
import {
  inviteEventParticipant,
  listEventParticipants,
  removeEventParticipant,
  searchOpponentClans,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-2 text-sm outline-none";

const STATUS_STYLES: Record<EventParticipant["status"], string> = {
  invited: "bg-osrs-bronze/20 text-osrs-parchment-dark/80",
  accepted: "bg-green-500/15 text-green-400",
  declined: "bg-osrs-red/15 text-osrs-red",
};

/** Clan-vs-clan participant roster: invite opponents, view statuses, remove. */
export function EventParticipantsPanel({
  groupId,
  eventId,
  isHost,
}: {
  groupId: number;
  eventId: number;
  /** True when this page's group is the event host (only host may invite/remove). */
  isHost: boolean;
}) {
  const [participants, setParticipants] = useState<EventParticipant[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: number; name: string }[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      try {
        setParticipants(await listEventParticipants(groupId, eventId));
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't load participants."));
      }
    });
  }, [groupId, eventId]);

  const reload = () => {
    startTransition(async () => {
      try {
        setParticipants(await listEventParticipants(groupId, eventId));
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't load participants."));
      }
    });
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setError(null);
    startTransition(async () => {
      try {
        const found = await searchOpponentClans(groupId, q);
        const onRoster = new Set(participants?.map((p) => p.group_id) ?? []);
        setResults(found.filter((g) => !onRoster.has(g.id)));
      } catch (err) {
        setError(getErrorMessage(err, "Search failed."));
      }
    });
  };

  const onInvite = (opponentId: number) => {
    setError(null);
    startTransition(async () => {
      try {
        await inviteEventParticipant(groupId, eventId, opponentId);
        setResults(null);
        setQuery("");
        reload();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't send the invite."));
      }
    });
  };

  const onRemove = (participantGroupId: number) => {
    setError(null);
    startTransition(async () => {
      try {
        await removeEventParticipant(groupId, eventId, participantGroupId);
        reload();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't remove that clan."));
      }
    });
  };

  return (
    <section>
      <h3 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
        Participating clans
      </h3>
      {error && <Alert variant="error">{error}</Alert>}

      {participants === null ? (
        <p className="text-osrs-parchment-dark/60 text-sm">Loading…</p>
      ) : participants.length ? (
        <ul className="divide-osrs-bronze/20 mb-4 divide-y rounded border">
          {participants.map((p) => (
            <li key={p.group_id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{p.group_name ?? `Clan ${p.group_id}`}</span>
                <span className="text-osrs-parchment-dark/50 ml-2 text-xs capitalize">
                  {p.role}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span
                  className={`${STATUS_STYLES[p.status]} rounded px-1.5 py-0.5 text-xs font-medium uppercase`}
                >
                  {p.status}
                </span>
                {isHost && p.role !== "host" && (
                  <button
                    onClick={() => onRemove(p.group_id)}
                    disabled={pending}
                    className="text-osrs-red hover:bg-osrs-red/10 rounded px-2 py-1 text-xs disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-osrs-parchment-dark/60 mb-4 text-sm">No participants yet.</p>
      )}

      {isHost && (
        <form onSubmit={onSearch} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clans to invite…"
            className={`${field} flex-1`}
          />
          <button
            type="submit"
            disabled={pending || !query.trim()}
            className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border px-3 py-2 text-sm disabled:opacity-50"
          >
            Search
          </button>
        </form>
      )}

      {results && (
        <ul className="border-osrs-bronze/20 mt-2 max-h-48 overflow-y-auto rounded border">
          {results.length ? (
            results.map((g) => (
              <li key={g.id}>
                <button
                  onClick={() => onInvite(g.id)}
                  disabled={pending}
                  className="hover:bg-osrs-bronze/10 flex w-full items-center justify-between px-3 py-1.5 text-left text-sm disabled:opacity-50"
                >
                  <span>
                    {g.name}
                    <span className="text-osrs-parchment-dark/50 ml-2 text-xs">#{g.id}</span>
                  </span>
                  <span className="text-osrs-gold-bright text-xs">Invite</span>
                </button>
              </li>
            ))
          ) : (
            <li className="text-osrs-parchment-dark/50 px-3 py-2 text-xs">No clans found.</li>
          )}
        </ul>
      )}
    </section>
  );
}
