import Link from "next/link";
import { entityPath } from "@/lib/slug";
import type { Supporters } from "@droptracker/api-types";
import { Badge, Card, EntityChip } from "@/components/ui";

/**
 * Homepage "wall of supporters": clans and individuals with a live PAID
 * subscription, shown to thank the people funding the project (suggestion #39).
 * Server component — data is fetched in the page and passed in. Renders nothing
 * when there are no supporters, so it never leaves an empty card on the page.
 */
export function SupportersSection({ supporters }: { supporters: Supporters }) {
  const { groups, players } = supporters;
  if (groups.length === 0 && players.length === 0) return null;

  return (
    <section aria-labelledby="supporters-heading">
      <Card padding="p-6 sm:p-8" className="border-osrs-gold/25">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="supporters-heading" className="text-osrs-gold text-xl font-semibold">
            Supporting DropTracker
          </h2>
          <Link
            href="/premium"
            className="text-osrs-gold-bright text-sm font-medium hover:underline"
          >
            Become a supporter →
          </Link>
        </div>
        <p className="text-osrs-parchment-dark/75 mt-1 text-sm">
          A huge thank you to the clans and players whose subscriptions keep DropTracker running.
        </p>

        {groups.length > 0 && (
          <div className="mt-6">
            <h3 className="text-osrs-parchment-dark/70 text-xs font-semibold tracking-wide uppercase">
              Supporter clans
            </h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => (
                <div
                  key={g.id}
                  className="border-osrs-bronze/20 bg-osrs-surface-2/40 min-w-0 rounded-lg border px-3 py-2"
                >
                  <EntityChip
                    href={entityPath("groups", g.id, g.name)}
                    name={g.name}
                    size="sm"
                    flair={g.flair?.style}
                    flairTitle={g.flair?.tier_name}
                    subtitle={`${g.member_count.toLocaleString()} ${
                      g.member_count === 1 ? "member" : "members"
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {players.length > 0 && (
          <div className="mt-6">
            <h3 className="text-osrs-parchment-dark/70 text-xs font-semibold tracking-wide uppercase">
              Supporters
            </h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((p) => (
                <div
                  key={p.user_id}
                  className="border-osrs-bronze/20 bg-osrs-surface-2/40 min-w-0 rounded-lg border px-3 py-2"
                >
                  <EntityChip
                    href={entityPath("players", p.player_id, p.name)}
                    name={p.name}
                    size="sm"
                    badges={
                      <Badge tone="gold" title="This player supports DropTracker">
                        ★
                      </Badge>
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
