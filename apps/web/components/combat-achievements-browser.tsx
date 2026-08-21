"use client";

/**
 * Combat achievements browsed as the in-game interface presents them: tier
 * totals along the top, the monster list on the left, and that monster's
 * individual tasks on the right with their tier and completion state.
 */
import { useMemo, useState } from "react";
import type { PlayerAchievements } from "@droptracker/api-types";
import { completionTone } from "@/components/osrs-panel";

type Combat = PlayerAchievements["combat_achievements"];

/** Tier colours, roughly matching the in-game tier icons. */
const TIER_TONE: Record<string, string> = {
  Easy: "text-osrs-green",
  Medium: "text-osrs-gold-bright",
  Hard: "text-orange-400",
  Elite: "text-osrs-red",
  Master: "text-purple-400",
  Grandmaster: "text-osrs-parchment",
};

export function CombatAchievementsBrowser({ combat }: { combat: Combat }) {
  const [monsterName, setMonsterName] = useState<string | null>(null);
  const monster = useMemo(
    () =>
      combat.monsters.find((m) => m.monster === monsterName) ?? combat.monsters[0] ?? null,
    [combat.monsters, monsterName],
  );

  if (!combat.monsters.length) return null;

  return (
    <div>
      <div className="border-osrs-bronze/30 flex flex-wrap gap-x-4 gap-y-1 border-b px-3 py-2">
        {combat.tiers.map((tier) => (
          <span key={tier.tier} className="font-osrs text-sm">
            <span className={TIER_TONE[tier.tier] ?? "text-osrs-parchment"}>{tier.tier}</span>{" "}
            <span className={completionTone(tier.completed, tier.total)}>
              {tier.completed}/{tier.total}
            </span>
          </span>
        ))}
      </div>

      <div className="grid md:grid-cols-[minmax(10rem,14rem)_1fr]">
        <div className="border-osrs-bronze/25 max-h-[26rem] overflow-y-auto border-b md:border-r md:border-b-0">
          {combat.monsters.map((m) => {
            const tone = completionTone(m.completed, m.total);
            return (
              <button
                key={m.monster}
                type="button"
                onClick={() => setMonsterName(m.monster)}
                className={`font-osrs flex w-full items-baseline justify-between gap-2 px-2 py-1 text-left text-sm leading-tight transition-colors ${
                  monster?.monster === m.monster
                    ? "bg-osrs-bronze/30"
                    : "hover:bg-osrs-bronze/15"
                }`}
              >
                <span className={`truncate ${tone}`}>{m.monster}</span>
                <span className={`shrink-0 tabular-nums ${tone}`}>
                  {m.completed}/{m.total}
                </span>
              </button>
            );
          })}
        </div>

        <div className="max-h-[26rem] overflow-y-auto p-3">
          {monster && (
            <>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="font-osrs text-osrs-gold-bright text-base">
                  {monster.monster}
                </h3>
                <span
                  className={`font-osrs text-sm ${completionTone(monster.completed, monster.total)}`}
                >
                  {monster.completed}/{monster.total}
                </span>
              </div>
              <ul className="divide-osrs-bronze/15 divide-y">
                {monster.tasks.map((task) => (
                  <li key={task.name} className="flex items-start gap-2 py-1.5">
                    <span
                      aria-hidden
                      className={task.completed ? "text-osrs-green" : "text-osrs-red"}
                    >
                      {task.completed ? "✔" : "✘"}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span
                          className={`font-osrs text-sm ${task.completed ? "text-osrs-parchment" : "text-osrs-parchment-dark/60"}`}
                        >
                          {task.name}
                        </span>
                        <span className={`text-[11px] ${TIER_TONE[task.tier] ?? ""}`}>
                          {task.tier}
                        </span>
                        <span className="text-osrs-parchment-dark/40 text-[11px]">
                          {task.type}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-osrs-parchment-dark/60 text-xs">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
