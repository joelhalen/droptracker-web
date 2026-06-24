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
import {
  addEventTask,
  addEventTeam,
  removeEventTask,
} from "@/app/(admin)/groups/[id]/events/actions";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-2 text-sm outline-none";

export function EventManager({ groupId, event }: { groupId: number; event: EventDetail }) {
  const [tasks, setTasks] = useState<EventTask[]>(event.tasks);
  const [teams, setTeams] = useState<EventTeam[]>(event.teams);
  const [pending, startTransition] = useTransition();

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
    startTransition(async () => {
      const { id } = await addEventTask(groupId, event.id, task);
      setTasks((prev) => [...prev, { ...task, id, points: task.points ?? 0 }]);
      setTask({ type: task.type, label: "", target: "", points: 0 });
    });
  };

  const onRemoveTask = (taskId: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    startTransition(async () => {
      await removeEventTask(groupId, event.id, taskId);
    });
  };

  const onAddTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    startTransition(async () => {
      const { id } = await addEventTeam(groupId, event.id, { name: teamName.trim() });
      setTeams((prev) => [...prev, { id, name: teamName.trim(), score: 0, member_count: 0 }]);
      setTeamName("");
    });
  };

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-osrs-gold text-xl font-bold">{event.name}</h2>
          <span className="text-osrs-parchment-dark/60 text-sm capitalize">{event.status}</span>
        </div>
        <Link
          href={`/events/${event.id}` as Route}
          className="text-osrs-gold-bright text-sm hover:underline"
        >
          View public page →
        </Link>
      </div>

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
          <p className="text-osrs-parchment-dark/60 text-sm">No tasks yet.</p>
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
          <p className="text-osrs-parchment-dark/60 text-sm">No teams yet.</p>
        )}
      </section>
    </div>
  );
}
