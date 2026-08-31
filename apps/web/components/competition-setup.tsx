"use client";

/** SOTW/BOTW competition settings (web105a) — the wizard's Competition step
 * and the manager's Competition tab share this. Metric / ranking / bonus
 * rules / participation are CONTROLLED (`value`/`onChange`; the wizard's
 * Continue commits them via PATCH {competition}); the WOM link/create actions
 * save the draft first (the backend validates metric consistency), then act
 * immediately through their own endpoints. Locked read-only once the event
 * is live — competition settings freeze at activation. */

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import type {
  CompetitionEventKind,
  EventCompetitionInput,
  EventDetail,
  EventMetaEntry,
  EventTask,
  EventTaskInput,
  WomCompetitionPreview,
  WomReadiness,
} from "@droptracker/api-types";
import { EVENT_TASK_TYPES } from "@droptracker/api-types";
import {
  bonusRuleIcon,
  bonusRuleSentence,
  COMPETITION_SKILLS,
  formatTimeMs,
  parseTimeToMs,
  rateSentence,
  WOM_LINK_PROBLEM_COPY,
} from "@/lib/competition";
import { EventTaskForm } from "@/components/event-task-form";
import {
  createWomCompetitionForEvent,
  fetchWomReadiness,
  linkWomCompetition,
  previewWomCompetition,
  searchEventNpcs,
  unlinkWomCompetition,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";

const field =
  "w-full rounded border border-osrs-bronze/40 bg-osrs-brown-dark/60 px-2.5 py-1.5 text-sm text-osrs-parchment placeholder:text-osrs-parchment-dark/40 focus:border-osrs-gold focus:outline-none";

type BonusRuleInput = NonNullable<EventCompetitionInput["bonus_rules"]>[number];
type EmbeddedTask = NonNullable<BonusRuleInput["task"]>;

/** Which task types a bonus rule may embed, per race kind.
 *
 * A SKILL race is deliberately short: nothing in the game says which skill an
 * item came from, so a drop bonus on a Skill of the Week could only ever mean
 * "from anywhere". A pet and a level are the two things genuinely scopable to
 * one skill — the backend enforces the same list and 422s the rest.
 */
const BOSS_BONUS_TASK_TYPES = [
  "item_collection",
  "loot_value",
  "pb_target",
  "pet_collection",
  "ca_target",
] as const;
const SKILL_BONUS_TASK_TYPES = ["pet_collection", "skill_target"] as const;

/** The "+ …" buttons, in the order they read as a menu. */
const TASK_BONUS_PRESETS: {
  type: EmbeddedTask["type"];
  label: string;
  help: string;
  bosses: boolean;
  skills: boolean;
}[] = [
  {
    type: "item_collection",
    label: "+ Drop bonus",
    help: "One drop, a full set, an either-or, or a weighted pool — scoped to the raced boss.",
    bosses: true,
    skills: false,
  },
  {
    type: "loot_value",
    label: "+ Loot value bonus",
    help: "GP of loot from the raced boss.",
    bosses: true,
    skills: false,
  },
  {
    type: "ca_target",
    label: "+ Combat achievement bonus",
    help: "Combat achievements at the raced boss, optionally by tier.",
    bosses: true,
    skills: false,
  },
  {
    type: "pet_collection",
    label: "+ Pet task bonus",
    help: "A pet, with the repeat and quantity options of a full task.",
    bosses: true,
    skills: true,
  },
  {
    type: "skill_target",
    label: "+ Level bonus",
    help: "Reach a level in the raced skill.",
    bosses: false,
    skills: true,
  },
];

/** A rule's embedded criteria → the shape EventTaskForm pre-fills from. */
function taskFromRule(rule: BonusRuleInput, label: string): EventTask {
  const task = rule.task;
  return {
    id: -1,
    type: (task?.type ?? "item_collection") as EventTask["type"],
    label,
    target: task?.target ?? null,
    target_value: task?.target_value ?? null,
    points: 0,
    requires_confirmation: false,
    visibility: "private",
    difficulty: null,
    config: task?.config ?? null,
  } as EventTask;
}

/** EventTaskForm's draft output → the rule's embedded criteria. The form's own
 * `points` is the TASK's points, which a bonus rule doesn't have — the bonus
 * award is the rule's `points`, edited beside it. */
function ruleTaskFromDraft(input: EventTaskInput): EmbeddedTask {
  return {
    type: input.type as EmbeddedTask["type"],
    target: input.target ?? undefined,
    target_value: input.target_value ?? undefined,
    config: input.config ?? null,
  };
}

export function CompetitionSetup({
  kind,
  groupId,
  event,
  value,
  onChange,
  onSaveDraft,
  onEventUpdated,
  disabled = false,
}: {
  kind: CompetitionEventKind;
  groupId: number | null;
  /** The draft detail (null before the draft exists — metric editing only). */
  event: EventDetail | null;
  value: EventCompetitionInput;
  onChange: (v: EventCompetitionInput) => void;
  /** Persist `value` (the wizard's PATCH) — the WOM link/create flows call it
   * first so the backend sees the metric they must match. */
  onSaveDraft: (v: EventCompetitionInput) => Promise<EventDetail | null>;
  onEventUpdated: (d: EventDetail) => void;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const wom = event?.competition?.wom ?? null;
  const sourceMode = event?.competition?.source_mode ?? "hosted";
  const linked = Boolean(wom);
  const isBoss = kind === "botw";

  const patch = (p: Partial<EventCompetitionInput>) => onChange({ ...value, ...p });

  // ---- WOM readiness (create-on-WOM gating) -------------------------------
  const [readiness, setReadiness] = useState<WomReadiness | null>(null);
  useEffect(() => {
    if (groupId == null) return;
    let cancelled = false;
    fetchWomReadiness(groupId)
      .then((r) => !cancelled && setReadiness(r))
      .catch(() => !cancelled && setReadiness(null));
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  // ---- botw NPC search ----------------------------------------------------
  const [npcQuery, setNpcQuery] = useState("");
  const [npcResults, setNpcResults] = useState<EventMetaEntry[]>([]);
  const npcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isBoss || npcQuery.trim().length < 2) {
      setNpcResults([]);
      return;
    }
    if (npcTimer.current) clearTimeout(npcTimer.current);
    npcTimer.current = setTimeout(() => {
      searchEventNpcs(groupId, npcQuery)
        .then(setNpcResults)
        .catch(() => setNpcResults([]));
    }, 250);
    return () => {
      if (npcTimer.current) clearTimeout(npcTimer.current);
    };
  }, [npcQuery, isBoss, groupId]);

  const npcs = value.npcs ?? [];
  const addNpc = (name: string) => {
    if (npcs.includes(name) || npcs.length >= 10) return;
    patch({ npcs: [...npcs, name] });
    setNpcQuery("");
    setNpcResults([]);
  };
  const removeNpc = (name: string) => {
    patch({
      npcs: npcs.filter((n) => n !== name),
      // Drop the bonus rules that named this boss specifically — a kill-time
      // tier, or an embedded task pinned to it (a pb_target). Everything else
      // is scoped by the race as a whole and is re-scoped on save.
      bonus_rules: (value.bonus_rules ?? []).filter((r) => {
        if (r.type === "time_under") return r.npc !== name;
        if (r.type === "task") return (r.task?.target ?? null) !== name;
        return true;
      }),
    });
  };

  // ---- WOM link flow ------------------------------------------------------
  const [womQuery, setWomQuery] = useState("");
  const [preview, setPreview] = useState<WomCompetitionPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const onValidateWom = () =>
    startTransition(async () => {
      setPreviewError(null);
      setPreview(null);
      const res = await previewWomCompetition(groupId, womQuery, kind);
      if (!res.ok) {
        setPreviewError(res.message);
        return;
      }
      setPreview(res.preview);
      if (!res.preview.linkable) {
        const first = res.preview.problems[0];
        setPreviewError(
          (first && WOM_LINK_PROBLEM_COPY[first]) ??
            "This competition can't back the event.",
        );
      } else if (res.preview.mappable) {
        // Pre-fill the metric from the competition so link-first flows don't
        // bounce off the backend's metric-consistency check.
        const m = res.preview.mappable;
        if (kind === "sotw" && m.skill) patch({ metric: { key: m.skill } });
        if (kind === "botw" && m.npc && !npcs.includes(m.npc)) patch({ npcs: [m.npc] });
      }
    });

  const onLink = () =>
    startTransition(async () => {
      if (!event || !preview) return;
      setError(null);
      const saved = await onSaveDraft(value);
      if (!saved) return;
      const res = await linkWomCompetition(groupId, event.id, preview.id);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onEventUpdated(res.event);
      setPreview(null);
      setWomQuery("");
    });

  const onUnlink = () =>
    startTransition(async () => {
      if (!event) return;
      setError(null);
      const res = await unlinkWomCompetition(groupId, event.id);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onEventUpdated(res.event);
    });

  const onCreateOnWom = () =>
    startTransition(async () => {
      if (!event) return;
      setError(null);
      const saved = await onSaveDraft(value);
      if (!saved) return;
      const res = await createWomCompetitionForEvent(groupId, event.id);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onEventUpdated(res.event);
    });

  // ---- Bonus rules --------------------------------------------------------
  const rules = value.bonus_rules ?? [];
  const hasPetRule = rules.some((r) => r.type === "pet");
  const setRule = (idx: number, rule: BonusRuleInput) =>
    patch({ bonus_rules: rules.map((r, i) => (i === idx ? rule : r)) });
  const removeRule = (idx: number) => {
    patch({ bonus_rules: rules.filter((_r, i) => i !== idx) });
    setEditing(null);
  };
  const ruleCap = 12;

  // Which rule's criteria are open in the embedded task builder. `-1` means
  // "a new rule being built" — it isn't added to the list until the form is
  // submitted, so cancelling leaves no half-built rule behind.
  const [editing, setEditing] = useState<number | null>(null);
  const [draftType, setDraftType] = useState<EmbeddedTask["type"]>("item_collection");
  const bonusTaskTypes = isBoss ? BOSS_BONUS_TASK_TYPES : SKILL_BONUS_TASK_TYPES;
  const omitTaskTypes = EVENT_TASK_TYPES.filter(
    (t) => !(bonusTaskTypes as readonly string[]).includes(t),
  ) as EventTask["type"][];

  const startTaskRule = (type: EmbeddedTask["type"]) => {
    setDraftType(type);
    setEditing(-1);
  };
  const commitTaskRule = (idx: number, input: EventTaskInput) => {
    const task = ruleTaskFromDraft(input);
    const label = input.label?.trim() || undefined;
    if (idx < 0) {
      patch({
        bonus_rules: [
          ...rules,
          { type: "task", points: 25, max_awards: 1, task, ...(label ? { label } : {}) },
        ],
      });
    } else {
      setRule(idx, { ...rules[idx]!, task, ...(label ? { label } : {}) });
    }
    setEditing(null);
  };

  const rankingMode = value.ranking?.mode ?? "gained";
  const participation = value.participation ?? "whole_clan";
  const skillKey = value.metric?.key ?? value.skill ?? "";

  return (
    <div className="max-w-2xl space-y-5">
      {error && <p className="text-osrs-red text-sm">{error}</p>}
      {disabled && (
        <p className="border-osrs-bronze/30 bg-osrs-brown-dark/40 text-osrs-parchment-dark/70 rounded border p-2.5 text-xs">
          Competition settings are locked while the race runs — you can still
          edit the end time, description and Discord messages.
        </p>
      )}

      {/* ---- Metric ------------------------------------------------------- */}
      <fieldset className="space-y-2" disabled={disabled || linked}>
        <legend className="text-osrs-gold text-sm font-semibold">
          {isBoss ? "Which boss?" : "Which skill?"}
        </legend>
        {linked && (
          <p className="text-osrs-parchment-dark/50 text-xs">
            The metric follows the linked WiseOldMan competition — unlink to change it.
          </p>
        )}
        {!isBoss && (
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6" role="radiogroup">
            {COMPETITION_SKILLS.map((s) => {
              const selected = skillKey === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => patch({ metric: { key: s.key } })}
                  className={`flex items-center gap-1.5 rounded border px-2 py-1.5 text-xs ${
                    selected
                      ? "border-osrs-gold bg-osrs-brown-dark/60 text-osrs-parchment"
                      : "border-osrs-bronze/30 bg-osrs-brown-dark/30 text-osrs-parchment-dark/80 hover:border-osrs-gold/60"
                  }`}
                >
                  <Image
                    src={`/img/metrics/${s.key}.png`}
                    alt=""
                    width={16}
                    height={16}
                    unoptimized
                  />
                  {s.display}
                </button>
              );
            })}
          </div>
        )}
        {isBoss && (
          <div className="space-y-2">
            {npcs.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {npcs.map((n) => (
                  <li
                    key={n}
                    className="border-osrs-gold/60 bg-osrs-brown-dark/60 text-osrs-parchment flex items-center gap-1.5 rounded border px-2 py-1 text-xs"
                  >
                    {n}
                    {!disabled && !linked && (
                      <button
                        type="button"
                        onClick={() => removeNpc(n)}
                        aria-label={`Remove ${n}`}
                        className="text-osrs-parchment-dark/60 hover:text-osrs-red"
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <input
              value={npcQuery}
              onChange={(e) => setNpcQuery(e.target.value)}
              placeholder={npcs.length ? "Add another boss…" : "Search a boss — e.g. Zulrah"}
              className={field}
            />
            {npcResults.length > 0 && (
              <ul className="border-osrs-bronze/30 bg-osrs-brown-dark/80 max-h-56 overflow-y-auto rounded border text-sm">
                {npcResults.map((r) => (
                  <li key={`${r.id}-${r.name}`}>
                    <button
                      type="button"
                      onClick={() => addNpc(r.name)}
                      className="hover:bg-osrs-brown-dark flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left"
                    >
                      <span className="text-osrs-parchment">{r.name}</span>
                      {r.wom_metric == null && (
                        <span className="text-osrs-gold-bright/80 text-[10px] uppercase">
                          plugin-only tracking
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-osrs-parchment-dark/50 text-xs">
              List several bosses and a kill of any of them counts toward the one race.
              A boss that isn&apos;t on the WiseOldMan hiscores still tracks through the
              RuneLite plugin — but only single, WOM-ranked bosses can link or create a
              WOM competition.
            </p>
          </div>
        )}
      </fieldset>

      {/* ---- Source ------------------------------------------------------- */}
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-osrs-gold text-sm font-semibold">Where does it run?</legend>
        {linked ? (
          <div className="border-osrs-bronze/30 bg-osrs-brown-dark/40 space-y-1.5 rounded border p-3 text-sm">
            <p className="text-osrs-parchment">
              {sourceMode === "created" ? "Created on WiseOldMan" : "Mirrors WiseOldMan"} —{" "}
              <a
                href={wom!.url}
                target="_blank"
                rel="noreferrer"
                className="text-osrs-gold-bright hover:underline"
              >
                {wom!.title ?? `competition #${wom!.competition_id}`} ↗
              </a>
            </p>
            {wom!.sync_error ? (
              <p className="text-osrs-red text-xs">Sync problem: {wom!.sync_error}</p>
            ) : (
              <p className="text-osrs-parchment-dark/60 text-xs">
                Standings and dates sync from WiseOldMan every few minutes
                {sourceMode === "created" ? "; edits here mirror back out" : ""}.
              </p>
            )}
            {!disabled && event?.status === "draft" && (
              <button
                type="button"
                onClick={onUnlink}
                disabled={pending}
                className="text-osrs-parchment-dark/70 hover:text-osrs-red text-xs underline"
              >
                {sourceMode === "created"
                  ? "Delete the WOM competition & run DropTracker-hosted"
                  : "Unlink & run DropTracker-hosted"}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-osrs-parchment-dark/60 text-xs">
              DropTracker-hosted by default — plugin data tracks the race live, topped up
              from the WiseOldMan hiscores. Optionally mirror an existing WOM competition,
              or have DropTracker create one for you.
            </p>
            <div className="space-y-1.5">
              <span className="text-osrs-parchment-dark/70 block text-xs">
                Link an existing WiseOldMan competition
              </span>
              <div className="flex gap-2">
                <input
                  value={womQuery}
                  onChange={(e) => setWomQuery(e.target.value)}
                  placeholder="Paste the wiseoldman.net competition link or its number"
                  className={field}
                />
                <button
                  type="button"
                  onClick={onValidateWom}
                  disabled={pending || !womQuery.trim()}
                  className="border-osrs-bronze/50 text-osrs-parchment hover:border-osrs-gold shrink-0 rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Validate
                </button>
              </div>
              {previewError && <p className="text-osrs-red text-xs">{previewError}</p>}
              {preview && (
                <div className="border-osrs-bronze/30 bg-osrs-brown-dark/40 space-y-1 rounded border p-2.5 text-xs">
                  <p className="text-osrs-parchment text-sm">{preview.title}</p>
                  <p className="text-osrs-parchment-dark/70">
                    {preview.metric} · {preview.participant_count ?? "?"} participants
                    {preview.group_matches === false && (
                      <span className="text-osrs-gold-bright"> · different WOM group</span>
                    )}
                  </p>
                  {preview.starts_at && preview.ends_at && (
                    <p className="text-osrs-parchment-dark/60">
                      {new Date(preview.starts_at * 1000).toLocaleString()} →{" "}
                      {new Date(preview.ends_at * 1000).toLocaleString()}
                      <span className="text-osrs-parchment-dark/50">
                        {" "}
                        — the event adopts these dates
                      </span>
                    </p>
                  )}
                  {preview.starts_at && preview.starts_at < Date.now() / 1000 && (
                    <p className="text-osrs-gold-bright/90">
                      Already running — standings will include gains since it started.
                    </p>
                  )}
                  {preview.linkable && event && (
                    <button
                      type="button"
                      onClick={onLink}
                      disabled={pending}
                      className="border-osrs-gold text-osrs-gold-bright hover:bg-osrs-brown-dark mt-1 rounded border px-3 py-1 text-sm"
                    >
                      Link this competition
                    </button>
                  )}
                  {preview.linkable && !event && (
                    <p className="text-osrs-parchment-dark/60">
                      Finish the Schedule step first — linking needs the draft to exist.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-osrs-parchment-dark/70 block text-xs">
                …or create it on WiseOldMan too
              </span>
              {readiness?.can_create ? (
                <button
                  type="button"
                  onClick={onCreateOnWom}
                  disabled={pending || disabled || !event}
                  className="border-osrs-bronze/50 text-osrs-parchment hover:border-osrs-gold rounded border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Create the WOM competition
                </button>
              ) : (
                <p className="text-osrs-parchment-dark/50 text-xs">
                  {readiness?.reason === "no_code"
                    ? "Add your WiseOldMan group's verification code in Group settings → Integrations to let DropTracker create the competition."
                    : "Link your WiseOldMan group (and save its verification code) in Group settings → Integrations to let DropTracker create the competition."}
                </p>
              )}
              {readiness?.can_create && (
                <p className="text-osrs-parchment-dark/50 text-xs">
                  One click makes the matching WOM competition, keeps it in sync, and
                  deletes it if you discard the draft. Single WOM-ranked boss / one skill
                  only.
                </p>
              )}
            </div>
          </div>
        )}
      </fieldset>

      {/* ---- Ranking ------------------------------------------------------ */}
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-osrs-gold text-sm font-semibold">Rank by</legend>
        <div className="space-y-2" role="radiogroup">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="comp-ranking"
              checked={rankingMode === "gained"}
              onChange={() => patch({ ranking: { mode: "gained" } })}
              className="mt-0.5"
            />
            <span>
              {isBoss ? "KC gained" : "XP gained"} (WiseOldMan-style)
              <span className="text-osrs-parchment-dark/50 block text-xs">
                The leaderboard is raw gained — exactly what WOM would show. Bonus points
                appear as their own column and mini-board.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="comp-ranking"
              checked={rankingMode === "points"}
              onChange={() =>
                patch({
                  ranking: {
                    mode: "points",
                    gained_per_point: value.ranking?.gained_per_point ?? (isBoss ? 1 : 10_000),
                  },
                })
              }
              className="mt-0.5"
            />
            <span>
              Combined points
              <span className="text-osrs-parchment-dark/50 block text-xs">
                Gained converts to points at your rate and bonus points stack on top — one
                combined ranking.
              </span>
            </span>
          </label>
        </div>
        {rankingMode === "points" && (
          <label className="block pl-6 text-sm">
            <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
              {rateSentence(value.ranking?.gained_per_point, isBoss ? "boss" : "skill")}
            </span>
            <span className="flex items-center gap-2 text-xs">
              Every
              <input
                type="number"
                min={1}
                value={value.ranking?.gained_per_point ?? (isBoss ? 1 : 10_000)}
                onChange={(e) =>
                  patch({
                    ranking: {
                      mode: "points",
                      gained_per_point: Math.max(parseInt(e.target.value || "1", 10) || 1, 1),
                    },
                  })
                }
                className={`${field} w-28`}
              />
              {isBoss ? "kills" : "XP"} = 1 pt
            </span>
          </label>
        )}
      </fieldset>

      {/* ---- Bonus rules -------------------------------------------------- */}
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-osrs-gold text-sm font-semibold">Bonus points</legend>
        <p className="text-osrs-parchment-dark/50 text-xs">
          The DropTracker extras WiseOldMan can&apos;t do — awarded live from plugin
          submissions, with the proof attached.
        </p>
        {rules.length > 0 && (
          <ul className="space-y-2">
            {rules.map((r, i) => (
              <li
                key={i}
                className="border-osrs-bronze/30 bg-osrs-brown-dark/40 space-y-1.5 rounded border p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-osrs-parchment flex items-start gap-1.5 text-sm">
                    <span aria-hidden>{bonusRuleIcon(r.type)}</span>
                    <span>{bonusRuleSentence(r)}</span>
                  </span>
                  {!disabled && (
                    <span className="flex shrink-0 items-center gap-2">
                      {r.type === "task" && (
                        <button
                          type="button"
                          onClick={() => setEditing(editing === i ? null : i)}
                          className="text-osrs-gold-bright text-xs hover:underline"
                        >
                          {editing === i ? "Close" : "Edit criteria"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeRule(i)}
                        className="text-osrs-parchment-dark/60 hover:text-osrs-red text-xs"
                      >
                        Remove
                      </button>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5">
                    Points
                    <input
                      type="number"
                      min={1}
                      value={r.points}
                      onChange={(e) =>
                        setRule(i, {
                          ...r,
                          points: Math.max(parseInt(e.target.value || "1", 10) || 1, 1),
                        })
                      }
                      className={`${field} w-20`}
                    />
                  </label>
                  <label className="flex items-center gap-1.5">
                    Max per player
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={r.max_awards ?? 1}
                      onChange={(e) =>
                        setRule(i, {
                          ...r,
                          max_awards: Math.min(
                            Math.max(parseInt(e.target.value || "1", 10) || 1, 1),
                            100,
                          ),
                        })
                      }
                      className={`${field} w-16`}
                    />
                  </label>
                  {r.type === "time_under" && (
                    <>
                      {npcs.length > 1 && (
                        <label className="flex items-center gap-1.5">
                          Boss
                          <select
                            value={r.npc ?? npcs[0]}
                            onChange={(e) => setRule(i, { ...r, npc: e.target.value })}
                            className={`${field} w-40`}
                          >
                            {npcs.map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label className="flex items-center gap-1.5">
                        Kill under
                        <TimeInput
                          ms={r.threshold_ms ?? 60_000}
                          onChange={(ms) => setRule(i, { ...r, threshold_ms: ms })}
                        />
                      </label>
                    </>
                  )}
                  {r.type === "milestone" && (
                    <label className="flex items-center gap-1.5">
                      Every
                      <input
                        type="number"
                        min={1}
                        value={r.step ?? (isBoss ? 100 : 1_000_000)}
                        onChange={(e) =>
                          setRule(i, {
                            ...r,
                            step: Math.max(parseInt(e.target.value || "1", 10) || 1, 1),
                          })
                        }
                        className={`${field} w-28`}
                      />
                      {isBoss ? "kills" : "XP"}
                    </label>
                  )}
                  {r.type === "task" && (
                    <label className="flex items-center gap-1.5">
                      Name it
                      <input
                        type="text"
                        maxLength={120}
                        placeholder="optional"
                        value={r.label ?? ""}
                        onChange={(e) =>
                          setRule(i, { ...r, label: e.target.value || undefined })
                        }
                        className={`${field} w-56`}
                      />
                    </label>
                  )}
                </div>
                {r.type === "task" && editing === i && !disabled && (
                  <div className="border-osrs-bronze/30 mt-2 border-t pt-2">
                    <p className="text-osrs-parchment-dark/50 mb-2 text-xs">
                      {isBoss
                        ? "Anything the task builder can express. The race's boss is added to the source restriction when you save, so these only count there."
                        : "Scoped to the raced skill when you save."}
                    </p>
                    <EventTaskForm
                      groupId={groupId}
                      eventId={event?.id ?? 0}
                      initial={taskFromRule(r, r.label ?? "Bonus")}
                      onDraftSubmit={(input) => commitTaskRule(i, input)}
                      onCancel={() => setEditing(null)}
                      omitTypes={omitTaskTypes}
                      hideDifficulty
                      submitLabel="Update criteria"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {editing === -1 && !disabled && (
          <div className="border-osrs-bronze/30 bg-osrs-brown-dark/40 space-y-2 rounded border p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-osrs-gold text-sm font-semibold">New bonus</span>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-osrs-parchment-dark/60 hover:text-osrs-red text-xs"
              >
                Cancel
              </button>
            </div>
            <EventTaskForm
              key={draftType}
              groupId={groupId}
              eventId={event?.id ?? 0}
              initial={
                {
                  id: -1,
                  type: draftType,
                  label: "",
                  target: null,
                  target_value: null,
                  points: 0,
                  requires_confirmation: false,
                  visibility: "private",
                  difficulty: null,
                  config: null,
                } as EventTask
              }
              onDraftSubmit={(input) => commitTaskRule(-1, input)}
              onCancel={() => setEditing(null)}
              omitTypes={omitTaskTypes}
              hideDifficulty
              submitLabel="Add bonus"
            />
          </div>
        )}
        {!disabled && (
          <div className="flex flex-wrap gap-2">
            {!hasPetRule && (
              <button
                type="button"
                onClick={() =>
                  patch({
                    bonus_rules: [
                      ...rules,
                      { type: "pet", points: isBoss ? 100 : 50, max_awards: 1 },
                    ],
                  })
                }
                className="border-osrs-bronze/50 text-osrs-parchment hover:border-osrs-gold rounded border px-3 py-1.5 text-xs"
              >
                + Pet bonus
              </button>
            )}
            {isBoss && npcs.length > 0 && rules.length < ruleCap && (
              <button
                type="button"
                onClick={() =>
                  patch({
                    bonus_rules: [
                      ...rules,
                      {
                        type: "time_under",
                        points: 5,
                        max_awards: 3,
                        npc: npcs[0],
                        threshold_ms: 60_000,
                      },
                    ],
                  })
                }
                className="border-osrs-bronze/50 text-osrs-parchment hover:border-osrs-gold rounded border px-3 py-1.5 text-xs"
              >
                + Fast-kill bonus
              </button>
            )}
            {rules.length < ruleCap && (
              <button
                type="button"
                onClick={() =>
                  patch({
                    bonus_rules: [
                      ...rules,
                      {
                        type: "milestone",
                        points: 10,
                        max_awards: 20,
                        step: isBoss ? 100 : 1_000_000,
                      },
                    ],
                  })
                }
                title={
                  isBoss
                    ? "Points every N kills, on top of the race itself."
                    : "Points every N XP, on top of the race itself."
                }
                className="border-osrs-bronze/50 text-osrs-parchment hover:border-osrs-gold rounded border px-3 py-1.5 text-xs"
              >
                + Milestone bonus
              </button>
            )}
            {TASK_BONUS_PRESETS.filter((p) => (isBoss ? p.bosses : p.skills)).map((preset) => (
              <button
                key={preset.type}
                type="button"
                disabled={rules.length >= ruleCap || (isBoss && npcs.length === 0)}
                onClick={() => startTaskRule(preset.type)}
                title={preset.help}
                className="border-osrs-bronze/50 text-osrs-parchment hover:border-osrs-gold rounded border px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
        {isBoss && npcs.length === 0 && (
          <p className="text-osrs-parchment-dark/40 text-xs">
            Pick the boss first — bonus criteria are scoped to it.
          </p>
        )}
        {!isBoss && !hasPetRule && (
          <p className="text-osrs-parchment-dark/40 text-xs">
            The pet bonus pays for the skill&apos;s skilling pet (when it has one).
            Skills without one can use an XP milestone or a level goal instead.
          </p>
        )}
        {!isBoss && (
          <p className="text-osrs-parchment-dark/40 text-xs">
            A Skill of the Week can&apos;t pay for drops: nothing in the game says which
            skill an item came from, so a drop bonus would count from anywhere.
          </p>
        )}
      </fieldset>

      {/* ---- Participation ------------------------------------------------ */}
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-osrs-gold text-sm font-semibold">Who competes?</legend>
        <div className="space-y-2" role="radiogroup">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="comp-participation"
              checked={participation === "whole_clan"}
              onChange={() => patch({ participation: "whole_clan" })}
              disabled={groupId == null}
              className="mt-0.5"
            />
            <span>
              Whole clan (automatic)
              <span className="text-osrs-parchment-dark/50 block text-xs">
                Every clan member is entered automatically — no sign-up needed, and the
                roster follows the clan as people join or leave.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="comp-participation"
              checked={participation === "signup"}
              onChange={() => patch({ participation: "signup" })}
              className="mt-0.5"
            />
            <span>
              Players sign up
              <span className="text-osrs-parchment-dark/50 block text-xs">
                Players opt in from the event page or the Discord sign-up button.
              </span>
            </span>
          </label>
        </div>
      </fieldset>
    </div>
  );
}

/** mm:ss(.d) time field that round-trips ms (tick precision). */
function TimeInput({ ms, onChange }: { ms: number; onChange: (ms: number) => void }) {
  const [text, setText] = useState(formatTimeMs(ms));
  useEffect(() => setText(formatTimeMs(ms)), [ms]);
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const parsed = parseTimeToMs(text);
        if (parsed != null && parsed >= 600) onChange(parsed);
        else setText(formatTimeMs(ms));
      }}
      placeholder="1:00"
      className={`${field} w-20`}
    />
  );
}
