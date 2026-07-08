"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  EVENT_FORMATION_MODES,
  type EventDetail,
  type EventTask,
  type EventTeam,
} from "@droptracker/api-types";
import { FORMATION_MODE_LABELS, TASK_TYPE_LABELS, taskGoal } from "@/lib/events";
import { getErrorMessage } from "@/lib/errors";
import { Alert, EmptyState } from "@/components/ui";
import {
  activateEvent,
  addEventTeam,
  addEventTeamMember,
  endEvent,
  removeEventTask,
  removeEventTeamMember,
  searchGroupPlayers,
  updateEventTask,
  updateGroupEvent,
} from "@/app/(admin)/groups/[id]/events/actions";
import { EventBingoDesigner } from "@/components/event-bingo-designer";
import { formatProgressValue, taskThreshold } from "@/components/event-task-progress";
import { EventDiscord } from "@/components/event-discord";
import { EventTaskForm } from "@/components/event-task-form";
import { EventReview } from "@/components/event-review";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-2 text-sm outline-none";

/** Convert a datetime-local value to unix seconds (or null). */
const toUnix = (v: string): number | null => (v ? Math.floor(new Date(v).getTime() / 1000) : null);
/** Convert unix seconds to a datetime-local value (or ""). */
const fromUnix = (v: number | null): string => {
  if (!v) return "";
  const d = new Date(v * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Colored draft/active/past chip (explicit lifecycle, Task 21). */
function StatusChip({ status }: { status: EventDetail["status"] }) {
  const styles: Record<EventDetail["status"], string> = {
    draft: "bg-osrs-bronze/20 text-osrs-parchment-dark/80",
    active: "bg-green-500/15 text-green-400",
    past: "bg-osrs-brown-dark/60 text-osrs-parchment-dark/50",
  };
  return (
    <span className={`${styles[status]} rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide`}>
      {status}
    </span>
  );
}

const fmtWhen = (unix: number) => new Date(unix * 1000).toLocaleString();

/** `groupId` is null for global events (superadmin-managed from /admin/events). */
export function EventManager({ groupId, event: initialEvent }: { groupId: number | null; event: EventDetail }) {
  const [event, setEvent] = useState(initialEvent);
  const [tasks, setTasks] = useState<EventTask[]>(initialEvent.tasks);
  const [teams, setTeams] = useState<EventTeam[]>(initialEvent.teams);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);

  const applyDetail = (detail: EventDetail) => {
    setEvent(detail);
    setTasks(detail.tasks);
    setTeams(detail.teams);
  };

  /** Explicit activation — the API pre-flights readiness (teams/board/dates)
   * and the tier's active-event limit; its 422/409 messages surface here. */
  const onActivate = () => {
    setError(null);
    startTransition(async () => {
      try {
        applyDetail(await activateEvent(groupId, event.id));
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't activate the event. Please try again."));
      }
    });
  };

  const onEnd = () => {
    setConfirmingEnd(false);
    setError(null);
    startTransition(async () => {
      try {
        applyDetail(await endEvent(groupId, event.id));
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't end the event. Please try again."));
      }
    });
  };

  const [editingEvent, setEditingEvent] = useState(false);
  const [eventDraft, setEventDraft] = useState({
    name: event.name,
    description: event.description ?? "",
    startsAt: fromUnix(event.starts_at),
    endsAt: fromUnix(event.ends_at),
    formationMode: event.formation_mode,
    joinCode: event.join_code ?? "",
    requiresConfirmation: event.requires_confirmation,
  });

  const startEditEvent = () => {
    setError(null);
    setEventDraft({
      name: event.name,
      description: event.description ?? "",
      startsAt: fromUnix(event.starts_at),
      endsAt: fromUnix(event.ends_at),
      formationMode: event.formation_mode,
      joinCode: event.join_code ?? "",
      requiresConfirmation: event.requires_confirmation,
    });
    setEditingEvent(true);
  };

  const saveEditEvent = () => {
    if (!eventDraft.name.trim()) return;
    startTransition(async () => {
      setError(null);
      try {
        const updated = await updateGroupEvent(groupId, event.id, {
          name: eventDraft.name,
          description: eventDraft.description || undefined,
          starts_at: toUnix(eventDraft.startsAt),
          ends_at: toUnix(eventDraft.endsAt),
          formation_mode: eventDraft.formationMode,
          join_code: eventDraft.joinCode.trim() || null,
          requires_confirmation: eventDraft.requiresConfirmation,
        });
        setEvent(updated);
        setTasks(updated.tasks);
        setTeams(updated.teams);
        setEditingEvent(false);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save the event. Please try again."));
      }
    });
  };

  /** Roster add (also moves a player already on another team in this event —
   * their join timestamp resets, so credit starts over on the new team). */
  const onAddMember = (teamId: number, player: { id: number; name: string }) => {
    setError(null);
    startTransition(async () => {
      try {
        await addEventTeamMember(groupId, event.id, teamId, player.id);
        const joinedAt = Math.floor(Date.now() / 1000);
        setTeams((prev) =>
          prev.map((t) => {
            const members = (t.members ?? []).filter((m) => m.player_id !== player.id);
            if (t.id === teamId) {
              members.push({ player_id: player.id, player_name: player.name, joined_at: joinedAt });
            }
            return { ...t, members, member_count: members.length };
          }),
        );
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't add the player. Please try again."));
      }
    });
  };

  const onRemoveMember = (teamId: number, playerId: number) => {
    setError(null);
    startTransition(async () => {
      try {
        await removeEventTeamMember(groupId, event.id, teamId, playerId);
        setTeams((prev) =>
          prev.map((t) => {
            if (t.id !== teamId) return t;
            const members = (t.members ?? []).filter((m) => m.player_id !== playerId);
            return { ...t, members, member_count: members.length };
          }),
        );
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't remove the player. Please try again."));
      }
    });
  };

  /** Task id being edited inline, or -1 for the create form, or null. */
  const [taskFormFor, setTaskFormFor] = useState<number | null>(null);
  const [teamName, setTeamName] = useState("");

  /** Per-task manual-review toggle (PRD D3). */
  const onToggleTaskReview = (t: EventTask) => {
    const next = !t.requires_confirmation;
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, requires_confirmation: next } : x)));
    setError(null);
    startTransition(async () => {
      try {
        await updateEventTask(groupId, event.id, t.id, { requires_confirmation: next });
      } catch (err) {
        setTasks((prev) =>
          prev.map((x) => (x.id === t.id ? { ...x, requires_confirmation: !next } : x)),
        );
        setError(getErrorMessage(err, "Couldn't update the task. Please try again."));
      }
    });
  };

  const onRemoveTask = (taskId: number) => {
    const prevTasks = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setError(null);
    startTransition(async () => {
      try {
        await removeEventTask(groupId, event.id, taskId);
      } catch (err) {
        setTasks(prevTasks);
        setError(getErrorMessage(err, "Couldn't remove the task. Please try again."));
      }
    });
  };

  const onAddTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const { id } = await addEventTeam(groupId, event.id, { name: teamName.trim() });
        setTeams((prev) => [...prev, { id, name: teamName.trim(), score: 0, member_count: 0 }]);
        setTeamName("");
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't add the team. Please try again."));
      }
    });
  };

  return (
    <div className="space-y-10">
      {editingEvent ? (
        <div className="border-osrs-bronze/30 space-y-3 rounded border p-4">
          <input
            value={eventDraft.name}
            onChange={(e) => setEventDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Event name"
            className={field}
          />
          <textarea
            value={eventDraft.description}
            onChange={(e) => setEventDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Description (optional)"
            rows={2}
            className={field}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Starts</span>
              <input
                type="datetime-local"
                value={eventDraft.startsAt}
                onChange={(e) => setEventDraft((d) => ({ ...d, startsAt: e.target.value }))}
                className={field}
              />
            </label>
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Ends</span>
              <input
                type="datetime-local"
                value={eventDraft.endsAt}
                onChange={(e) => setEventDraft((d) => ({ ...d, endsAt: e.target.value }))}
                className={field}
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Team formation</span>
              <select
                value={eventDraft.formationMode}
                onChange={(e) =>
                  setEventDraft((d) => ({
                    ...d,
                    formationMode: e.target.value as EventDetail["formation_mode"],
                  }))
                }
                className={`${field} w-full`}
              >
                {EVENT_FORMATION_MODES.map((m) => (
                  <option key={m} value={m}>
                    {FORMATION_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                Join code (self join only — blank for open signup)
              </span>
              <input
                value={eventDraft.joinCode}
                onChange={(e) => setEventDraft((d) => ({ ...d, joinCode: e.target.value }))}
                maxLength={32}
                placeholder="Optional code players must enter"
                className={`${field} w-full`}
              />
            </label>
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={eventDraft.requiresConfirmation}
              onChange={(e) =>
                setEventDraft((d) => ({ ...d, requiresConfirmation: e.target.checked }))
              }
              className="mt-0.5 size-4"
            />
            <span>
              Require manual confirmation for <em>every</em> completion
              <span className="text-osrs-parchment-dark/60 block text-xs">
                All automatic completions queue in Review until an admin confirms them. You can
                also require review per task below.
              </span>
            </span>
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={saveEditEvent}
              disabled={pending || !eventDraft.name.trim()}
              className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setEditingEvent(false)}
              disabled={pending}
              className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href={(groupId == null ? "/admin/events" : `/groups/${groupId}/events`) as Route}
                className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
              >
                ← Back to events
              </Link>
              <div className="mt-1 flex items-center gap-2">
                <h2 className="text-osrs-gold text-xl font-bold">{event.name}</h2>
                <StatusChip status={event.status} />
                {groupId == null && (
                  <span className="bg-osrs-gold/15 text-osrs-gold rounded px-1.5 py-0.5 text-xs">
                    Global
                  </span>
                )}
              </div>
              <span className="text-osrs-parchment-dark/60 text-sm">
                {event.formation_mode.replace(/_/g, " ")}
                {event.join_requires_code ? " · join code set" : ""}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={startEditEvent}
                className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-sm"
              >
                Edit
              </button>
              <Link
                href={`/events/${event.id}` as Route}
                className="text-osrs-gold-bright text-sm hover:underline"
              >
                View public page →
              </Link>
            </div>
          </div>

          {/* Lifecycle (Task 21): scheduled window + explicit transitions. */}
          <div className="border-osrs-bronze/20 flex flex-wrap items-center gap-x-4 gap-y-2 rounded border p-3 text-sm">
            <span className="text-osrs-parchment-dark/70">
              {event.status === "draft" &&
                (event.starts_at
                  ? `Scheduled to start ${fmtWhen(event.starts_at)} (auto-activates if it passes the checks)`
                  : "Draft — not scheduled; activate it manually when it's ready")}
              {event.status === "active" &&
                (event.ends_at
                  ? `Live${event.activated_at ? ` since ${fmtWhen(event.activated_at)}` : ""} · ends ${fmtWhen(event.ends_at)}`
                  : `Live${event.activated_at ? ` since ${fmtWhen(event.activated_at)}` : ""} · no scheduled end`)}
              {event.status === "past" &&
                `Ended${event.ended_at ? ` ${fmtWhen(event.ended_at)}` : ""}`}
            </span>
            <span className="ml-auto flex items-center gap-2">
              {event.status === "draft" && (
                <button
                  onClick={onActivate}
                  disabled={pending}
                  className="bg-osrs-gold text-osrs-brown-dark hover:bg-osrs-gold-bright rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                >
                  {pending ? "Activating…" : "Activate"}
                </button>
              )}
              {event.status === "active" &&
                (confirmingEnd ? (
                  <>
                    <span className="text-osrs-parchment-dark/70 text-xs">
                      End the event now? This can&apos;t be undone.
                    </span>
                    <button
                      onClick={onEnd}
                      disabled={pending}
                      className="bg-osrs-red/80 text-osrs-parchment hover:bg-osrs-red rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                    >
                      {pending ? "Ending…" : "Yes, end it"}
                    </button>
                    <button
                      onClick={() => setConfirmingEnd(false)}
                      disabled={pending}
                      className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmingEnd(true)}
                    disabled={pending}
                    className="border-osrs-red/50 text-osrs-red hover:bg-osrs-red/10 rounded border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                  >
                    End event
                  </button>
                ))}
            </span>
          </div>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {/* Tasks */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="heading-rule text-osrs-gold pb-1 text-lg font-semibold">Tasks</h3>
          {taskFormFor !== -1 && (
            <button
              onClick={() => setTaskFormFor(-1)}
              className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium"
            >
              New task
            </button>
          )}
        </div>
        {taskFormFor === -1 && (
          <div className="mb-4">
            <EventTaskForm
              groupId={groupId}
              eventId={event.id}
              onSaved={(t) => {
                setTasks((prev) => [...prev, t]);
                setTaskFormFor(null);
              }}
              onCancel={() => setTaskFormFor(null)}
            />
          </div>
        )}

        {tasks.length ? (
          <ul className="divide-osrs-bronze/20 divide-y">
            {tasks.map((t) =>
              taskFormFor === t.id ? (
                <li key={t.id} className="py-2.5">
                  <EventTaskForm
                    groupId={groupId}
                    eventId={event.id}
                    initial={t}
                    onSaved={(updated) => {
                      setTasks((prev) => prev.map((x) => (x.id === t.id ? updated : x)));
                      setTaskFormFor(null);
                    }}
                    onCancel={() => setTaskFormFor(null)}
                  />
                </li>
              ) : (
                <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>
                    <span className="text-osrs-parchment-dark/50 mr-2 text-xs uppercase">
                      {TASK_TYPE_LABELS[t.type]}
                    </span>
                    {t.label}
                    {taskGoal(t) && (
                      <span className="text-osrs-parchment-dark/60"> — {taskGoal(t)}</span>
                    )}
                    {t.points > 0 && (
                      <span className="text-osrs-gold-bright ml-2 text-xs">{t.points} pts</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <label
                      className="text-osrs-parchment-dark/60 flex cursor-pointer items-center gap-1 text-xs"
                      title="Completions of this task queue for admin review"
                    >
                      <input
                        type="checkbox"
                        checked={t.requires_confirmation}
                        onChange={() => onToggleTaskReview(t)}
                        disabled={pending}
                        className="size-3.5"
                      />
                      review
                    </label>
                    <button
                      onClick={() => setTaskFormFor(t.id)}
                      className="text-osrs-parchment-dark/70 hover:bg-osrs-bronze/15 rounded px-2 py-1 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onRemoveTask(t.id)}
                      disabled={pending}
                      className="text-osrs-red hover:bg-osrs-red/10 rounded px-2 py-1 text-xs disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ),
            )}
          </ul>
        ) : (
          <EmptyState title="No tasks yet" />
        )}
      </section>

      {/* Progress matrix — the admin transparency view: every task × team
          rollup at a glance (same numbers the public pages render live). */}
      {tasks.length > 0 && teams.length > 0 && (
        <section>
          <h3 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">Progress</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="text-osrs-parchment-dark/60 text-left text-xs">
                  <th className="py-1.5 pr-3 font-normal">Task</th>
                  {teams.map((tm) => (
                    <th key={tm.id} className="px-3 py-1.5 text-right font-normal">
                      {tm.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-osrs-bronze/15 divide-y">
                {tasks.map((t) => {
                  const target = taskThreshold(t);
                  return (
                    <tr key={t.id}>
                      <td className="text-osrs-parchment max-w-0 truncate py-1.5 pr-3" title={t.label}>
                        {t.label}
                      </td>
                      {teams.map((tm) => {
                        const p = (event.progress ?? []).find(
                          (row) => row.task_id === t.id && row.team_id === tm.id,
                        );
                        return (
                          <td key={tm.id} className="px-3 py-1.5 text-right tabular-nums">
                            {p?.completed ? (
                              <span className="text-osrs-green">✓</span>
                            ) : (
                              <span
                                className={
                                  p?.progress
                                    ? "text-osrs-parchment-dark/80"
                                    : "text-osrs-parchment-dark/30"
                                }
                              >
                                {formatProgressValue(t, p?.progress ?? 0)} /{" "}
                                {formatProgressValue(t, target)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Teams */}
      <section>
        <h3 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">Teams</h3>
        <form onSubmit={onAddTeam} className="mb-4 flex gap-2">
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Team name"
            className={`${field} flex-1`}
          />
          <button
            type="submit"
            disabled={pending || !teamName.trim()}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Add team
          </button>
        </form>

        {teams.length ? (
          <ul className="space-y-4">
            {teams.map((team) => (
              <TeamRoster
                key={team.id}
                groupId={groupId}
                team={team}
                pending={pending}
                onAddMember={onAddMember}
                onRemoveMember={onRemoveMember}
              />
            ))}
          </ul>
        ) : (
          <EmptyState title="No teams yet" />
        )}
      </section>

      {/* Bingo board designer (Task 20) */}
      <section>
        <h3 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">Board</h3>
        <EventBingoDesigner
          groupId={groupId}
          event={event}
          tasks={tasks}
          onSaved={(detail) => {
            // The board PUT can create/delete tasks — refresh the whole
            // manager state from the returned detail.
            applyDetail(detail);
          }}
        />
      </section>

      {/* Per-event Discord destinations (Task 19) */}
      <EventDiscord groupId={groupId} eventId={event.id} />

      {/* Verification queue / ledger / manual awards (Task 18) */}
      <EventReview groupId={groupId} eventId={event.id} tasks={tasks} teams={teams} />
    </div>
  );
}

/** One team's roster: member list with remove, plus an add-player search over
 * the group's members. */
function TeamRoster({
  groupId,
  team,
  pending,
  onAddMember,
  onRemoveMember,
}: {
  groupId: number | null;
  team: EventTeam;
  pending: boolean;
  onAddMember: (teamId: number, player: { id: number; name: string }) => void;
  onRemoveMember: (teamId: number, playerId: number) => void;
}) {
  const members = team.members ?? [];
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: number; name: string }[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const found = await searchGroupPlayers(groupId, q);
      setResults(found.filter((p) => !members.some((m) => m.player_id === p.id)));
    } catch (err) {
      setSearchError(getErrorMessage(err, "Search failed. Please try again."));
    } finally {
      setSearching(false);
    }
  };

  const pickPlayer = (player: { id: number; name: string }) => {
    setResults(null);
    setQuery("");
    onAddMember(team.id, player);
  };

  return (
    <li className="border-osrs-bronze/20 rounded border p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{team.name}</span>
        <span className="text-osrs-parchment-dark/60 text-xs">
          {members.length} players · {team.score} pts
        </span>
      </div>

      {members.length > 0 && (
        <ul className="divide-osrs-bronze/10 mt-2 divide-y">
          {members.map((m) => (
            <li key={m.player_id} className="flex items-center justify-between py-1.5 text-sm">
              <span>
                {m.player_name}
                {m.joined_at && (
                  <span className="text-osrs-parchment-dark/40 ml-2 text-xs">
                    joined {new Date(m.joined_at * 1000).toLocaleDateString()}
                  </span>
                )}
              </span>
              <button
                onClick={() => onRemoveMember(team.id, m.player_id)}
                disabled={pending}
                className="text-osrs-red hover:bg-osrs-red/10 rounded px-2 py-1 text-xs disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSearch} className="mt-2 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={groupId == null ? "Search players…" : "Search group members…"}
          className={`${field} flex-1`}
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border px-3 py-2 text-sm disabled:opacity-50"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </form>
      {searchError && (
        <p className="text-osrs-red mt-1 text-xs">{searchError}</p>
      )}
      {results && (
        <ul className="border-osrs-bronze/20 mt-2 max-h-48 overflow-y-auto rounded border">
          {results.length ? (
            results.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => pickPlayer(p)}
                  disabled={pending}
                  className="hover:bg-osrs-bronze/10 flex w-full items-center justify-between px-3 py-1.5 text-left text-sm disabled:opacity-50"
                >
                  <span>{p.name}</span>
                  <span className="text-osrs-gold-bright text-xs">Add</span>
                </button>
              </li>
            ))
          ) : (
            <li className="text-osrs-parchment-dark/50 px-3 py-2 text-xs">No matches.</li>
          )}
        </ul>
      )}
    </li>
  );
}
