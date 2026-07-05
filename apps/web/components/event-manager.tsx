"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  EVENT_FORMATION_MODES,
  EVENT_TASK_TYPES,
  type EventDetail,
  type EventTask,
  type EventTeam,
  type EventTaskInput,
} from "@droptracker/api-types";
import { FORMATION_MODE_LABELS, TASK_TYPE_LABELS, taskGoal } from "@/lib/events";
import { getErrorMessage } from "@/lib/errors";
import { Alert, EmptyState } from "@/components/ui";
import {
  addEventTask,
  addEventTeam,
  addEventTeamMember,
  removeEventTask,
  removeEventTeamMember,
  searchGroupPlayers,
  updateEventTask,
  updateGroupEvent,
} from "@/app/(admin)/groups/[id]/events/actions";
import { EventDiscord } from "@/components/event-discord";
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

export function EventManager({ groupId, event: initialEvent }: { groupId: number; event: EventDetail }) {
  const [event, setEvent] = useState(initialEvent);
  const [tasks, setTasks] = useState<EventTask[]>(initialEvent.tasks);
  const [teams, setTeams] = useState<EventTeam[]>(initialEvent.teams);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  const [task, setTask] = useState<EventTaskInput>({
    type: "kc_target",
    label: "",
    target: "",
    points: 0,
  });
  const [teamName, setTeamName] = useState("");

  const onAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task.label.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const { id } = await addEventTask(groupId, event.id, task);
        setTasks((prev) => [
          ...prev,
          { ...task, id, points: task.points ?? 0, requires_confirmation: task.requires_confirmation ?? false },
        ]);
        setTask({ type: task.type, label: "", target: "", points: 0 });
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't add the task. Please try again."));
      }
    });
  };

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
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/groups/${groupId}/events` as Route}
              className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
            >
              ← Back to events
            </Link>
            <h2 className="text-osrs-gold mt-1 text-xl font-bold">{event.name}</h2>
            <span className="text-osrs-parchment-dark/60 text-sm capitalize">
              {event.status} · {event.formation_mode.replace(/_/g, " ")}
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
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {/* Tasks */}
      <section>
        <h3 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">Tasks</h3>
        <form onSubmit={onAddTask} className="mb-4 grid gap-2 sm:grid-cols-[10rem_1fr_8rem_6rem_auto]">
          <select
            value={task.type}
            onChange={(e) => setTask((t) => ({ ...t, type: e.target.value as EventTask["type"] }))}
            className={field}
          >
            {EVENT_TASK_TYPES.map((tt) => (
              <option key={tt} value={tt}>
                {TASK_TYPE_LABELS[tt]}
              </option>
            ))}
          </select>
          <input
            value={task.label}
            onChange={(e) => setTask((t) => ({ ...t, label: e.target.value }))}
            placeholder="Label"
            className={field}
          />
          <input
            value={task.target ?? ""}
            onChange={(e) => setTask((t) => ({ ...t, target: e.target.value }))}
            placeholder="Target"
            className={field}
          />
          <input
            type="number"
            min={0}
            value={task.points ?? 0}
            onChange={(e) => setTask((t) => ({ ...t, points: Number(e.target.value) }))}
            placeholder="Pts"
            className={field}
          />
          <button
            type="submit"
            disabled={pending || !task.label.trim()}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Add
          </button>
        </form>

        {tasks.length ? (
          <ul className="divide-osrs-bronze/20 divide-y">
            {tasks.map((t) => (
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
                    onClick={() => onRemoveTask(t.id)}
                    disabled={pending}
                    className="text-osrs-red hover:bg-osrs-red/10 rounded px-2 py-1 text-xs disabled:opacity-50"
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No tasks yet" />
        )}
      </section>

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
  groupId: number;
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
          placeholder="Search group members…"
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
