"use client";

import type { Route } from "next";
import { useState, useTransition } from "react";
import type { AdminUserOverview } from "@/lib/api";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { setUserSuperadmin } from "@/app/(admin)/admin/users/actions";
import { Badge, EmptyState, EntityChip, RoleBadge, SuperadminBadge } from "@/components/ui";

function actorLabel(actor: AdminUserOverview["recent_audit"][number]["actor"]): string {
  if (!actor) return "system";
  return actor.username || actor.discord_id || `#${actor.user_id}`;
}

export function UserOverviewPanel({
  overview,
  viewerUserId,
}: {
  overview: AdminUserOverview;
  viewerUserId: number | null;
}) {
  const { user, players, groups, recent_audit } = overview;
  const [isSuperadmin, setIsSuperadmin] = useState(user.is_superadmin);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSelf = viewerUserId != null && viewerUserId === user.user_id;

  const onToggle = () =>
    startTransition(async () => {
      setError(null);
      setNotice(null);
      const grant = !isSuperadmin;
      const result = await setUserSuperadmin(user.user_id, grant);
      if (result.ok) {
        setIsSuperadmin(grant);
        setNotice(grant ? "Granted superadmin." : "Revoked superadmin.");
      } else {
        setError(result.error);
      }
      setConfirming(false);
    });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        {user.avatar_url && (
          <img src={user.avatar_url} alt="" className="size-12 rounded-full" />
        )}
        <div>
          <div className="text-osrs-gold flex flex-wrap items-center gap-2 text-2xl font-bold">
            {user.display_name ?? user.username ?? `User #${user.user_id}`}
            {isSuperadmin && <SuperadminBadge />}
          </div>
          <div className="text-osrs-parchment-dark/60 mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>ID #{user.user_id}</span>
            {user.discord_id && <span>Discord {user.discord_id}</span>}
            {user.date_added && <span>Joined {formatDate(user.date_added)}</span>}
          </div>
        </div>
      </div>

      {/* Superadmin control */}
      <section className="border-osrs-bronze/30 space-y-3 rounded border p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-osrs-parchment-dark/70 text-xs uppercase tracking-wide">
              Site access
            </div>
            <div className="mt-1 text-sm">
              {isSuperadmin
                ? "This user has full superadmin access to the site."
                : "This user does not have superadmin access."}
            </div>
          </div>

          {isSelf ? (
            <span className="text-osrs-parchment-dark/50 text-xs">
              You cannot revoke your own superadmin access.
            </span>
          ) : confirming ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onToggle}
                disabled={pending}
                className="bg-osrs-red/80 text-osrs-parchment hover:bg-osrs-red rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                {pending ? "Saving…" : isSuperadmin ? "Confirm revoke" : "Confirm grant"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className={
                isSuperadmin
                  ? "text-osrs-red hover:bg-osrs-red/10 rounded px-3 py-1.5 text-sm"
                  : "bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium"
              }
            >
              {isSuperadmin ? "Revoke superadmin" : "Grant superadmin"}
            </button>
          )}
        </div>

        {notice && <p className="text-osrs-green text-sm">{notice}</p>}
        {error && <p className="text-osrs-red text-sm">{error}</p>}
      </section>

      {/* Linked players */}
      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
          Linked OSRS accounts
        </h2>
        {players.length === 0 ? (
          <EmptyState title="No linked accounts" />
        ) : (
          <ul className="divide-osrs-bronze/20 divide-y">
            {players.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <EntityChip
                  href={`/players/${p.id}` as Route}
                  name={p.name}
                  size="sm"
                  subtitle={p.wom_id != null ? `WOM #${p.wom_id}` : undefined}
                />
                {p.hidden && <Badge tone="neutral">Hidden</Badge>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Groups */}
      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">Groups</h2>
        {groups.length === 0 ? (
          <EmptyState title="Not a member of any group" />
        ) : (
          <ul className="divide-osrs-bronze/20 divide-y">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <EntityChip href={`/groups/${g.id}` as Route} name={g.name} size="sm" />
                <RoleBadge role={g.role} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent audit activity */}
      {recent_audit.length > 0 && (
        <section>
          <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
            Recent audit activity
          </h2>
          <ul className="divide-osrs-bronze/20 divide-y">
            {recent_audit.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-mono text-xs">{e.action}</span>
                  {e.target && <span className="text-osrs-parchment-dark/60"> · {e.target}</span>}
                </span>
                <span className="text-osrs-parchment-dark/50 whitespace-nowrap text-xs">
                  {actorLabel(e.actor)} · {formatRelativeTime(e.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
