import type { Metadata, Route } from "next";
import Link from "next/link";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: "My accounts" };

export default async function DashboardPage() {
  const user = (await getUser())!; // layout guarantees a session

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-osrs-gold mb-4 text-2xl font-bold">My OSRS accounts</h1>
        <ul className="divide-osrs-bronze/20 divide-y">
          {user.players.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-3">
              <Link href={`/players/${p.id}`} className="hover:text-osrs-gold-bright font-medium">
                {p.name}
              </Link>
              <span className="text-osrs-parchment-dark/70 text-sm tabular-nums">
                Rank #{p.global_rank ?? "—"} · {p.total_loot?.value_formatted ?? "—"}
              </span>
            </li>
          ))}
        </ul>
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
        <ul className="divide-osrs-bronze/20 divide-y">
          {user.groups.map((g) => {
            const canAdmin = g.role === "owner" || g.role === "admin";
            return (
              <li key={g.id} className="flex items-center justify-between py-3">
                <Link href={`/groups/${g.id}`} className="hover:text-osrs-gold-bright font-medium">
                  {g.name}
                </Link>
                <span className="flex items-center gap-3 text-sm">
                  <span className="text-osrs-parchment-dark/60 capitalize">{g.role}</span>
                  {canAdmin && (
                    <Link
                      href={`/groups/${g.id}/admin` as Route}
                      className="bg-osrs-bronze/60 hover:bg-osrs-bronze rounded px-2 py-1 text-xs"
                    >
                      Manage
                    </Link>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
