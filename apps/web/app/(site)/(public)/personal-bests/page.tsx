import type { Metadata } from "next";
import { api } from "@/lib/api";
import { PbBossGrid } from "@/components/pb-boss-grid";
import { EmptyState } from "@/components/ui";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Personal Best Leaderboards",
  description:
    "Global Old School RuneScape kill-time leaderboards — the fastest recorded personal bests for every raid and boss tracked by DropTracker.",
};

export default async function PersonalBestsPage() {
  const index = await api.pbBosses();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-osrs-gold text-2xl font-bold">Personal best leaderboards</h1>
        <p className="text-osrs-parchment-dark/75 mt-1 max-w-2xl text-sm">
          The fastest kill times recorded across every tracked boss and raid, ranked per team
          size. Times are submitted automatically by the RuneLite plugin — pick a boss to see its
          full boards.
        </p>
      </div>

      {index.bosses.length === 0 ? (
        <EmptyState
          title="No personal bests yet"
          hint="Kill times appear here once players submit them with the plugin."
        />
      ) : (
        <PbBossGrid bosses={index.bosses} />
      )}
    </div>
  );
}
