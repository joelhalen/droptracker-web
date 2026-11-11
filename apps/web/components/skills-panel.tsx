"use client";

/**
 * A player's skills as the in-game stats panel lays them out: three columns,
 * each skill's icon beside its level, total level at the foot. Hovering a
 * skill shows its XP, and what it gained over the chosen period when we have
 * history for it.
 */
import type { PlayerOverview, XpGains } from "@droptracker/api-types";
import { SKILL_ORDER, compactNumber, skillLabel } from "@/lib/player-progress";

type Skills = PlayerOverview["skills"];

export function SkillsPanel({
  skills,
  gains,
  imgBase,
}: {
  skills: Skills;
  /** XP gained per skill for the period on screen, if known. */
  gains?: XpGains | null;
  imgBase: string;
}) {
  const bySkill = new Map(skills.skills.map((s) => [s.skill, s]));
  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5">
        {SKILL_ORDER.map((key) => {
          const skill = bySkill.get(key);
          const gained = gains?.skills[key];
          const level = skill?.level ?? 1;
          return (
            <div
              key={key}
              title={
                skill
                  ? `${skillLabel(key)}: ${skill.xp.toLocaleString("en-US")} XP${gained ? ` (+${gained.toLocaleString("en-US")})` : ""}`
                  : skillLabel(key)
              }
              className={`border-osrs-bronze/30 bg-osrs-surface-2/60 relative flex items-center gap-2 overflow-hidden rounded border px-2 py-1.5 ${
                level >= 99 ? "ring-osrs-gold/30 ring-1" : ""
              }`}
            >
              <img
                src={`${imgBase}/metrics/${key}.png`}
                alt=""
                className="size-6 shrink-0 object-contain [image-rendering:pixelated]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-osrs-parchment-dark/60 hidden truncate text-[11px] sm:block">
                    {skillLabel(key)}
                  </span>
                  <span
                    className={`font-osrs ml-auto text-base leading-none ${
                      level >= 99 ? "text-osrs-gold-bright" : "text-osrs-parchment"
                    }`}
                  >
                    {level}
                  </span>
                </div>
                {gained ? (
                  <div className="text-osrs-green text-right text-[10px] leading-tight tabular-nums">
                    +{compactNumber(gained)}
                  </div>
                ) : null}
              </div>
              {/* Progress to the next level, as a hairline along the foot. */}
              {skill && level < 99 && (
                <span
                  aria-hidden
                  className="bg-osrs-gold/60 absolute bottom-0 left-0 h-0.5"
                  style={{ width: `${skill.progress}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="font-osrs text-osrs-parchment-dark/80 mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1 text-sm">
        <span>
          Total level{" "}
          <span className="text-osrs-gold-bright">
            {skills.total_level?.toLocaleString("en-US") ?? "—"}
          </span>
        </span>
        {skills.combat_level != null && (
          <span>
            Combat <span className="text-osrs-gold-bright">{skills.combat_level}</span>
          </span>
        )}
        <span>
          Total XP{" "}
          <span className="text-osrs-gold-bright">
            {skills.total_xp != null ? compactNumber(skills.total_xp) : "—"}
          </span>
        </span>
      </div>
    </div>
  );
}
