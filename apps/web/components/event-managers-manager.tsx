"use client";

/**
 * Event managers manager (group admin → "Event managers" tab, web64a).
 *
 * Grants the group-scoped event-manager role: full control of the group's
 * events without any group-admin access. Web-only (keyed on a DropTracker
 * user id — no Discord bot grant), so the target must have signed in once.
 * Modeled on the authorized-users manager.
 */
import { useState, useTransition } from "react";
import type { EventManager, EventManagersResponse } from "@droptracker/api-types";
import {
  addEventManager,
  removeEventManager,
} from "@/app/(site)/(admin)/groups/[id]/event-managers/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Badge, NameTile } from "@/components/ui";

function displayName(m: EventManager): string {
  return m.username || (m.discord_id ? `Discord user ${m.discord_id}` : `User #${m.user_id}`);
}

export function EventManagersManager({
  groupId,
  initial,
}: {
  groupId: number;
  initial: EventManagersResponse;
}) {
  const [managers, setManagers] = useState<EventManager[]>(initial.managers);
  const [identifier, setIdentifier] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const value = identifier.trim();
    if (!value) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await addEventManager(groupId, value);
        setManagers(result.managers);
        setIdentifier("");
        setNotice("Added.");
        setTimeout(() => setNotice(null), 2500);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't add that user. Check the name or Discord ID."));
      }
    });
  };

  const onRemove = (m: EventManager) => {
    if (!window.confirm(`Remove ${displayName(m)} as an event manager?`)) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await removeEventManager(groupId, m.user_id);
        setManagers(result.managers);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't remove that user. Please try again."));
      }
    });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={onAdd} className="flex flex-wrap items-center gap-2">
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Discord ID or DropTracker username"
          className="border-osrs-bronze/40 bg-osrs-surface-1 focus:border-osrs-gold w-72 max-w-full rounded border px-3 py-2 text-sm outline-none"
          aria-label="Discord ID or DropTracker username"
        />
        <button
          type="submit"
          disabled={pending || !identifier.trim()}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Working…" : "Add manager"}
        </button>
        {notice && <span className="text-osrs-green text-sm">{notice}</span>}
      </form>
      <p className="text-osrs-parchment-dark/60 -mt-4 text-xs">
        The person must have signed in to DropTracker at least once (the role is granted to
        their website account). A Discord ID is the long number from right-clicking someone
        with Developer Mode on.
      </p>

      {error && <Alert variant="error">{error}</Alert>}

      <ul className="divide-osrs-bronze/20 border-osrs-bronze/20 divide-y rounded border">
        {managers.map((m) => (
          <li
            key={`mgr-${m.user_id}`}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <NameTile name={displayName(m)} size="sm" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{displayName(m)}</span>
                  <Badge tone="sky">event manager</Badge>
                </div>
                {m.discord_id && m.username && (
                  <div className="text-osrs-parchment-dark/50 text-xs">{m.discord_id}</div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRemove(m)}
              disabled={pending}
              className="text-osrs-red hover:bg-osrs-red/10 rounded px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Remove
            </button>
          </li>
        ))}
        {managers.length === 0 && (
          <li className="text-osrs-parchment-dark/60 px-3 py-4 text-sm">
            No event managers yet. Add a member to let them run this group&apos;s events
            without full admin access.
          </li>
        )}
      </ul>
    </div>
  );
}
