"use client";

/**
 * "Fill for me" — generate a balanced, sized task set instead of hand-picking
 * one task at a time (disc docs/TASK_GENERATOR_PLAN.md).
 *
 * The admin sets a handful of things the backend can't guess (how many tasks,
 * how long, how big the teams are, what content to lean on) and gets a
 * preview. Every row can be locked, rerolled or removed; "Reroll unlocked"
 * redraws the rest while keeping each slot's difficulty. Nothing is written
 * until the admin adds the set:
 *
 *  - `mode="tasks"` saves the rows as the event's own tasks in one request
 *    (flat task list, board-game difficulty pools — tasks carry their tier).
 *  - `mode="cells"` hands the rows back to the caller (the bingo designer
 *    drops them into empty cells as inline tasks and autosaves the board).
 *
 * Difficulty is decided server-side from estimated team-hours against the
 * team's capacity for THIS event, so the same "Hard" means more on a
 * 40-person fortnight than on a 5-person weekend.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  EVENT_TASK_DIFFICULTIES,
  type EventTask,
  type EventTaskDifficulty,
  type EventTaskInput,
  type GeneratedTask,
  type TaskGeneratorActivity,
  type TaskGeneratorClanFocus,
  type TaskGeneratorCriteria,
  type TaskGeneratorMix,
  type TaskGeneratorOptions,
} from "@droptracker/api-types";
import { TASK_DIFFICULTY_LABELS } from "@/lib/events";
import { getErrorMessage } from "@/lib/errors";
import {
  addGeneratedEventTasks,
  fetchTaskGeneratorOptions,
  generateEventTasks,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";

const field =
  "bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-osrs-gold/60";
const chipOn =
  "border-osrs-gold/70 bg-osrs-gold/15 text-osrs-gold-bright rounded-full border px-2.5 py-0.5 text-xs";
const chipOff =
  "border-osrs-bronze/30 text-osrs-parchment-dark/60 hover:border-osrs-bronze/60 rounded-full border px-2.5 py-0.5 text-xs";
const smallBtn =
  "text-osrs-parchment-dark/70 hover:bg-osrs-bronze/15 hover:text-osrs-gold-bright rounded px-1.5 py-0.5 text-xs disabled:opacity-40";

const MIX_PRESETS = {
  balanced: { label: "Balanced", mix: { air: 3, water: 3, earth: 2, fire: 1 } },
  easy: { label: "Mostly easy", mix: { air: 5, water: 3, earth: 1, fire: 0 } },
  hard: { label: "Challenging", mix: { air: 1, water: 2, earth: 3, fire: 2 } },
  elite: { label: "Elite only", mix: { air: 0, water: 0, earth: 1, fire: 3 } },
} satisfies Record<string, { label: string; mix: TaskGeneratorMix }>;
type MixPreset = keyof typeof MIX_PRESETS | "custom";

const ACTIVITY_LABELS: Record<TaskGeneratorActivity, string> = {
  casual: "Casual (about 45 min a day)",
  normal: "Regular (about 1.5 h a day)",
  hardcore: "Very active (about 3 h a day)",
};

const FOCUS_LABELS: Record<TaskGeneratorClanFocus, string> = {
  off: "Anything",
  familiar: "What our members already do",
  fresh: "Things we rarely do",
};

const TIER_BADGE: Record<EventTaskDifficulty, string> = {
  air: "border-sky-400/40 text-sky-200",
  water: "border-emerald-400/40 text-emerald-200",
  earth: "border-amber-400/50 text-amber-200",
  fire: "border-rose-400/50 text-rose-200",
};

/** How many recently seen keys rerolls avoid, so they don't flip-flop. */
const SEEN_CAP = 400;

function formatHours(h: number): string {
  if (h < 1) return `~${Math.max(5, Math.round((h * 60) / 5) * 5)} min`;
  if (h < 10) return `~${Math.round(h * 10) / 10} h`;
  return `~${Math.round(h)} h`;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2_000_000_000) + 1;
}

