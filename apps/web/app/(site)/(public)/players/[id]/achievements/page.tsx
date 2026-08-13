/**
 * Combat achievements, quests and achievement diaries for one player.
 *
 * Laid out the way the in-game interfaces are, rather than as generic stat
 * cards: combat achievements grouped per boss with completed/total and the
 * game's red/gold/green colouring, diaries as an area-by-tier grid. Players
 * already know these screens, so matching them means the page needs no reading.
 *
 * All three come from one backend call — they are three panels of one page and
 * should not cost three round-trips.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { DiaryArea } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { resolveRef } from "@/lib/entity-ref";
import { EmptyState } from "@/components/ui";
import { OsrsListRow, OsrsWindow, completionTone } from "@/components/osrs-panel";

export const revalidate = 60;

/** Diary tiers in the order the game lists them. */
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

  const quests = data.quests;
  const questTotal = quests.finished + quests.in_progress + quests.not_started;
  const bosses = data.combat_achievements.bosses ?? [];
  const caDone = bosses.reduce((sum, b) => sum + b.completed, 0);
  const caTotal = bosses.reduce((sum, b) => sum + b.total, 0);

  return (
    <div className="space-y-6">
      <Header name={player.name} playerId={playerId} />

      <div className="grid gap-4 lg:grid-cols-2">
        <OsrsWindow
          title="Combat Achievements"
          subtitle={
            caTotal > 0 ? (
              <span className={completionTone(caDone, caTotal)}>
                {caDone}/{caTotal}
              </span>
            ) : data.combat_achievements.tasks_completed != null ? (
              <span className="text-osrs-gold-bright">
                {data.combat_achievements.tasks_completed} completed
              </span>
            ) : null
          }
        >
          {bosses.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No per-boss breakdown yet"
                hint="The next sync from an up-to-date plugin records which individual tasks are done."
              />
            </div>
          ) : (
            // Scrolls like the real interface instead of growing the page to
            // sixty-five rows tall.
            <div className="max-h-[32rem] overflow-y-auto">
              <div className="grid sm:grid-cols-2">
                {bosses.map((boss) => (
                  <OsrsListRow
                    key={boss.boss}
                    label={boss.boss}
                    completed={boss.completed}
                    total={boss.total}
                  />
                ))}
              </div>
            </div>
          )}
        </OsrsWindow>

        <div className="space-y-4">
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
                    {data.diaries.map((area) => (
                      <DiaryRow key={area.area_id} area={area} />
                    ))}
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
      </div>

      {data.last_synced && (
        <p className="text-osrs-parchment-dark/50 text-xs">
          Last synced {new Date(data.last_synced).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function DiaryRow({ area }: { area: DiaryArea }) {
  const byTier = new Map(area.tiers.map((t) => [t.tier, t.completed]));
  return (
    <tr className="border-osrs-bronze/15 border-b last:border-0">
      <td className="text-osrs-parchment/90 px-2 py-1">{area.name}</td>
      {DIARY_TIERS.map((_, tier) => {
        const completed = byTier.get(tier) ?? 0;
        return (
          <td
            key={tier}
            className={`px-2 py-1 text-right tabular-nums ${
              completed > 0 ? "text-osrs-gold-bright" : "text-osrs-parchment-dark/40"
            }`}
          >
            {completed}
          </td>
        );
      })}
    </tr>
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
