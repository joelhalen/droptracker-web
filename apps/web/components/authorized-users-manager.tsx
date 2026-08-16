"use client";

/**
 * Roles & access manager (group admin → "Roles & access" tab).
 *
 * One OWNER plus N ADMINS (web86a). Admins configure everything about the
 * group; only the owner changes who is on this list or hands the group on.
 * Before that split every authorized user could appoint and evict every other
 * one — including the person who created the group.
 *
 * Admins still SEE the full roster (knowing who your co-admins are is useful
 * and leaks nothing); they just get no controls. The backend enforces all of
 * this independently — everything here is about what to render.
 */
import { useState, useTransition } from "react";
import type { AuthorizedUser, AuthorizedUsersResponse } from "@droptracker/api-types";
import {
  addAuthorizedUser,
  removeAuthorizedUser,
  transferOwnership,
  claimOwnership,
  setAdminPolicy,
} from "@/app/(site)/(admin)/groups/[id]/authorized/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Badge, Button, NameTile, RoleBadge } from "@/components/ui";

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
  groupName,
  initial,
  viewerUserId,
}: {
  groupId: number;
  groupName: string;
  initial: AuthorizedUsersResponse;
  viewerUserId: number;
}) {
  const [state, setState] = useState<AuthorizedUsersResponse>(initial);
  const [identifier, setIdentifier] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [transferTo, setTransferTo] = useState<AuthorizedUser | null>(null);
  const [confirmName, setConfirmName] = useState("");

  const users = state.users;
  const canManage = state.can_manage_admins;
  const ownerless = state.owner_user_id === null;
  const owner = users.find((u) => u.role === "owner") ?? null;
  const admins = users.filter((u) => u.role !== "owner");

  /** Run a roster mutation, funnelling every outcome into one place. */
  const run = (
    fn: () => Promise<AuthorizedUsersResponse>,
    fallback: string,
    success?: string,
  ) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        setState(await fn());
        if (success) {
          setNotice(success);
          setTimeout(() => setNotice(null), 3000);
        }
      } catch (err) {
        setError(getErrorMessage(err, fallback));
      }
    });
  };

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const value = identifier.trim();
    if (!value) return;
    run(
      async () => {
        const result = await addAuthorizedUser(groupId, value);
        setIdentifier("");
        return result;
      },
      "Couldn't add that user. Check the name or Discord ID.",
      "Admin added.",
    );
  };

  const onRemove = (u: AuthorizedUser) => {
    if (!window.confirm(`Remove ${displayName(u)} as an admin of this group?`)) return;
    run(
      () => removeAuthorizedUser(groupId, { user_id: u.user_id, discord_id: u.discord_id }),
      "Couldn't remove that user. Please try again.",
    );
  };

  const onTransfer = () => {
    const target = transferTo;
    if (!target?.user_id) return;
    run(
      async () => {
        const result = await transferOwnership(groupId, target.user_id!);
        setTransferTo(null);
        setConfirmName("");
        return result;
      },
      "Couldn't transfer ownership. Please try again.",
      `${displayName(target)} now owns this group.`,
    );
  };

  const onClaim = () => {
    if (!window.confirm("Claim ownership of this group? Everyone here will be notified.")) return;
    run(
      () => claimOwnership(groupId),
      "Couldn't claim this group. Please try again.",
      "You now own this group.",
    );
  };

  const onTogglePolicy = () => {
    const next = !state.discord_perms_grant_admin;
    if (
      !next &&
      !window.confirm(
        "Turn off Discord-based admin access?\n\n" +
          "Anyone who reaches this panel only through Discord's \"Manage Server\" " +
          "permission will lose access immediately. We can't list who that is — " +
          "Discord doesn't tell us — so add them below first if you're unsure.",
      )
    ) {
      return;
    }
    run(
      () => setAdminPolicy(groupId, next),
      "Couldn't change that setting. Please try again.",
      next ? "Discord managers can administer this group again." : "Discord-based access is off.",
    );
  };

  const renderPerson = (u: AuthorizedUser, actions?: React.ReactNode) => {
    const hint = sourceHint(u);
    const isSelf = u.user_id != null && u.user_id === viewerUserId;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <NameTile name={displayName(u)} size="sm" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-medium">{displayName(u)}</span>
              <RoleBadge role={u.role} />
              {isSelf && <Badge variant="neutral">you</Badge>}
            </div>
            {u.discord_id && u.username && (
              <div className="text-osrs-parchment-dark/50 text-xs">{u.discord_id}</div>
            )}
            {hint && <div className="text-osrs-parchment-dark/60 text-xs">{hint}</div>}
          </div>
        </div>
        {actions}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {/* ---- Owner ---------------------------------------------------- */}
      <section className="space-y-2">
        <h2 className="text-osrs-gold text-sm font-semibold tracking-wide uppercase">Owner</h2>
        <div className="border-osrs-gold/30 bg-osrs-gold/5 rounded border px-3 py-2.5">
          {ownerless ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">This group has no owner</div>
                <p className="text-osrs-parchment-dark/70 mt-0.5 text-xs">
                  We couldn&apos;t work out who originally created it. Any admin can claim the
                  owner seat — the group is notified in Discord when someone does.
                </p>
              </div>
              <Button variant="primary" onClick={onClaim} disabled={pending}>
                {pending ? "Working…" : "Claim ownership"}
              </Button>
            </div>
          ) : owner ? (
            renderPerson(
              owner,
              canManage && admins.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setTransferTo(admins[0] ?? null);
                    setConfirmName("");
                  }}
                  disabled={pending}
                  className="border-osrs-bronze/40 hover:border-osrs-gold rounded border px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Transfer ownership
                </button>
              ) : undefined,
            )
          ) : (
            <p className="text-osrs-parchment-dark/70 text-sm">
              Owned by a user who hasn&apos;t signed in to the website yet.
            </p>
          )}
        </div>
        {!ownerless && canManage && admins.length === 0 && (
          <p className="text-osrs-parchment-dark/60 text-xs">
            Add an admin below before you can transfer ownership.
          </p>
        )}
      </section>

      {/* ---- Transfer confirmation ------------------------------------ */}
      {transferTo && (
        <section className="border-osrs-bronze/40 bg-osrs-surface-1 space-y-3 rounded border p-4">
          <h3 className="text-sm font-semibold">Transfer ownership</h3>
          <p className="text-osrs-parchment-dark/80 text-sm">
            The new owner takes over this list — who is an admin, and who owns the group next.
            You stay on as an admin and keep every other permission.
          </p>
          <label className="block text-xs">
            <span className="text-osrs-parchment-dark/70">New owner</span>
            <select
              value={transferTo.user_id ?? ""}
              onChange={(e) =>
                setTransferTo(
                  admins.find((a) => String(a.user_id) === e.target.value) ?? transferTo,
                )
              }
              className="border-osrs-bronze/40 bg-osrs-surface-2 mt-1 block w-full max-w-sm rounded border px-3 py-2 text-sm"
            >
              {admins.map((a) => (
                <option key={a.user_id ?? a.discord_id} value={a.user_id ?? ""}>
                  {displayName(a)}
                </option>
              ))}
            </select>
          </label>
          {transferTo.user_id == null && (
            <Alert variant="error">
              {displayName(transferTo)} hasn&apos;t signed in to the website yet, so they
              can&apos;t own the group. Ask them to sign in once with Discord first.
            </Alert>
          )}
          <label className="block text-xs">
            <span className="text-osrs-parchment-dark/70">
              Type <strong className="text-osrs-parchment">{groupName}</strong> to confirm
            </span>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="border-osrs-bronze/40 bg-osrs-surface-2 mt-1 block w-full max-w-sm rounded border px-3 py-2 text-sm"
              aria-label="Group name confirmation"
            />
          </label>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={onTransfer}
              disabled={pending || confirmName.trim() !== groupName || transferTo.user_id == null}
            >
              {pending ? "Working…" : "Transfer ownership"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setTransferTo(null);
                setConfirmName("");
              }}
              disabled={pending}
              className="border-osrs-bronze/40 rounded border px-4 py-2 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* ---- Admins ---------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-osrs-parchment-dark/80 text-sm font-semibold tracking-wide uppercase">
          Admins
        </h2>

        {canManage ? (
          <>
            <form onSubmit={onAdd} className="flex flex-wrap items-center gap-2">
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Discord ID or DropTracker username"
                className="border-osrs-bronze/40 bg-osrs-surface-1 focus:border-osrs-gold w-72 max-w-full rounded border px-3 py-2 text-sm outline-none"
                aria-label="Discord ID or DropTracker username"
              />
              <Button type="submit" variant="secondary" disabled={pending || !identifier.trim()}>
                {pending ? "Working…" : "Add admin"}
              </Button>
            </form>
            <p className="text-osrs-parchment-dark/60 -mt-1 text-xs">
              Tip: a Discord ID is the long number from right-clicking someone in Discord with
              Developer Mode on — it works even if they haven&apos;t signed in to the website yet.
            </p>
          </>
        ) : (
          <p className="text-osrs-parchment-dark/70 text-sm">
            Only this group&apos;s owner can add or remove admins. Ask them if someone needs
            access.
          </p>
        )}

        <ul className="divide-osrs-bronze/20 border-osrs-bronze/20 divide-y rounded border">
          {admins.map((u) => (
            <li key={u.discord_id ?? `user-${u.user_id}`} className="px-3 py-2.5">
              {renderPerson(
                u,
                canManage ? (
                  <button
                    type="button"
                    onClick={() => onRemove(u)}
                    disabled={pending}
                    className="text-osrs-red hover:bg-osrs-red/10 rounded px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    Remove
                  </button>
                ) : undefined,
              )}
            </li>
          ))}
          {admins.length === 0 && (
            <li className="text-osrs-parchment-dark/60 px-3 py-4 text-sm">
              No extra admins — only the owner
              {state.discord_perms_grant_admin ? " and your Discord server's managers" : ""} can
              administer this group.
            </li>
          )}
        </ul>
      </section>

      {/* ---- Discord policy -------------------------------------------- */}
      <section className="space-y-2">
        <h2 className="text-osrs-parchment-dark/80 text-sm font-semibold tracking-wide uppercase">
          Discord permissions
        </h2>
        <div className="border-osrs-bronze/20 flex flex-wrap items-center justify-between gap-3 rounded border px-3 py-2.5">
          <div className="min-w-0 max-w-2xl">
            <div className="text-sm font-medium">
              Discord &ldquo;Manage Server&rdquo; grants admin access
              <Badge variant={state.discord_perms_grant_admin ? "green" : "neutral"} className="ml-2">
                {state.discord_perms_grant_admin ? "On" : "Off"}
              </Badge>
            </div>
            <p className="text-osrs-parchment-dark/70 mt-0.5 text-xs">
              While this is on, anyone with Manage Server in your linked Discord can administer
              the group here without being listed above. Turn it off to make this list the only
              way in — note that we can&apos;t show you who currently relies on it, because
              Discord doesn&apos;t tell us.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={onTogglePolicy}
              disabled={pending}
              className="border-osrs-bronze/40 hover:border-osrs-gold rounded border px-3 py-1.5 text-xs whitespace-nowrap disabled:opacity-50"
            >
              {state.discord_perms_grant_admin ? "Turn off" : "Turn on"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
