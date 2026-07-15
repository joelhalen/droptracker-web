"use client";

/**
 * Rich per-task detail: the "what's obtained / what's left" view.
 *
 * `TaskDetailContent` is the shared body used on every surface — the desktop
 * bingo hover card, the mobile bottom sheet, and the flat task-list expander,
 * on both the website and the Discord Activity. It shows, for ONE selected
 * team (defaulting to the viewer's own), an item-level requirement checklist
 * with have/need per item, plus who contributed and a collapsible all-teams
 * comparison. Item-level detail is inherently per-team, so the team switcher —
 * not a wall of every team's items — is how cross-team peeking works.
 *
 * Data comes from GET /events/{id}/tasks/{taskId}/breakdown (see
 * web_api/event_breakdown.py), fetched lazily when the card opens and again
 * when the viewer switches teams or a live SSE frame moves the rollup.
 * Transport differs per host (site cookie BFF vs Activity bearer BFF), so the
 * fetcher is injectable; the website falls back to the same-origin BFF.
 */
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  TaskBreakdownSchema,
  type EventTask,
  type TaskBreakdown,
  type TaskBreakdownContributor,
  type TaskBreakdownGroup,
  type TaskBreakdownItem,
} from "@droptracker/api-types";
import { TASK_TYPE_LABELS, taskGoal } from "@/lib/events";
import { tileIconUrl } from "@/components/bingo-tile";
import { CARD_SECTION_CLASS } from "@/components/hover-card";
import { LocalTime } from "@/components/local-time";
import {
  TaskProgressBar,
  formatProgressValue,
  type ProgressMap,
} from "@/components/event-task-progress";

type TeamRef = { id: number; name: string; color?: string | null };

/** Loads a (task, team) breakdown. Injected by the Activity (bearer); the
 * website uses the same-origin cookie BFF by default. */
export type BreakdownFetcher = (taskId: number, teamId?: number) => Promise<TaskBreakdown>;

function siteFetcher(eventId: number): BreakdownFetcher {
  return async (taskId, teamId) => {
    const q = teamId != null ? `?team_id=${teamId}` : "";
    const res = await fetch(`/api/events/${eventId}/tasks/${taskId}/breakdown${q}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`breakdown ${res.status}`);
    return TaskBreakdownSchema.parse(await res.json());
  };
}

/** True on touch / no-hover devices — the signal to escalate to a bottom sheet
 * instead of the in-place hover card. Starts false so SSR + first client render
 * agree, then corrects post-mount. */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return coarse;
}

const progressKey = (taskId: number, teamId: number) => `${taskId}:${teamId}`;

function Avatar({ name }: { name: string | null | undefined }) {
  const initials = (name ?? "?").replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
  return (
    <span className="bg-osrs-bronze/25 text-osrs-gold-bright flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold">
      {initials}
    </span>
  );
}

function contribText(c: TaskBreakdownContributor): string {
  const named = c.items.filter((i) => i.name);
  if (!named.length) return `+${c.quantity.toLocaleString()}`;
  return named
    .map((i) => (i.quantity > 1 ? `${i.name} ×${i.quantity.toLocaleString()}` : i.name!))
    .join(", ");
}

function groupLabel(g: TaskBreakdownGroup): string | null {
  switch (g.mode) {
    case "all_of":
      return "All of";
    case "any_of":
      return g.need > 1 ? `Any ${g.need} of` : "Any of";
    case "points":
      return "Points";
    default:
      return null; // single-target "count" — no group header
  }
}

/** One requirement item row: icon, name, and have/need state. */
function RequirementRow({ item }: { item: TaskBreakdownItem }) {
  const url = item.icon ? tileIconUrl(item.icon) : null;
  const have = item.satisfied;
  const showCount = item.required > 1;
  return (
    <div
      className={`flex items-center gap-2 rounded px-1.5 py-1 ${have ? "bg-osrs-green/10" : ""}`}
    >
      <span className="border-osrs-bronze/25 bg-osrs-brown-dark/60 flex size-6 shrink-0 items-center justify-center rounded border">
        {url ? (
          <img
            src={url}
            alt=""
            className={`size-5 object-contain ${have ? "" : "opacity-45 grayscale"}`}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span className="text-osrs-parchment-dark/40 text-[10px]">?</span>
        )}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-xs ${
          have ? "text-osrs-parchment" : "text-osrs-parchment-dark/70"
        }`}
      >
        {item.name}
        {item.points != null && (
          <span className="text-osrs-gold/70"> · {item.points} pt{item.points === 1 ? "" : "s"}</span>
        )}
      </span>
      <span
        className={`shrink-0 text-xs tabular-nums ${
          have ? "text-osrs-green" : "text-osrs-parchment-dark/50"
        }`}
      >
        {showCount ? `${Math.min(item.obtained, item.required)} / ${item.required}` : have ? "✓ have" : "need"}
      </span>
    </div>
  );
}