type Props = {
  groupId: number | null;
  eventId: number;
  /** "tasks": save as event tasks. "cells": hand the rows to `onUse`. */
  mode?: "tasks" | "cells";
  /** Starting task count (e.g. the bingo board's empty cells). */
  defaultCount?: number;
  onAdded?: (tasks: EventTask[]) => void;
  onUse?: (tasks: EventTaskInput[]) => void;
  onClose: () => void;
};

export function EventTaskGenerator({
  groupId,
  eventId,
  mode = "tasks",
  defaultCount,
  onAdded,
  onUse,
  onClose,
}: Props) {
  const [options, setOptions] = useState<TaskGeneratorOptions | null>(null);
  // Only seeds the first value; later prop changes don't reset the form.
  const initialCount = useRef(defaultCount);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [count, setCount] = useState(defaultCount ?? 12);
  const [days, setDays] = useState(7);
  const [teamSize, setTeamSize] = useState(5);
  const [activity, setActivity] = useState<TaskGeneratorActivity>("normal");
  const [preset, setPreset] = useState<MixPreset>("balanced");
  const [customMix, setCustomMix] = useState<TaskGeneratorMix>(MIX_PRESETS.balanced.mix);
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [kinds, setKinds] = useState<Set<string>>(new Set());
  const [mustInclude, setMustInclude] = useState<string[]>([]);
  const [focus, setFocus] = useState<TaskGeneratorClanFocus>("off");
  const [showMore, setShowMore] = useState(false);

  const [rows, setRows] = useState<GeneratedTask[] | null>(null);
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [seen, setSeen] = useState<string[]>([]);
  const [summary, setSummary] = useState<{ capacity: number; unfilled: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    fetchTaskGeneratorOptions(groupId, eventId)
      .then((res) => {
        if (!alive) return;
        if (!res.ok) {
          setLoadError(res.error);
          return;
        }
        const o = res.options;
        setOptions(o);
        setCount(initialCount.current ?? o.defaults.count);
        setDays(o.defaults.days);
        setTeamSize(o.defaults.team_size);
        setActivity(o.defaults.activity);
        setCategories(new Set(o.categories.map((c) => c.key)));
        setKinds(new Set(o.kinds.map((k) => k.key)));
      })
      .catch((err) => alive && setLoadError(getErrorMessage(err, "Couldn't load the generator.")));
    return () => {
      alive = false;
    };
  }, [groupId, eventId]);

  const mix = preset === "custom" ? customMix : MIX_PRESETS[preset].mix;

  const encounters = useMemo(() => {
    const list = options?.encounters ?? [];
    // Bosses the clan actually does float to the top of the picker.
    return [...list].sort((a, b) => b.clan_players - a.clan_players || a.label.localeCompare(b.label));
  }, [options]);
  const encounterLabel = (key: string) => encounters.find((e) => e.key === key)?.label ?? key;

  const baseCriteria = (): TaskGeneratorCriteria => ({
    count,
    days,
    team_size: teamSize,
    activity,
    mix,
    categories: options && categories.size < options.categories.length ? [...categories] : undefined,
    kinds: options && kinds.size < options.kinds.length ? [...kinds] : undefined,
    must_include: mustInclude.length ? mustInclude : undefined,
    clan_focus: focus,
  });

  const remember = (keys: string[]) =>
    setSeen((prev) => [...prev, ...keys].slice(-SEEN_CAP));

  const generate = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await generateEventTasks(groupId, eventId, { ...baseCriteria(), seed: randomSeed() });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setRows(res.result.tasks);
        setLocked(new Set());
        remember(res.result.tasks.map((t) => t.key));
        setSummary({
          capacity: res.result.capacity_hours,
          unfilled: res.result.shortfall.unfilled ?? 0,
        });
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't generate tasks. Please try again."));
      }
    });
  };

  /** Redraw `targets` (row keys) in place, each keeping its difficulty. */
  const reroll = (targets: string[]) => {
    if (!rows || !targets.length) return;
    setError(null);
    setNotice(null);
    const keep = rows.filter((r) => !targets.includes(r.key));
    const byTier = new Map<EventTaskDifficulty, string[]>();
    for (const r of rows.filter((r) => targets.includes(r.key))) {
      byTier.set(r.difficulty, [...(byTier.get(r.difficulty) ?? []), r.key]);
    }
    startTransition(async () => {
      try {
        const replacements = new Map<string, GeneratedTask>();
        const taken = keep.map((r) => r.key);
        const exclude = [...new Set([...seen, ...rows.map((r) => r.key)])];
        for (const [tier, keys] of byTier) {
          const res = await generateEventTasks(groupId, eventId, {
            ...baseCriteria(),
            must_include: undefined,
            count: keys.length,
            only_tier: tier,
            taken_keys: [...taken, ...[...replacements.values()].map((r) => r.key)],
            exclude_keys: [...exclude, ...[...replacements.values()].map((r) => r.key)],
            seed: randomSeed(),
          });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          res.result.tasks.forEach((t, i) => {
            if (keys[i]) replacements.set(keys[i], t);
          });
        }
        const missing = targets.filter((k) => !replacements.has(k)).length;
        setRows(rows.map((r) => replacements.get(r.key) ?? r));
        remember([...replacements.values()].map((r) => r.key));
        if (missing) {
          setNotice(
            missing === targets.length
              ? "Nothing else fits those slots with these settings."
              : `${missing} slot${missing === 1 ? "" : "s"} had nothing else that fits, so ${missing === 1 ? "it was" : "they were"} kept.`,
          );
        }
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't reroll. Please try again."));
      }
    });
  };

  const toggleLock = (key: string) =>
    setLocked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const remove = (key: string) => {
    setRows((prev) => prev?.filter((r) => r.key !== key) ?? null);
    setLocked((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const unlockedKeys = rows?.filter((r) => !locked.has(r.key)).map((r) => r.key) ?? [];
  const totalHours = rows?.reduce((sum, r) => sum + r.hours, 0) ?? 0;

  const commit = () => {
    if (!rows?.length) return;
    setError(null);
    setNotice(null);
    const tasks = rows.map((r) => r.task);
    if (mode === "cells") {
      onUse?.(tasks);
      return;
    }
    startTransition(async () => {
      const res = await addGeneratedEventTasks(groupId, eventId, tasks);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onAdded?.(res.created);
      setRows(null);
      setSummary(null);
      const skipped = res.skipped.length
        ? ` Skipped ${res.skipped.length} already in this event.`
        : "";
      setNotice(`Added ${res.created.length} task${res.created.length === 1 ? "" : "s"}.${skipped}`);
    });
  };

  const toggleIn = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  return (
    <div className="border-osrs-gold/30 bg-osrs-brown-dark/30 grid gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-osrs-gold text-sm font-semibold">Fill for me</h4>
        <button
          type="button"
          onClick={onClose}
          className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm"
        >
          Close
        </button>
      </div>
      <p className="text-osrs-parchment-dark/60 text-xs">
        Tell us a little about the event and we&apos;ll build a balanced set of tasks sized to
        your teams. Lock the ones you like, reroll the rest, then{" "}
        {mode === "cells" ? "put them on the board" : "add them"}. Everything stays editable.
      </p>

      {loadError && <p className="text-osrs-red text-xs">{loadError}</p>}
      {!options && !loadError && (
        <p className="text-osrs-parchment-dark/50 text-xs">Loading…</p>
      )}

      {options && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="grid gap-1 text-xs">
              <span className="text-osrs-parchment-dark/70">Tasks</span>
              <input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                className={field}
              />
            </label>
            <label className="grid gap-1 text-xs">
              <span className="text-osrs-parchment-dark/70">Event length (days)</span>
              <input
                type="number"
                min={0.5}
                max={120}
                step={0.5}
                value={days}
                onChange={(e) => setDays(Math.max(0.5, Math.min(120, Number(e.target.value) || 1)))}
                className={field}
              />
            </label>
            <label className="grid gap-1 text-xs">
              <span className="text-osrs-parchment-dark/70">Players per team</span>
              <input
                type="number"
                min={1}
                max={500}
                value={teamSize}
                onChange={(e) =>
                  setTeamSize(Math.max(1, Math.min(500, Math.round(Number(e.target.value) || 1))))
                }
                className={field}
              />
            </label>
            <label className="grid gap-1 text-xs">
              <span className="text-osrs-parchment-dark/70">How active</span>
              <select
                value={activity}
                onChange={(e) => setActivity(e.target.value as TaskGeneratorActivity)}
                className={field}
              >
                {(Object.keys(ACTIVITY_LABELS) as TaskGeneratorActivity[]).map((a) => (
                  <option key={a} value={a}>
                    {ACTIVITY_LABELS[a]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-1.5">
            <span className="text-osrs-parchment-dark/70 text-xs">Difficulty</span>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(MIX_PRESETS) as (keyof typeof MIX_PRESETS)[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPreset(key)}
                  className={preset === key ? chipOn : chipOff}
                >
                  {MIX_PRESETS[key].label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  if (preset !== "custom") setCustomMix(mix);
                  setPreset("custom");
                }}
                className={preset === "custom" ? chipOn : chipOff}
              >
                Custom
              </button>
            </div>
            {preset === "custom" && (
              <div className="flex flex-wrap gap-2">
                {EVENT_TASK_DIFFICULTIES.map((d) => (
                  <label key={d} className="flex items-center gap-1 text-xs">
                    <span className="text-osrs-parchment-dark/70">{TASK_DIFFICULTY_LABELS[d]}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={customMix[d]}
                      onChange={(e) =>
                        setCustomMix((prev) => ({
                          ...prev,
                          [d]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                        }))
                      }
                      className={`${field} w-16`}
                      aria-label={`${TASK_DIFFICULTY_LABELS[d]} share`}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          {options.activity_available && (
            <label className="grid gap-1 text-xs sm:max-w-sm">
              <span className="text-osrs-parchment-dark/70">Lean towards</span>
              <select
                value={focus}
                onChange={(e) => setFocus(e.target.value as TaskGeneratorClanFocus)}
                className={field}
              >
                {(Object.keys(FOCUS_LABELS) as TaskGeneratorClanFocus[]).map((f) => (
                  <option key={f} value={f}>
                    {FOCUS_LABELS[f]}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright self-start text-xs"
            aria-expanded={showMore}
          >
            {showMore ? "Fewer options" : "More options: content, task types, must-have bosses"}
          </button>

          {showMore && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <span className="text-osrs-parchment-dark/70 text-xs">Content</span>
                <div className="flex flex-wrap gap-1.5">
                  {options.categories.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => toggleIn(categories, c.key, setCategories)}
                      className={categories.has(c.key) ? chipOn : chipOff}
                      aria-pressed={categories.has(c.key)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-1.5">
                <span className="text-osrs-parchment-dark/70 text-xs">Task types</span>
                <div className="flex flex-wrap gap-1.5">
                  {options.kinds.map((k) => (
                    <button
                      key={k.key}
                      type="button"
                      onClick={() => toggleIn(kinds, k.key, setKinds)}
                      className={kinds.has(k.key) ? chipOn : chipOff}
                      aria-pressed={kinds.has(k.key)}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-1.5">
                <span className="text-osrs-parchment-dark/70 text-xs">Always include</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {mustInclude.map((key) => (
                    <span key={key} className={chipOn}>
                      {encounterLabel(key)}
                      <button
                        type="button"
                        onClick={() => setMustInclude((prev) => prev.filter((k) => k !== key))}
                        className="ml-1.5 opacity-70 hover:opacity-100"
                        aria-label={`Remove ${encounterLabel(key)}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <select
                    value=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v && !mustInclude.includes(v)) setMustInclude((prev) => [...prev, v]);
                    }}
                    className={field}
                    aria-label="Add a boss to always include"
                  >
                    <option value="">Add a boss…</option>
                    {encounters
                      .filter((e) => !mustInclude.includes(e.key))
                      .map((e) => (
                        <option key={e.key} value={e.key}>
                          {e.label}
                          {e.clan_players ? ` (${e.clan_players} members active)` : ""}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={generate}
              disabled={pending || categories.size === 0 || kinds.size === 0}
              className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            >
              {pending && !rows ? "Building…" : rows ? "Start over" : "Generate tasks"}
            </button>
            {(categories.size === 0 || kinds.size === 0) && (
              <span className="text-osrs-parchment-dark/60 text-xs">
                Pick at least one content area and task type.
              </span>
            )}
          </div>
        </>
      )}

      {error && <p className="text-osrs-red text-xs">{error}</p>}
      {notice && <p className="text-osrs-green text-xs">{notice}</p>}

      {rows && (
        <div className="grid gap-2">
          {summary && (
            <p className="text-osrs-parchment-dark/70 text-xs">
              {rows.length} task{rows.length === 1 ? "" : "s"}, about {formatHours(totalHours).slice(1)}{" "}
              of play for a team with roughly {Math.round(summary.capacity)} h to spend.
              {summary.unfilled > 0 &&
                ` ${summary.unfilled} slot${summary.unfilled === 1 ? "" : "s"} couldn't be filled with these settings; try more content or task types.`}
            </p>
          )}
          <ul className="divide-osrs-bronze/15 border-osrs-bronze/20 max-h-96 divide-y overflow-y-auto rounded border">
            {rows.map((r) => {
              const isLocked = locked.has(r.key);
              return (
                <li
                  key={r.key}
                  className={`flex items-center justify-between gap-2 px-3 py-1.5 text-sm ${isLocked ? "bg-osrs-gold/5" : ""}`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`shrink-0 rounded border px-1 text-[10px] uppercase ${TIER_BADGE[r.difficulty]}`}
                    >
                      {TASK_DIFFICULTY_LABELS[r.difficulty]}
                    </span>
                    <span className="min-w-0">
                      <span className="text-osrs-parchment/90">{r.task.label}</span>
                      <span
                        className="text-osrs-parchment-dark/50 ml-2 text-xs"
                        title={r.estimated ? `${r.detail} (rate is our estimate)` : r.detail}
                      >
                        {formatHours(r.hours)}
                        {r.estimated ? " est." : ""}
                      </span>
                    </span>
                  </div>
                  <span className="flex shrink-0 items-center gap-0.5">
                    <span className="text-osrs-parchment-dark/50 mr-1 text-xs">
                      {r.task.points} pts
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleLock(r.key)}
                      className={smallBtn}
                      aria-pressed={isLocked}
                      title={isLocked ? "Unlock" : "Keep this one when rerolling"}
                    >
                      {isLocked ? "Locked" : "Lock"}
                    </button>
                    <button
                      type="button"
                      onClick={() => reroll([r.key])}
                      disabled={pending || isLocked}
                      className={smallBtn}
                      title="Swap for another task of the same difficulty"
                    >
                      Reroll
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(r.key)}
                      disabled={pending}
                      className={smallBtn}
                      aria-label={`Remove ${r.task.label}`}
                    >
                      ×
                    </button>
                  </span>
                </li>
              );
            })}
            {!rows.length && (
              <li className="text-osrs-parchment-dark/50 px-3 py-2 text-xs">
                Nothing fits these settings. Try more content, more task types, or a longer event.
              </li>
            )}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => reroll(unlockedKeys)}
              disabled={pending || unlockedKeys.length === 0}
              className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border px-3 py-1.5 text-xs disabled:opacity-40"
            >
              {locked.size ? `Reroll ${unlockedKeys.length} unlocked` : "Reroll all"}
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={pending || rows.length === 0}
              className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            >
              {pending
                ? "Working…"
                : mode === "cells"
                  ? `Put ${rows.length} on the board`
                  : `Add ${rows.length} task${rows.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
