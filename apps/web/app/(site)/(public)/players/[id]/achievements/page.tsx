/**
 * Combat achievements, quests and achievement diaries for one player.
 *
 * All three come from a single backend call: they render as one card each and a
 * profile sub-page should not need three round-trips to draw them.
 *
 * Combat achievements show a completed *count* rather than a task list. Mapping
 * a completion bit back to a named task needs a task registry we do not have
 * yet, and a wrong mapping would confidently name the wrong achievements — a
 * count is correct without it.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { DiaryArea } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { resolveRef } from "@/lib/entity-ref";
import { Card, EmptyState, StatTile } from "@/components/ui";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ref = await resolveRef("player", id);
  if (!("id" in ref) || ref.id == null) return { title: "Achievements" };
  try {
    const player = await api.player(ref.id);
    return {
      title: `${player.name} — Achievements`,
      description: `Combat achievements, quests and diaries for ${player.name}.`,
    };
  } catch {
    return { title: "Achievements" };
  }
}

export default async function AchievementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ref = await resolveRef("player", id);
  if (!("id" in ref) || ref.id == null) notFound();
  const playerId = ref.id;

  const player = await orNotFound(api.player(playerId));
  const data = await api.playerAchievements(playerId).catch(() => null);

  if (!data || !data.has_synced) {
    return (
      <div className="space-y-6">
        <Header name={player.name} playerId={playerId} />
        <EmptyState
          title="No progress synced yet"
          hint={`${player.name} has not enabled "Sync account progress" in the DropTracker plugin, so there is nothing to show here yet.`}
        />
      </div>
    );
  }

  const questTotal =
    data.quests.finished + data.quests.in_progress + data.quests.not_started;

  return (
    <div className="space-y-6">
      <Header name={player.name} playerId={playerId} />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Combat achievements"
          value={
            data.combat_achievements.tasks_completed != null
              ? data.combat_achievements.tasks_completed.toLocaleString()
              : "—"
          }
        />
        <StatTile
          label="Quests completed"
          value={questTotal > 0 ? `${data.quests.finished} / ${questTotal}` : "—"}
        />
        <StatTile
          label="Combat level"
          value={data.combat_level != null ? String(data.combat_level) : "—"}
        />
      </div>

      {questTotal > 0 && (
        <section>
          <h2 className="heading-rule mb-3 text-lg font-semibold">Quests</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="Finished" value={data.quests.finished.toLocaleString()} />
            <StatTile label="In progress" value={data.quests.in_progress.toLocaleString()} />
            <StatTile label="Not started" value={data.quests.not_started.toLocaleString()} />
          </div>
        </section>
      )}

      <section>
        <h2 className="heading-rule mb-3 text-lg font-semibold">Achievement diaries</h2>
        {data.diaries.length === 0 ? (
          <EmptyState title="No diary progress recorded yet" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.diaries.map((area) => (
              <DiaryCard key={area.area_id} area={area} />
            ))}
          </div>
        )}
      </section>

      {data.last_synced && (
        <p className="text-osrs-parchment-dark/50 text-xs">
          Last synced {new Date(data.last_synced).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function DiaryCard({ area }: { area: DiaryArea }) {
  return (
    <Card padding="p-4">
      <h3 className="mb-2 text-sm font-medium">{area.name}</h3>
      <ul className="space-y-1">
        {area.tiers.map((tier) => (
          <li key={tier.tier} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-osrs-parchment-dark/70">{tier.name}</span>
            {/* Completed count only: the per-tier task totals are reference
                data we do not hold yet, and inventing them would be worse than
                omitting the denominator. */}
            <span className="text-osrs-gold-bright font-mono tabular-nums">
              {tier.completed}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Header({ name, playerId }: { name: string; playerId: number }) {
  return (
    <div>
      <Link
        href={`/players/${playerId}`}
        className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-sm transition-colors"
      >
        ← {name}
      </Link>
      <h1 className="heading-rule mt-1 text-2xl font-bold">Achievements</h1>
    </div>
  );
}