function RequirementGroup({ group }: { group: TaskBreakdownGroup }) {
  const label = groupLabel(group);
  return (
    <div className="grid gap-0.5">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-osrs-gold-bright/70 text-[10px] font-semibold uppercase">{label}</span>
          <span
            className={`text-[10px] tabular-nums ${
              group.satisfied ? "text-osrs-green" : "text-osrs-parchment-dark/50"
            }`}
          >
            {group.satisfied ? "✓ done" : `${group.obtained} / ${group.need}${group.unit ? ` ${group.unit}` : ""}`}
          </span>
        </div>
      )}
      {group.items.map((it, i) => (
        <RequirementRow key={`${it.name}-${i}`} item={it} />
      ))}
    </div>
  );
}

function MeterBar({ pct, color, done }: { pct: number; color?: string; done?: boolean }) {
  return (
    <div
      className={`h-2.5 overflow-hidden rounded-full border ${
        done ? "border-osrs-green/70 bg-osrs-green/10" : "border-osrs-bronze/20 bg-osrs-brown-dark/70"
      }`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{ width: `${pct}%`, backgroundColor: color ?? "#e0b34c", opacity: done ? 1 : 0.85 }}
      />
    </div>
  );
}

export function TaskDetailContent({
  eventId,
  task,
  teams,
  teamColor,
  progressMap,
  viewerTeamId,
  fetchBreakdown,
  showHeader = false,
  showCompare = true,
  initialTeamId,
}: {
  eventId: number;
  task: EventTask;
  teams: TeamRef[];
  teamColor: Map<number, string>;
  /** Live per-(task,team) rollup — drives the all-teams comparison and
   * triggers a breakdown refetch when the selected team's rollup moves. */
  progressMap: ProgressMap;
  viewerTeamId?: number | null;
  /** Host transport; omit to use the same-origin cookie BFF (website). */
  fetchBreakdown?: BreakdownFetcher;
  /** Render the task label/goal header (sheet); off when the host already shows it. */
  showHeader?: boolean;
  /** Show the collapsible all-teams comparison; off when the host already
   * renders per-team bars (the flat task list). */
  showCompare?: boolean;
  initialTeamId?: number | null;
}) {
  const doFetch = useMemo(
    () => fetchBreakdown ?? siteFetcher(eventId),
    [fetchBreakdown, eventId],
  );

  const orderedTeams = useMemo(() => {
    if (viewerTeamId == null) return teams;
    return [...teams].sort((a, b) => Number(b.id === viewerTeamId) - Number(a.id === viewerTeamId));
  }, [teams, viewerTeamId]);

  const [selected, setSelected] = useState<number | null>(
    initialTeamId ?? viewerTeamId ?? teams[0]?.id ?? null,
  );
  const [bd, setBd] = useState<TaskBreakdown | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const cache = useRef<Map<number, TaskBreakdown>>(new Map());

  // Live rollup for the selected team — a change means refetch the detail.
  const liveCell = selected != null ? progressMap.get(progressKey(task.id, selected)) : undefined;
  const liveSig = `${liveCell?.progress ?? 0}:${liveCell?.completed ?? false}`;

  useEffect(() => {
    if (selected == null) return;
    let cancelled = false;
    const cached = cache.current.get(selected);
    if (cached) {
      setBd(cached);
      setState("ready");
    } else {
      setState("loading");
    }
    doFetch(task.id, selected)
      .then((res) => {
        if (cancelled) return;
        cache.current.set(selected, res);
        setBd(res);
        setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        if (!cache.current.get(selected)) setState("error");
      });
    return () => {
      cancelled = true;
    };
    // liveSig re-runs the fetch when the rollup for the selected team moves.
  }, [selected, task.id, doFetch, liveSig]);

  const selColor = selected != null ? teamColor.get(selected) : undefined;
  const showForSelected = bd && bd.team_id === selected;

  const overallPct =
    showForSelected && bd
      ? bd.completed
        ? 100
        : bd.target > 0
          ? Math.min(100, Math.floor((bd.progress / bd.target) * 100))
          : 0
      : 0;

  return (
    <div className="text-sm">
      {showHeader && (
        <div className="mb-2">
          <div className="flex items-start justify-between gap-2">
            <span className="text-osrs-gold font-medium">{task.label}</span>
            {task.points > 0 && (
              <span className="text-osrs-gold-bright shrink-0 text-xs tabular-nums">{task.points} pts</span>
            )}
          </div>
          <p className="text-osrs-parchment-dark/70 mt-0.5 text-xs">
            <span className="text-osrs-parchment-dark/50 mr-1 uppercase">{TASK_TYPE_LABELS[task.type]}</span>
            {taskGoal(task) || null}
          </p>
        </div>
      )}

      {teams.length === 0 ? (
        <p className="text-osrs-parchment-dark/50 text-xs">
          Progress appears once teams are set up for this event.
        </p>
      ) : (
        <>
          {orderedTeams.length > 1 && (
            <div className="mb-2 flex flex-wrap items-center gap-1">
              <span className="text-osrs-parchment-dark/45 mr-0.5 text-[10px] uppercase">Viewing</span>
              {orderedTeams.map((tm) => {
                const on = tm.id === selected;
                return (
                  <button
                    key={tm.id}
                    type="button"
                    onClick={() => setSelected(tm.id)}
                    className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] transition-colors ${
                      on
                        ? "bg-osrs-bronze/30 text-osrs-gold-bright"
                        : "text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
                    }`}
                  >
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: teamColor.get(tm.id) }}
                      aria-hidden
                    />
                    {tm.name}
                    {tm.id === viewerTeamId && <span className="opacity-70">(you)</span>}
                  </button>
                );
              })}
            </div>
          )}

          {state === "error" && !showForSelected ? (
            <p className="text-osrs-parchment-dark/50 text-xs">Couldn’t load progress. Try again shortly.</p>
          ) : !showForSelected ? (
            <p className="text-osrs-parchment-dark/40 text-xs">Loading progress…</p>
          ) : (
            <>
              {/* Overall progress */}
              <div className="mb-2 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <MeterBar pct={overallPct} color={selColor} done={bd!.completed} />
                </div>
                <span
                  className={`shrink-0 text-xs tabular-nums ${
                    bd!.completed ? "text-osrs-green" : "text-osrs-parchment-dark/70"
                  }`}
                >
                  {bd!.completed
                    ? "✓ complete"
                    : bd!.structure === "meter"
                      ? bd!.meter?.binary
                        ? "not yet"
                        : `${formatProgressValue(task, bd!.progress)} / ${formatProgressValue(task, bd!.target)}`
                      : bd!.structure === "paths"
                        ? `${overallPct}%`
                        : `${bd!.progress} / ${bd!.target}`}
                </span>
              </div>

              {/* Requirement detail */}
              {bd!.structure === "checklist" && (
                <div className="grid gap-2">
                  {(bd!.groups ?? []).map((g, gi) => (
                    <RequirementGroup key={gi} group={g} />
                  ))}
                </div>
              )}

              {bd!.structure === "paths" && (
                <div className="grid gap-1.5">
                  {(bd!.paths ?? []).map((p, pi) => (
                    <div key={pi} className="grid gap-1">
                      {pi > 0 && (
                        <span className="text-osrs-gold-bright/70 text-center text-[10px] font-bold uppercase">
                          — or —
                        </span>
                      )}
                      <div
                        className={`rounded border p-2 ${
                          p.closest
                            ? "border-osrs-gold/40 bg-osrs-gold/5"
                            : "border-osrs-bronze/20"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-osrs-parchment-dark/70 text-[10px] font-semibold uppercase">
                            {p.label}
                            {p.closest && <span className="text-osrs-gold-bright"> · closest</span>}
                          </span>
                          <span className="text-osrs-parchment-dark/50 text-[10px] tabular-nums">{p.pct}%</span>
                        </div>
                        <div className="grid gap-1">
                          {p.groups.map((g, gi) => (
                            <RequirementGroup key={gi} group={g} />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {bd!.structure === "meter" && bd!.meter && !bd!.meter.binary && bd!.meter.label && (
                <p className="text-osrs-parchment-dark/60 text-xs">
                  Toward <span className="text-osrs-parchment/90">{bd!.meter.label}</span>
                </p>
              )}
              {bd!.structure === "meter" && bd!.meter?.binary && (
                <p className={`text-xs ${bd!.completed ? "text-osrs-green" : "text-osrs-parchment-dark/60"}`}>
                  {bd!.completed ? "Completed" : "Not completed yet"}
                  {bd!.meter.label ? ` — ${bd!.meter.label}` : ""}
                </p>
              )}

              {bd!.wildcard > 0 && (
                <p className="text-osrs-parchment-dark/45 mt-1 text-[10px]">
                  Includes {bd!.wildcard.toLocaleString()} from manual awards.
                </p>
              )}

              {/* Contributors */}
              {bd!.contributors.length > 0 && (
                <div className={CARD_SECTION_CLASS}>
                  <p className="text-osrs-parchment-dark/50 mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                    Contributed by
                  </p>
                  <ul className="space-y-1">
                    {bd!.contributors.slice(0, 8).map((c, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs">
                        <Avatar name={c.player_name} />
                        <span className="text-osrs-parchment/90 shrink-0 max-w-[35%] truncate">
                          {c.player_name ?? "Manual award"}
                        </span>
                        <span className="text-osrs-parchment-dark/55 min-w-0 flex-1 truncate">
                          {contribText(c)}
                        </span>
                        {c.last_at != null && (
                          <span className="text-osrs-parchment-dark/40 shrink-0">
                            <LocalTime unix={c.last_at} mode="date" />
                          </span>
                        )}
                      </li>
                    ))}
                    {bd!.contributors.length > 8 && (
                      <li className="text-osrs-parchment-dark/40 text-[10px]">
                        +{bd!.contributors.length - 8} more contributors
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* Cross-team comparison — collapsed by default, aggregate only. */}
          {showCompare && teams.length > 1 && (
            <details className={CARD_SECTION_CLASS}>
              <summary className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright cursor-pointer text-xs select-none">
                Compare all teams
              </summary>
              <div className="mt-2 space-y-1.5">
                {teams.map((tm) => (
                  <TaskProgressBar
                    key={tm.id}
                    task={task}
                    cell={progressMap.get(progressKey(task.id, tm.id))}
                    color={teamColor.get(tm.id)}
                    label={tm.name + (tm.id === viewerTeamId ? " ★" : "")}
                  />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

/** Mobile escalation: the same detail body in a slide-up bottom sheet. */
export function TaskDetailSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="card-pop menu-in max-h-[82vh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-osrs-bronze/40 mx-auto mb-3 h-1 w-10 rounded-full" aria-hidden />
        {children}
      </div>
    </div>,
    document.body,
  );
}
