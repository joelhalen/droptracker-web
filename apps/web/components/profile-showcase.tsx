"use client";

/**
 * The top of a player profile: their character beside a tabbed panel holding
 * everything you would flip between in game — collection log, combat
 * achievements, diaries and quests.
 *
 * Previously each of these was its own page, so seeing a player's log meant
 * leaving their profile and coming back. Putting the character next to the tabs
 * mirrors how the game presents an account and makes the profile the one place
 * you need.
 */
import { useState } from "react";
import type { PlayerAchievements, PlayerCollectionLog } from "@droptracker/api-types";

import { CharacterViewer } from "@/components/character-viewer";
import { CollectionLogBrowser } from "@/components/collection-log-browser";
import { CombatAchievementsBrowser } from "@/components/combat-achievements-browser";
import { EmptyState } from "@/components/ui";
import { OsrsWindow, completionTone } from "@/components/osrs-panel";

type TabKey = "collection" | "combat" | "diaries";

export function ProfileShowcase({
  playerId,
  modelFingerprint,
  modelHasPet,
  collectionLog,
  achievements,
}: {
  playerId: number;
  modelFingerprint?: string | null;
  modelHasPet?: boolean;
  collectionLog: PlayerCollectionLog | null;
  achievements: PlayerAchievements | null;
}) {
  const combat = achievements?.combat_achievements;
  const hasCombat = !!combat?.monsters.length;
  const hasLog = !!collectionLog?.tabs.length;
  const hasDiaries = !!achievements?.diaries.length;

  // Open on whichever tab actually has something in it, so a player who has
  // only synced one thing does not land on an empty panel.
  const [tab, setTab] = useState<TabKey>(
    hasLog ? "collection" : hasCombat ? "combat" : "diaries",
  );

  // Nothing synced at all: the showcase would be three empty panels.
  if (!hasLog && !hasCombat && !hasDiaries && !modelFingerprint) return null;

  const tabs: { key: TabKey; label: string; badge?: string; tone?: string }[] = [
    {
      key: "collection",
      label: "Collection Log",
      badge: collectionLog
        ? `${(collectionLog.slots ?? collectionLog.obtained).toLocaleString()}/${(collectionLog.slots_total ?? collectionLog.total).toLocaleString()}`
        : undefined,
      tone: collectionLog
        ? completionTone(
            collectionLog.slots ?? collectionLog.obtained,
            collectionLog.slots_total ?? collectionLog.total,
          )
        : undefined,
    },
    {
      key: "combat",
      label: "Combat Achievements",
      badge:
        combat?.tasks_completed != null && combat.total
          ? `${combat.tasks_completed}/${combat.total}`
          : undefined,
      tone:
        combat?.tasks_completed != null && combat.total
          ? completionTone(combat.tasks_completed, combat.total)
          : undefined,
    },
    { key: "diaries", label: "Diaries", badge: hasDiaries ? `${achievements!.diaries.length}` : undefined },
  ];

  return (
    <section className="rise-in">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_1fr]">
        {modelFingerprint ? (
          <CharacterViewer
            playerId={playerId}
            fingerprint={modelFingerprint}
            hasPet={modelHasPet ?? false}
          />
        ) : (
          <OsrsWindow title="Character">
            <div className="p-4">
              <EmptyState
                title="No character model"
                hint="Enable “Upload character model” in the DropTracker plugin to show your character here."
              />
            </div>
          </OsrsWindow>
        )}

        <OsrsWindow title="Account">
          <div className="border-osrs-bronze/40 flex flex-wrap gap-1 border-b px-2 pt-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={tab === t.key}
                className={`font-osrs rounded-t px-3 py-1.5 text-sm transition-colors ${
                  tab === t.key
                    ? "bg-osrs-bronze/30 text-osrs-gold-bright"
                    : "text-osrs-parchment-dark/70 hover:bg-osrs-bronze/15"
                }`}
              >
                {t.label}
                {t.badge && (
                  <span className={`ml-2 text-xs ${t.tone ?? "text-osrs-parchment-dark/60"}`}>
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === "collection" &&
            (hasLog ? (
              <CollectionLogBrowser tabs={collectionLog!.tabs} />
            ) : (
              <Empty what="collection log" />
            ))}

          {tab === "combat" &&
            (hasCombat ? (
              <CombatAchievementsBrowser combat={combat!} />
            ) : (
              <Empty what="combat achievements" />
            ))}

          {tab === "diaries" &&
            (hasDiaries ? (
              <div className="max-h-[26rem] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-osrs-bronze/30 text-osrs-parchment-dark/60 border-b">
                      <th className="px-2 py-1 text-left font-normal">Area</th>
                      {["Easy", "Medium", "Hard", "Elite"].map((t) => (
                        <th key={t} className="px-2 py-1 text-right font-normal">
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="font-osrs">
                    {achievements!.diaries.map((area) => {
                      const byTier = new Map(area.tiers.map((t) => [t.tier, t.completed]));
                      return (
                        <tr key={area.area_id} className="border-osrs-bronze/15 border-b last:border-0">
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
            ) : (
              <Empty what="achievement diaries" />
            ))}
        </OsrsWindow>
      </div>
    </section>
  );
}

function Empty({ what }: { what: string }) {
  return (
    <div className="p-4">
      <EmptyState
        title={`No ${what} recorded`}
        hint="Enable “Sync account progress” in the DropTracker plugin to show this."
      />
    </div>
  );
}
