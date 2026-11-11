"use client";

/**
 * Combat achievements laid out the way the in-game interface is: the points
 * bar across the top ("Total points — next unlock in N"), the six difficulty
 * tiers with their sword icons, and then either the task list with the game's
 * four filters (tier, type, monster, completed) or the boss grid.
 *
 * Completed tasks are green, as in game. Where the plugin saw the task being
 * completed, its date is shown too — something the game itself does not keep.
 */
import { useMemo, useState } from "react";
import type { PlayerAchievements } from "@droptracker/api-types";
import {
  CA_TIERS,
  NO_CA_FILTERS,
  SITE_IMG_BASE,
  caTierIcon,
  filterCaTasks,
  flattenCaTasks,
  rebaseImg,
  type CaFilters,
} from "@/lib/player-progress";

type Combat = PlayerAchievements["combat_achievements"];

const PAGE = 60;

function barTone(completed: number, total: number): string {
  if (total > 0 && completed >= total) return "bg-osrs-green";
  return "bg-osrs-gold-bright";
}

function TierIcon({ tier, className = "size-5" }: { tier: string; className?: string }) {
  const src = caTierIcon(tier);
  if (!src) return null;
  return <img src={src} alt="" className={`${className} shrink-0 object-contain [image-rendering:pixelated]`} />;
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block min-w-0">
      <span className="font-osrs text-osrs-gold text-sm">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-osrs-bronze/50 bg-osrs-surface-3 text-osrs-parchment font-osrs mt-0.5 block w-full rounded border px-1.5 py-1 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CombatAchievementsBrowser({
  combat,
  imgBase = SITE_IMG_BASE,
}: {
  combat: Combat;
  imgBase?: string;
}) {
  const [view, setView] = useState<"tasks" | "bosses">("tasks");
  const [filters, setFilters] = useState<CaFilters>(NO_CA_FILTERS);
  const [open, setOpen] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);

  const tasks = useMemo(() => flattenCaTasks(combat), [combat]);
  const visible = useMemo(() => filterCaTasks(tasks, filters), [tasks, filters]);
  const types = useMemo(() => [...new Set(tasks.map((t) => t.type).filter(Boolean))].sort(), [tasks]);
  const monsters = useMemo(
    () => [...combat.monsters].sort((a, b) => a.monster.localeCompare(b.monster)),
    [combat.monsters],
  );

  if (!combat.monsters.length) return null;

  const set = (patch: Partial<CaFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setShown(PAGE);
  };

  const points = combat.points ?? null;
  const pointsTotal = combat.points_total ?? null;
  // As in game, the bar fills towards the next unlock, not towards every task.
  const fill =
    combat.progress != null
      ? Math.min(100, combat.progress)
      : points != null && pointsTotal
        ? Math.min(100, (points / pointsTotal) * 100)
        : null;

  return (
    <div>
      {/* The bar the game draws across the top of every CA screen. */}
      {points != null && (
        <div className="border-osrs-bronze/30 border-b p-2.5">
          <div className="border-osrs-bronze/50 bg-osrs-surface-3 relative h-7 overflow-hidden rounded border">
            {fill != null && (
              <div className="bg-osrs-green/70 absolute inset-y-0 left-0" style={{ width: `${fill}%` }} />
            )}
            <div className="font-osrs text-osrs-parchment absolute inset-0 flex items-center justify-center gap-1.5 px-2 text-sm [text-shadow:1px_1px_0_#000]">
              {combat.tier && <TierIcon tier={combat.tier} className="size-4" />}
              <span className="truncate">
                Total points: {points.toLocaleString("en-US")}
                {combat.next_tier && combat.points_to_next != null
                  ? ` · ${combat.next_tier} in ${combat.points_to_next.toLocaleString("en-US")} points`
                  : combat.tier
                    ? ` · ${combat.tier} tier`
                    : ""}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Difficulty tiers. Clicking one filters the task list to it. */}
      <div className="border-osrs-bronze/30 grid grid-cols-3 gap-1.5 border-b p-2.5 sm:grid-cols-6">
        {CA_TIERS.map((name) => {
          const tier = combat.tiers.find((t) => t.tier === name);
          if (!tier) return null;
          const active = filters.tier === name;
          const unlockAt = combat.thresholds?.[name];
          const unlocked = points != null && unlockAt != null && points >= unlockAt;
          return (
            <button
              key={name}
              type="button"
              onClick={() => {
                set({ tier: active ? "all" : name });
                setView("tasks");
              }}
              aria-pressed={active}
              title={
                unlockAt != null
                  ? `${name} rewards unlock at ${unlockAt.toLocaleString("en-US")} points${unlocked ? " (unlocked)" : ""}`
                  : undefined
              }
              className={`rounded border px-1.5 pt-1 pb-1.5 text-center transition-colors ${
                active
                  ? "border-osrs-gold bg-osrs-bronze/30"
                  : "border-osrs-bronze/40 bg-osrs-surface-2/60 hover:bg-osrs-bronze/15"
              }`}
            >
              <div className="font-osrs text-osrs-gold text-sm leading-tight">{name}</div>
              <div className="my-0.5 flex justify-center">
                <TierIcon tier={name} className={`size-6 ${unlocked ? "" : "opacity-60"}`} />
              </div>
              <div
                className={`font-osrs text-sm leading-none tabular-nums ${
                  tier.completed >= tier.total ? "text-osrs-green" : "text-osrs-gold-bright"
                }`}
              >
                {tier.completed}/{tier.total}
              </div>
              <div className="bg-osrs-surface-3 mt-1 h-1.5 overflow-hidden rounded-sm">
                <div
                  className={`h-full ${barTone(tier.completed, tier.total)}`}
                  style={{ width: `${tier.total ? (tier.completed / tier.total) * 100 : 0}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <div className="border-osrs-bronze/30 flex gap-1 border-b px-2 pt-1.5">
        {(["tasks", "bosses"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-current={view === v}
            className={`font-osrs rounded-t px-3 py-1 text-sm transition-colors ${
              view === v
                ? "bg-osrs-bronze/30 text-osrs-gold-bright"
                : "text-osrs-parchment-dark/70 hover:bg-osrs-bronze/15"
            }`}
          >
            {v === "tasks" ? "Tasks" : "Bosses"}
          </button>
        ))}
      </div>

      {view === "bosses" ? (
        <div className="grid max-h-[30rem] grid-cols-2 gap-1.5 overflow-y-auto p-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {monsters.map((m) => {
            const icon = rebaseImg(m.icon_url, imgBase);
            const done = m.completed >= m.total;
            return (
              <button
                key={m.monster}
                type="button"
                onClick={() => {
                  set({ ...NO_CA_FILTERS, monster: m.monster });
                  setView("tasks");
                }}
                className="border-osrs-bronze/30 bg-osrs-surface-2/60 hover:bg-osrs-bronze/15 flex items-center gap-2 rounded border px-2 py-1.5 text-left transition-colors"
              >
                <span className="flex size-8 shrink-0 items-center justify-center">
                  {icon ? (
                    <img
                      src={icon}
                      alt=""
                      loading="lazy"
                      className={`max-h-8 max-w-8 object-contain ${m.completed === 0 ? "opacity-50 grayscale" : ""}`}
                    />
                  ) : (
                    <img src="/osrs/ca.png" alt="" className="size-4 opacity-60 [image-rendering:pixelated]" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-osrs text-osrs-parchment block truncate text-sm leading-tight">
                    {m.monster}
                  </span>
                  <span
                    className={`font-osrs block text-xs leading-tight tabular-nums ${
                      done ? "text-osrs-green" : m.completed > 0 ? "text-osrs-gold-bright" : "text-osrs-red"
                    }`}
                  >
                    {m.completed}/{m.total}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid md:grid-cols-[11rem_minmax(0,1fr)]">
          <div className="border-osrs-bronze/25 grid grid-cols-2 gap-2 border-b p-2.5 md:block md:space-y-2 md:border-r md:border-b-0">
            <div className="font-osrs text-osrs-gold-bright col-span-2 hidden text-center text-base md:block">
              Filters
            </div>
            <Select
              label="Tier"
              value={filters.tier}
              onChange={(tier) => set({ tier })}
              options={[{ value: "all", label: "All" }, ...CA_TIERS.map((t) => ({ value: t, label: t }))]}
            />
            <Select
              label="Type"
              value={filters.type}
              onChange={(type) => set({ type })}
              options={[{ value: "all", label: "All" }, ...types.map((t) => ({ value: t, label: t }))]}
            />
            <Select
              label="Monster"
              value={filters.monster}
              onChange={(monster) => set({ monster })}
              options={[
                { value: "all", label: "All" },
                ...monsters.map((m) => ({ value: m.monster, label: m.monster })),
              ]}
            />
            <Select
              label="Completed"
              value={filters.completed}
              onChange={(completed) => set({ completed })}
              options={[
                { value: "all", label: "All" },
                { value: "complete", label: "Complete" },
                { value: "incomplete", label: "Incomplete" },
              ]}
            />
            <label className="col-span-2 block">
              <span className="sr-only">Search tasks</span>
              <input
                type="search"
                value={filters.query}
                onChange={(e) => set({ query: e.target.value })}
                placeholder="Search tasks"
                className="border-osrs-bronze/50 bg-osrs-surface-3 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 block w-full rounded border px-2 py-1 text-sm"
              />
            </label>
            <div className="text-osrs-parchment-dark/60 col-span-2 text-xs tabular-nums">
              {visible.filter((t) => t.completed).length}/{visible.length} shown complete
            </div>
          </div>

          <div className="max-h-[30rem] overflow-y-auto">
            {visible.length === 0 ? (
              <p className="text-osrs-parchment-dark/60 p-6 text-center text-sm">No tasks match these filters.</p>
            ) : (
              <ul>
                {visible.slice(0, shown).map((task, index) => {
                  const key = `${task.monster}|${task.name}`;
                  const expanded = open === key;
                  return (
                    <li key={key} className={index % 2 ? "bg-osrs-surface-2/40" : ""}>
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : key)}
                        aria-expanded={expanded}
                        className="hover:bg-osrs-bronze/15 flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors"
                      >
                        <span aria-hidden className="font-osrs text-osrs-gold w-3 shrink-0 text-center text-lg leading-none">
                          {expanded ? "−" : "+"}
                        </span>
                        <TierIcon tier={task.tier} className={`size-6 ${task.completed ? "" : "opacity-70"}`} />
                        <span className="min-w-0 flex-1">
                          <span
                            className={`font-osrs block truncate text-[15px] leading-tight ${
                              task.completed ? "text-osrs-green" : "text-osrs-parchment-dark/80"
                            }`}
                          >
                            {task.name}
                          </span>
                          <span className="font-osrs block truncate text-xs leading-tight">
                            <span className="text-osrs-gold">Monster:</span>{" "}
                            <span className="text-osrs-parchment/90">{task.monster}</span>
                          </span>
                        </span>
                        <span
                          className={`shrink-0 text-xs ${task.completed ? "text-osrs-green" : "text-osrs-red/80"}`}
                        >
                          {task.completed ? "✔" : "✘"}
                        </span>
                      </button>
                      {expanded && (
                        <div className="font-osrs space-y-1 px-2.5 pb-2.5 pl-[3.1rem] text-sm leading-snug">
                          <p>
                            <span className="text-osrs-gold">Type:</span>{" "}
                            <span className="text-osrs-parchment">
                              {task.type}
                              {task.points ? ` (+${task.points} point${task.points === 1 ? "" : "s"})` : ""}
                            </span>
                          </p>
                          <p>
                            <span className="text-osrs-gold">Description:</span>{" "}
                            <span className="text-osrs-parchment">{task.description}</span>
                          </p>
                          {task.completed && (
                            <p>
                              <span className="text-osrs-gold">Completed:</span>{" "}
                              <span className="text-osrs-parchment" suppressHydrationWarning>
                                {task.completed_at
                                  ? new Date(task.completed_at * 1000).toLocaleDateString(undefined, {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    })
                                  : "before DropTracker was tracking this account"}
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {visible.length > shown && (
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright w-full py-2 text-xs tracking-wide uppercase transition-colors"
              >
                Show more ({visible.length - shown} left)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
