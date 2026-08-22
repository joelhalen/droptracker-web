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
import type {
  PlayerAchievements,
  PlayerCollectionLog,
  PlayerLootTracker,
  Submission,
} from "@droptracker/api-types";

import { CharacterViewer } from "@/components/character-viewer";
import { LootTracker } from "@/components/loot-tracker";
import { SubmissionList } from "@/components/submission-list";
import { CollectionLogBrowser } from "@/components/collection-log-browser";
import { CombatAchievementsBrowser } from "@/components/combat-achievements-browser";
import { EmptyState } from "@/components/ui";
import { OsrsWindow, completionTone } from "@/components/osrs-panel";
import { SOON_BADGE, SOON_TITLE, STATE_SYNC_RELEASED, stateSyncEmpty } from "@/lib/plugin-features";

type TabKey = "loot" | "submissions" | "collection" | "combat" | "diaries";

export function ProfileShowcase({
  playerId,
  modelFingerprint,
  modelHasPet,
  collectionLog,
  achievements,
  loot,
  submissions,
  stats,
  badges,
}: {
  playerId: number;
  modelFingerprint?: string | null;
  modelHasPet?: boolean;
  collectionLog: PlayerCollectionLog | null;
  achievements: PlayerAchievements | null;
  loot: PlayerLootTracker | null;
  submissions: Submission[];
  /** Stat tiles, rendered under the character. Server-rendered by the page. */
  stats?: React.ReactNode;
  /** Badge icons, rendered with the character rather than in their own card. */
  badges?: React.ReactNode;
}) {
  // Collapsing gives the tab content the whole width. Off by default: the
  // character is the first thing most people come to a profile to see.
  const [panelOpen, setPanelOpen] = useState(true);

  const combat = achievements?.combat_achievements;
  const hasCombat = !!combat?.monsters.length;
  // `tabs` is the log's *structure* and comes back populated for everyone, so
  // it cannot stand in for "this player has a log" — without the has_synced
  // check an unsynced profile renders a complete, all-unobtained collection
  // log as if the player owned none of it.
  const hasLog = !!collectionLog?.has_synced && collectionLog.tabs.length > 0;
  const hasDiaries = !!achievements?.diaries.length;

  const hasLoot = !!loot;
  const hasSubmissions = submissions.length > 0;

  // Loot first by default: tracking drops is what this site is for, and a
  // profile is far more likely to have loot than a synced collection log.
  const [tab, setTab] = useState<TabKey>(
    hasLoot
      ? "loot"
      : hasSubmissions
        ? "submissions"
        : hasLog
          ? "collection"
          : hasCombat
            ? "combat"
            : "diaries",
  );

  // A sync-backed tab with nothing in it is labelled "Soon" rather than left
  // blank: the panels are built and clickable, so without the pill an empty
  // one reads as this player's data failing to load.
  const soon = STATE_SYNC_RELEASED ? undefined : SOON_BADGE;
  const soonTone = "text-osrs-parchment-dark/50";

  const tabs: { key: TabKey; label: string; badge?: string; tone?: string }[] = [
    { key: "loot", label: "Loot" },
    {
      key: "submissions",
      label: "Submissions",
      badge: hasSubmissions ? String(submissions.length) : undefined,
    },
    {
      key: "collection",
      label: "Collection Log",
      badge: hasLog
        ? `${(collectionLog!.slots ?? collectionLog!.obtained).toLocaleString()}/${(collectionLog!.slots_total ?? collectionLog!.total).toLocaleString()}`
        : soon,
      tone: hasLog
        ? completionTone(
            collectionLog!.slots ?? collectionLog!.obtained,
            collectionLog!.slots_total ?? collectionLog!.total,
          )
        : soonTone,
    },
    {
      key: "combat",
      label: "Combat Achievements",
      badge:
        combat?.tasks_completed != null && combat.total
          ? `${combat.tasks_completed}/${combat.total}`
          : soon,
      tone:
        combat?.tasks_completed != null && combat.total
          ? completionTone(combat.tasks_completed, combat.total)
          : soonTone,
    },
    {
      key: "diaries",
      label: "Diaries",
      badge: hasDiaries ? `${achievements!.diaries.length}` : soon,
      tone: hasDiaries ? undefined : soonTone,
    },
  ];

  return (
    <section className="rise-in">
      {/* One window for the whole account. The character used to sit in its own
          card beside this one, which read as two unrelated things and left the
          tabs boxed into a narrow column. */}
      <OsrsWindow title="Account">
        <div className="lg:grid lg:grid-cols-[auto_minmax(0,1fr)]">
          <aside
            className={`border-osrs-bronze/40 shrink-0 border-b transition-[width] duration-200 lg:border-r lg:border-b-0 ${
              panelOpen ? "lg:w-56" : "lg:w-10"
            }`}
          >
            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              aria-expanded={panelOpen}
              aria-controls="profile-character-panel"
              title={panelOpen ? "Hide character panel" : "Show character panel"}
              className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright flex w-full items-center gap-1.5 px-2.5 py-2 text-xs tracking-wide uppercase transition-colors"
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden
                className={`size-3.5 shrink-0 transition-transform duration-200 ${
                  panelOpen ? "" : "rotate-180"
                }`}
              >
                <path
                  d="M10 3L5 8l5 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {/* Collapsed, the label would not fit the rail on desktop — but on
                  mobile the rail does not exist and the word is the only clue
                  as to what this expands. */}
              <span className={panelOpen ? "" : "lg:sr-only"}>Character</span>
            </button>

            <div id="profile-character-panel" className={panelOpen ? "px-3 pb-3" : "hidden"}>
              {/* Below lg the rail is a full-width band rather than a column,
                  so the character sits BESIDE its stats there. Stacking it
                  meant a phone scrolled past a screen-height of model before
                  reaching the tabs, which is what the profile is actually for. */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start lg:flex-col">
                <div className="w-full sm:w-44 sm:shrink-0 lg:w-full">
                  {modelFingerprint ? (
                    <CharacterViewer
                      playerId={playerId}
                      fingerprint={modelFingerprint}
                      hasPet={modelHasPet ?? false}
                    />
                  ) : (
                    <EmptyState
                      {...stateSyncEmpty(
                        "Character model",
                        "Enable “Upload character model” in the DropTracker plugin to show your character here.",
                      )}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-3 lg:w-full lg:flex-none">
                  {badges}
                  {stats}
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
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
                    <span
                      className={`ml-2 text-xs ${t.tone ?? "text-osrs-parchment-dark/60"}`}
                      title={t.badge === SOON_BADGE ? SOON_TITLE : undefined}
                    >
                      {t.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {tab === "loot" &&
              (hasLoot ? (
                <div className="p-3">
                  <LootTracker playerId={playerId} initial={loot!} />
                </div>
              ) : (
                // Loot comes from submitted drops, not the account sync, so this
                // one must not send people to a plugin setting that would not
                // help — and, right now, does not exist in the shipped build.
                <div className="p-4">
                  <EmptyState
                    title="No loot recorded"
                    hint="Drops submitted through the DropTracker plugin show up here."
                  />
                </div>
              ))}

            {tab === "submissions" && (
              <div className="max-h-[26rem] overflow-y-auto p-3">
                <SubmissionList submissions={submissions} />
              </div>
            )}

            {tab === "collection" &&
              (hasLog ? (
                <CollectionLogBrowser tabs={collectionLog!.tabs} />
              ) : (
                <Empty
                  label="Collection log sync"
                  hint="Enable “Sync account progress” in the DropTracker plugin, then open the collection log in game."
                />
              ))}

            {tab === "combat" &&
              (hasCombat ? (
                <CombatAchievementsBrowser combat={combat!} />
              ) : (
                <Empty
                  label="Combat achievements"
                  hint="Enable “Sync account progress” in the DropTracker plugin to show this."
                />
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
                                    done > 0
                                      ? "text-osrs-gold-bright"
                                      : "text-osrs-parchment-dark/40"
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
                <Empty
                  label="Achievement diaries"
                  hint="Enable “Sync account progress” in the DropTracker plugin to show this."
                />
              ))}
          </div>
        </div>
      </OsrsWindow>
    </section>
  );
}

/** Empty state for one of the account-progress tabs. */
function Empty({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="p-4">
      <EmptyState {...stateSyncEmpty(label, hint)} />
    </div>
  );
}
