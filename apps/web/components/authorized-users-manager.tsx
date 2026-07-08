"use client";

/**
 * Authorized users manager (group admin → "Authorized users" tab).
 *
 * Re-implements the XenForo-era group panel that let owners hand admin
 * rights to other users post-creation. One entry per person, backed by two
 * synced stores on the backend: the website role grant and the Discord
 * bot's authed-users list (`sources` shows where each entry lives).
 */
import { useState, useTransition } from "react";
import type { AuthorizedUser, AuthorizedUsersResponse } from "@droptracker/api-types";
import { addAuthorizedUser, removeAuthorizedUser } from "@/app/(admin)/groups/[id]/authorized/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Badge, NameTile } from "@/components/ui";

function displayName(u: AuthorizedUser): string {
  return u.username || (u.discord_id ? `Discord user ${u.discord_id}` : `User #${u.user_id}`);
}

function sourceHint(u: AuthorizedUser): string | null {
  const web = u.sources.includes("web");
  const discord = u.sources.includes("discord");
  if (web && discord) return null; // fully synced — nothing to flag
  if (discord) return "Bot commands only — website access activates when they sign in here.";
  return "Website only — no Discord account linked for bot commands.";
}

export function AuthorizedUsersManager({
  groupId,
  initial,
  viewerUserId,
}: {
  groupId: number;
  initial: AuthorizedUsersResponse;
  viewerUserId: number;
}) {
  const [users, setUsers] = useState<AuthorizedUser[]>(initial.users);
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
        const result = await addAuthorizedUser(groupId, value);
        setUsers(result.users);
        setIdentifier("");
        setNotice("Authorized.");
        setTimeout(() => setNotice(null), 2500);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't add that user. Check the name or Discord ID."));
      }
    });
  };

  const onRemove = (u: AuthorizedUser) => {
    if (!window.confirm(`Remove ${displayName(u)} from this group's authorized users?`)) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await removeAuthorizedUser(groupId, {
          user_id: u.user_id,
          discord_id: u.discord_id,
        });
        setUsers(result.users);
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
          {pending ? "Working…" : "Authorize"}
        </button>
        {notice && <span className="text-osrs-green text-sm">{notice}</span>}
      </form>
      <p className="text-osrs-parchment-dark/60 -mt-4 text-xs">
        Tip: a Discord ID is the long number from right-clicking someone in Discord with
        Developer Mode on — it works even if they haven&apos;t signed in to the website yet.
      </p>

      {error && <Alert variant="error">{error}</Alert>}

      <ul className="divide-osrs-bronze/20 border-osrs-bronze/20 divide-y rounded border">
        {users.map((u) => {
          const hint = sourceHint(u);
          const isSelf = u.user_id != null && u.user_id === viewerUserId;
          return (
            <li
              key={u.discord_id ?? `user-${u.user_id}`}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <NameTile name={displayName(u)} size="sm" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{displayName(u)}</span>
                    <Badge tone={u.role === "owner" ? "gold" : "sky"}>{u.role}</Badge>
                    {isSelf && <Badge tone="neutral">you</Badge>}
                  </div>
                  {u.discord_id && u.username && (
                    <div className="text-osrs-parchment-dark/50 text-xs">{u.discord_id}</div>
                  )}
                  {hint && <div className="text-osrs-parchment-dark/60 text-xs">{hint}</div>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(u)}
                disabled={pending}
                className="text-osrs-red hover:bg-osrs-red/10 rounded px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          );
        })}
        {users.length === 0 && (
          <li className="text-osrs-parchment-dark/60 px-3 py-4 text-sm">
            Nobody is explicitly authorized yet — only the group owner can manage this group.
          </li>
        )}
      </ul>
    </div>
  );
}
