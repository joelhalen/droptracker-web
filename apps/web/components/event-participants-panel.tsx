"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { EventParticipant } from "@droptracker/api-types";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";
import {
  bulkInviteEventParticipants,
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

type Clan = { id: number; name: string };

/** Clan-vs-clan participant roster: invite opponents (one or many at once),
 * view statuses, remove. Built for large fields (8–12+ clans): stage several
 * clans from search, then invite them all in a single call. */
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
  const [results, setResults] = useState<Clan[] | null>(null);
  const [selected, setSelected] = useState<Clan[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
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

  // Accepted / pending counts for the count-aware heading.
  const counts = useMemo(() => {
    const p = participants ?? [];
    return {
      total: p.length,
      accepted: p.filter((x) => x.status === "accepted").length,
      pending: p.filter((x) => x.status === "invited").length,
    };
  }, [participants]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setError(null);
    startTransition(async () => {
      try {
        const found = await searchOpponentClans(groupId, q);
        const onRoster = new Set(participants?.map((p) => p.group_id) ?? []);
        const staged = new Set(selected.map((c) => c.id));
        setResults(found.filter((g) => !onRoster.has(g.id) && !staged.has(g.id)));
      } catch (err) {
        setError(getErrorMessage(err, "Search failed."));
      }
    });
  };

  const stageClan = (clan: Clan) => {
    setSelected((prev) => (prev.some((c) => c.id === clan.id) ? prev : [...prev, clan]));
    setResults((prev) => prev?.filter((g) => g.id !== clan.id) ?? null);
  };

  const unstageClan = (id: number) => setSelected((prev) => prev.filter((c) => c.id !== id));

  const submitInvites = () => {
    if (!selected.length) return;
    setError(null);
    setSummary(null);
    startTransition(async () => {
      try {
        const res = await bulkInviteEventParticipants(
          groupId,
          eventId,
          selected.map((c) => c.id),
        );
        const parts: string[] = [];
        if (res.invited.length) parts.push(`Invited ${res.invited.length} clan(s).`);
        if (res.skipped.length) {
          const skipped = res.skipped
            .map((s) => `${s.group_name ?? `Clan ${s.group_id}`} (${s.reason})`)
            .join(", ");
          parts.push(`Skipped: ${skipped}`);
        }
        setSummary(parts.join(" ") || "Nothing to invite.");
        setSelected([]);
        setResults(null);
        setQuery("");
        reload();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't send the invites."));
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
      <h3 className="heading-rule text-osrs-gold mb-1 pb-1 text-lg font-semibold">
        Participating clans
        {counts.total > 0 && (
          <span className="text-osrs-parchment-dark/50 ml-2 text-sm font-normal">
            {counts.total}
          </span>
        )}
      </h3>
      {counts.total > 0 && (
        <p className="text-osrs-parchment-dark/60 mb-4 text-xs">
          {counts.accepted} accepted
          {counts.pending > 0 && ` · ${counts.pending} awaiting a response`}
        </p>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      {summary && <Alert variant="success">{summary}</Alert>}

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
        <p className="text-osrs-parchment-dark/60 mb-4 text-sm">No clans yet.</p>
      )}

      {isHost && (
        <>
          {/* Staged clans waiting to be invited in one batch. */}
          {selected.length > 0 && (
            <div className="border-osrs-gold/30 bg-osrs-gold/5 mb-2 rounded border p-2">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {selected.map((c) => (
                  <span
                    key={c.id}
                    className="border-osrs-bronze/40 bg-osrs-brown-dark/40 inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs"
                  >
                    {c.name}
                    <button
                      onClick={() => unstageClan(c.id)}
                      disabled={pending}
                      className="text-osrs-parchment-dark/60 hover:text-osrs-red disabled:opacity-50"
                      aria-label={`Remove ${c.name} from the invite list`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <button
                onClick={submitInvites}
                disabled={pending}
                className="border-osrs-gold/50 text-osrs-gold-bright hover:bg-osrs-gold/10 rounded border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                Invite {selected.length} clan{selected.length === 1 ? "" : "s"}
              </button>
            </div>
          )}

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
          <p className="text-osrs-parchment-dark/40 mt-1 text-xs">
            Add several clans, then invite them all at once.
          </p>
        </>
      )}

      {results && (
        <ul className="border-osrs-bronze/20 mt-2 max-h-48 overflow-y-auto rounded border">
          {results.length ? (
            results.map((g) => (
              <li key={g.id}>
                <button
                  onClick={() => stageClan(g)}
                  disabled={pending}
                  className="hover:bg-osrs-bronze/10 flex w-full items-center justify-between px-3 py-1.5 text-left text-sm disabled:opacity-50"
                >
                  <span>
                    {g.name}
                    <span className="text-osrs-parchment-dark/50 ml-2 text-xs">#{g.id}</span>
                  </span>
                  <span className="text-osrs-gold-bright text-xs">Add</span>
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
