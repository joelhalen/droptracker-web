/**
 * Combat achievements, quests and diaries for one player.
 *
 * The sync that writes this ships with plugin v6, published 2026-08-24, so it
 * populates for anyone who has updated. `lib/plugin-features.ts` still carries
 * the release flag and the copy an unreachable panel would show.
 *
 * The profile page now shows all of this inline, so this route exists as a
 * deep link and a full-width view for people who want only this — it reuses the
 * same browser component rather than presenting the data a second way.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { resolveRef } from "@/lib/entity-ref";
import { EmptyState } from "@/components/ui";
import { OsrsWindow, completionTone } from "@/components/osrs-panel";
import { CombatAchievementsBrowser } from "@/components/combat-achievements-browser";
import { stateSyncEmpty } from "@/lib/plugin-features";

export const revalidate = 60;

const DIARY_TIERS = ["Easy", "Medium", "Hard", "Elite"];

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

export default async function AchievementsPage({ params }: { params: Promise<{ id: string }> }) {
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
          {...stateSyncEmpty(
            "Achievements",
            `${player.name} has not synced their account progress, so there is nothing to show here yet. It fills in once they are on DropTracker plugin v6 — "Sync account progress" is on by default, under Advanced.`,
          )}
        />
      </div>
    );
  }

  const combat = data.combat_achievements;
  const quests = data.quests;
  const questTotal = quests.finished + quests.in_progress + quests.not_started;

  return (
    <div className="space-y-6">
      <Header name={player.name} playerId={playerId} />

      <OsrsWindow
        title="Combat Achievements"
        subtitle={
          combat.tasks_completed != null && combat.total ? (
            <span className={completionTone(combat.tasks_completed, combat.total)}>
              {combat.tasks_completed}/{combat.total}
            </span>
          ) : null
        }
      >
        {combat.monsters.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No combat achievement progress recorded yet" />
          </div>
        ) : (
          <CombatAchievementsBrowser combat={combat} />
        )}
      </OsrsWindow>

      <div className="grid gap-4 lg:grid-cols-2">
        <OsrsWindow title="Achievement Diaries" subtitle={`${data.diaries.length} areas`}>
          {data.diaries.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No diary progress recorded yet" />
            </div>
          ) : (
            <div className="max-h-[22rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-osrs-bronze/30 text-osrs-parchment-dark/60 border-b">
                    <th className="px-2 py-1 text-left font-normal">Area</th>
                    {DIARY_TIERS.map((tier) => (
                      <th key={tier} className="px-2 py-1 text-right font-normal">
                        {tier}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-osrs">
                  {data.diaries.map((area) => {
                    const byTier = new Map(area.tiers.map((t) => [t.tier, t.completed]));
                    return (
                      <tr
                        key={area.area_id}
                        className="border-osrs-bronze/15 border-b last:border-0"
                      >
                        <td className="text-osrs-parchment/90 px-2 py-1">{area.name}</td>
                        {[0, 1, 2, 3].map((tier) => {
                          const done = byTier.get(tier) ?? 0;
                          return (
                            <td
                              key={tier}
                              className={`px-2 py-1 text-right tabular-nums ${
                                done > 0 ? "text-osrs-gold-bright" : "text-osrs-parchment-dark/40"
                              }`}
                            >
                              {done}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </OsrsWindow>

        <OsrsWindow
          title="Quests"
          subtitle={
            questTotal > 0 ? (
              <span className={completionTone(quests.finished, questTotal)}>
                {quests.finished}/{questTotal}
              </span>
            ) : null
          }
        >
          {questTotal === 0 ? (
            <div className="p-4">
              <EmptyState title="No quest progress recorded yet" />
            </div>
          ) : (
            <ul className="font-osrs divide-osrs-bronze/20 divide-y">
              <QuestRow label="Completed" value={quests.finished} tone="text-osrs-green" />
              <QuestRow label="Started" value={quests.in_progress} tone="text-osrs-gold-bright" />
              <QuestRow label="Not started" value={quests.not_started} tone="text-osrs-red" />
            </ul>
          )}
        </OsrsWindow>
      </div>

      {data.last_synced && (
        <p className="text-osrs-parchment-dark/50 text-xs">
          Last synced {new Date(data.last_synced).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function QuestRow({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <li className="flex items-baseline justify-between px-3 py-1.5 text-sm">
      <span className="text-osrs-parchment-dark/70">{label}</span>
      <span className={`tabular-nums ${tone}`}>{value.toLocaleString()}</span>
    </li>
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
