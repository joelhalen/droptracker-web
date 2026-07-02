"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  EVENT_TASK_TYPES,
  type EventDetail,
  type EventTask,
  type EventTeam,
  type EventTaskInput,
} from "@droptracker/api-types";
import { TASK_TYPE_LABELS, taskGoal } from "@/lib/events";
import { getErrorMessage } from "@/lib/errors";
import { Alert, EmptyState } from "@/components/ui";
import {
  addEventTask,
  addEventTeam,
  removeEventTask,
  updateGroupEvent,
} from "@/app/(admin)/groups/[id]/events/actions";

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
  });

  const startEditEvent = () => {
    setError(null);
    setEventDraft({
      name: event.name,
      description: event.description ?? "",
      startsAt: fromUnix(event.starts_at),
      endsAt: fromUnix(event.ends_at),
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
        setTasks((prev) => [...prev, { ...task, id, points: task.points ?? 0 }]);
        setTask({ type: task.type, label: "", target: "", points: 0 });
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't add the task. Please try again."));
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
            <span className="text-osrs-parchment-dark/60 text-sm capitalize">{event.status}</span>
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
                <button
                  onClick={() => onRemoveTask(t.id)}
                  disabled={pending}
                  className="text-osrs-red hover:bg-osrs-red/10 rounded px-2 py-1 text-xs disabled:opacity-50"
                >
                  Remove
                </button>
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
          <ul className="divide-osrs-bronze/20 divide-y">
            {teams.map((team) => (
              <li key={team.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>{team.name}</span>
                <span className="text-osrs-parchment-dark/60 text-xs">
                  {team.member_count} players · {team.score} pts
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No teams yet" />
        )}
      </section>
    </div>
  );
}
