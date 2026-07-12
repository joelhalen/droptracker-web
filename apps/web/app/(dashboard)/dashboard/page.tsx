import type { Metadata, Route } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { entityPath } from "@/lib/slug";
import { EntityHoverCard } from "@/components/entity-hover-card";
import { EventRecruitingBanner } from "@/components/event-recruiting-banner";
import { EmptyState, EntityChip, RoleBadge } from "@/components/ui";

export const metadata: Metadata = { title: "My accounts" };

export default async function DashboardPage() {
  // Resolve the session here (not just in the layout): App Router renders
  // layouts and pages concurrently, so the page must guard against a null `me`
  // itself rather than trusting the layout's redirect to run first.
  const user = await requireUser("/dashboard");
  const recruiting = await api.eventRecruiting().catch(() => []);

  return (
    <div className="space-y-10">
      {recruiting.length > 0 && <EventRecruitingBanner items={recruiting} />}
      <section>
        <h1 className="text-osrs-gold mb-4 text-2xl font-bold">My OSRS accounts</h1>
        {user.players.length ? (
          <ul className="divide-osrs-bronze/20 divide-y">
            {user.players.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <EntityHoverCard kind="player" id={p.id} name={p.name} className="min-w-0">
                  <EntityChip
                    href={entityPath("players", p.id, p.name)}
                    name={p.name}
                    subtitle={`Global rank #${p.global_rank ?? "—"}`}
                  />
                </EntityHoverCard>
                <span className="text-osrs-gold-bright text-sm tabular-nums">
                  {p.total_loot?.value_formatted ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No linked accounts yet"
            hint="Link an OSRS account through the RuneLite plugin to see it here."
          />
        )}
        <p className="text-osrs-parchment-dark/60 mt-4 text-sm">
          Linking is plugin-assisted: generate a code here and enter it in the RuneLite plugin to
          claim an account (FRONTEND_PLAN.md §7.3). Coming in a later iteration.
        </p>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-osrs-gold text-2xl font-bold">My groups</h2>
          <Link
            href="/groups/new"
            className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium"
          >
            + Create group
          </Link>
        </div>
        {user.groups.length ? (
          <ul className="divide-osrs-bronze/20 divide-y">
            {user.groups.map((g) => {
              const canAdmin = g.role === "owner" || g.role === "admin";
              return (
                <li key={g.id} className="flex items-center justify-between gap-3 py-3">
                  <EntityHoverCard kind="group" id={g.id} name={g.name} className="min-w-0">
                    <EntityChip
                      href={entityPath("groups", g.id, g.name)}
                      name={g.name}
                      flair={g.flair?.style}
                      flairTitle={g.flair?.tier_name}
                      badges={<RoleBadge role={g.role} />}
                    />
                  </EntityHoverCard>
                  {canAdmin && (
                    <Link
                      href={`/groups/${g.id}/admin` as Route}
                      className="bg-osrs-bronze/60 hover:bg-osrs-bronze shrink-0 rounded px-2 py-1 text-xs"
                    >
                      Manage
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="You're not in any groups yet"
            hint="Create a group to link your Wise Old Man clan and Discord server."
            action={
              <Link
                href="/groups/new"
                className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium"
              >
                + Create group
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
