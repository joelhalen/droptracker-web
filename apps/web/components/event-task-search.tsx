"use client";

/**
 * Shared "find a task" surface for the event builder (t56).
 *
 * Every authoring screen used to render its task list raw — a plain <ul> in
 * the manager and the wizard, an unsearchable <select> in both board
 * designers — so finding one task among fifty meant Ctrl+F or scrolling a
 * dropdown. This module holds the three pieces those screens share:
 *
 *  - `filterTasks` / `TaskSearchBar` — live text + type filter and sorting
 *    over an already-loaded task array (no fetching, so it is safe in the
 *    manager's always-mounted tab bodies).
 *  - `EventTaskCombobox` — the searchable replacement for the tile-binding
 *    <select>s.
 *  - `BoundTaskPanel` — the bound task's goal/points shown inline inside a
 *    tile editor, with a points field that writes straight through and the
 *    full task form one click away, so create → assign → point → edit never
 *    leaves the Board tab.
 *
 * All state here is local and derived from props; nothing schedules a board
 * save, so the designers' autosave/adopt cycle is untouched.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { EventTask } from "@droptracker/api-types";
import { TASK_TYPE_LABELS, taskGoal } from "@/lib/events";
import { getErrorMessage } from "@/lib/errors";
import { EventTaskFormWithAi } from "@/components/event-task-form-ai";
import { QuantityInput } from "@/components/quantity-input";
import { updateEventTask } from "@/app/(site)/(admin)/groups/[id]/events/actions";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-2 text-sm outline-none";

export type TaskSort = "order" | "label" | "points" | "type";

export type TaskFilter = {
  query: string;
  /** "" = every type. */
  type: string;
  sort: TaskSort;
};

export const EMPTY_TASK_FILTER: TaskFilter = { query: "", type: "", sort: "order" };

export const taskFilterActive = (f: TaskFilter): boolean =>
  f.query.trim() !== "" || f.type !== "" || f.sort !== "order";

/** What a search term is matched against: the label, the type's display name
 * and the rendered goal (so "sub 3:00" or "vorkath" find their tasks). */
const haystack = (t: EventTask): string =>
  `${t.label} ${TASK_TYPE_LABELS[t.type]} ${taskGoal(t)} ${t.target ?? ""}`.toLowerCase();

/** Filter + sort an in-memory task list. Every term must match (AND), so
 * "barrows 50" narrows rather than widens. Returns the input array untouched
 * when the filter is empty. */
export function filterTasks(tasks: EventTask[], f: TaskFilter): EventTask[] {
  const terms = f.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let out = tasks;
  if (f.type) out = out.filter((t) => t.type === f.type);
  if (terms.length) {
    out = out.filter((t) => {
      const hay = haystack(t);
      return terms.every((term) => hay.includes(term));
    });
  }
  if (f.sort === "label") {
    out = [...out].sort((a, b) => a.label.localeCompare(b.label));
  } else if (f.sort === "points") {
    out = [...out].sort((a, b) => b.points - a.points || a.label.localeCompare(b.label));
  } else if (f.sort === "type") {
    out = [...out].sort(
      (a, b) =>
        TASK_TYPE_LABELS[a.type].localeCompare(TASK_TYPE_LABELS[b.type]) ||
        a.label.localeCompare(b.label),
    );
  }
  return out;
}

/** Search + type filter + sort for a task list. Hides itself on short lists
 * (nothing to hunt through) unless a filter is already applied. */
export function TaskSearchBar({
  tasks,
  value,
  onChange,
  shown,
  minTasks = 6,
  label = "tasks",
}: {
  /** The unfiltered list — drives the type options and the total count. */
  tasks: EventTask[];
  value: TaskFilter;
  onChange: (next: TaskFilter) => void;
  /** How many rows the caller is rendering after filtering. */
  shown: number;
  minTasks?: number;
  label?: string;
}) {
  const types = useMemo(() => {
    const counts = new Map<EventTask["type"], number>();
    for (const t of tasks) counts.set(t.type, (counts.get(t.type) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) =>
      TASK_TYPE_LABELS[a[0]].localeCompare(TASK_TYPE_LABELS[b[0]]),
    );
  }, [tasks]);

  if (tasks.length < minTasks && !taskFilterActive(value)) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <input
        value={value.query}
        onChange={(e) => onChange({ ...value, query: e.target.value })}
        placeholder={`Search ${label}…`}
        aria-label={`Search ${label}`}
        className={`${field} min-w-40 flex-1`}
      />
      <select
        value={value.type}
        onChange={(e) => onChange({ ...value, type: e.target.value })}
        aria-label="Filter by task type"
        className={field}
      >
        <option value="">All types ({tasks.length})</option>
        {types.map(([type, count]) => (
          <option key={type} value={type}>
            {TASK_TYPE_LABELS[type]} ({count})
          </option>
        ))}
      </select>
      <select
        value={value.sort}
        onChange={(e) => onChange({ ...value, sort: e.target.value as TaskSort })}
        aria-label="Sort tasks"
        className={field}
      >
        <option value="order">Added order</option>
        <option value="label">Name A–Z</option>
        <option value="points">Most points</option>
        <option value="type">Type</option>
      </select>
      {taskFilterActive(value) && (
        <>
          <span className="text-osrs-parchment-dark/60 text-xs tabular-nums">
            {shown} of {tasks.length}
          </span>
          <button
            type="button"
            onClick={() => onChange(EMPTY_TASK_FILTER)}
            className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright text-xs"
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}

/** Rows rendered at once — a guard for events with hundreds of tasks; the
 * search box is the way past it. */
const MAX_ROWS = 100;

/**
 * Searchable single-select over the event's own tasks — the replacement for
 * the designers' `<select>` of every task.
 *
 * Focus opens the full list; typing filters it; Enter takes the highlighted
 * row. Escape closes the list and stops there (it must not also close the
 * tile modal the combobox lives in).
 */
export function EventTaskCombobox({
  tasks,
  value,
  onChange,
  disabled = false,
  placeholder = "Search this event's tasks…",
  clearLabel = "Clear",
}: {
  tasks: EventTask[];
  value: number | null;
  onChange: (taskId: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  clearLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = value != null ? (tasks.find((t) => t.id === value) ?? null) : null;
  const matches = useMemo(
    () => filterTasks(tasks, { query, type: "", sort: "order" }),
    [tasks, query],
  );
  const rows = matches.slice(0, MAX_ROWS);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  // Click-away closes without picking.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (task: EventTask | null) => {
    onChange(task?.id ?? null);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (!open) return;
      e.preventDefault();
      // The bingo cell editor closes its modal on a document-level Escape —
      // the dropdown gets the first one.
      e.stopPropagation();
      setOpen(false);
      setQuery("");
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (!rows.length) return;
      setActive((i) =>
        e.key === "ArrowDown" ? (i + 1) % rows.length : (i - 1 + rows.length) % rows.length,
      );
      return;
    }
    if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      const row = rows[active];
      if (row) pick(row);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex gap-2">
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Search this event's tasks"
          value={open ? query : (selected?.label ?? "")}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={`${field} min-w-0 flex-1`}
        />
        {selected && (
          <button
            type="button"
            onClick={() => pick(null)}
            disabled={disabled}
            className="border-osrs-bronze/40 text-osrs-parchment-dark/70 hover:border-osrs-gold hover:text-osrs-gold-bright shrink-0 rounded border px-2 py-1 text-xs disabled:opacity-50"
          >
            {clearLabel}
          </button>
        )}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="bg-osrs-brown-dark border-osrs-bronze/40 absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded border shadow-lg"
        >
          {rows.length ? (
            rows.map((t, i) => (
              <li key={t.id} role="option" aria-selected={t.id === value}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(t)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm ${
                    i === active ? "bg-osrs-bronze/20" : ""
                  } ${t.id === value ? "text-osrs-gold-bright" : ""}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{t.label}</span>
                    <span className="text-osrs-parchment-dark/50 block truncate text-[11px]">
                      {TASK_TYPE_LABELS[t.type]}
                      {taskGoal(t) ? ` · ${taskGoal(t)}` : ""}
                    </span>
                  </span>
                  <span className="text-osrs-parchment-dark/60 shrink-0 text-xs">{t.points} pts</span>
                </button>
              </li>
            ))
          ) : (
            <li className="text-osrs-parchment-dark/50 px-3 py-2 text-xs">
              {tasks.length
                ? "No task matches that search."
                : "This event has no tasks yet — add one first."}
            </li>
          )}
          {matches.length > rows.length && (
            <li className="text-osrs-parchment-dark/50 px-3 py-2 text-xs">
              +{matches.length - rows.length} more — keep typing to narrow it down.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * The bound task, inline in a tile editor: its goal, its points (editable in
 * place) and the full task form on demand.
 *
 * Points are a property of the TASK, not of the tile — the API has no
 * per-tile override for an existing-task binding — so the field here writes
 * the task itself and says so. On a live event a scoring change needs the
 * retroactivity choice, exactly like the Tasks tab.
 */
export function BoundTaskPanel({
  groupId,
  eventId,
  task,
  editable,
  liveEvent = false,
  onTaskUpdated,
}: {
  groupId: number | null;
  eventId: number;
  task: EventTask;
  editable: boolean;
  liveEvent?: boolean;
  onTaskUpdated?: (task: EventTask) => void;
}) {
  const [points, setPoints] = useState(task.points);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Points value waiting on the live-event retroactivity choice. */
  const [retroFor, setRetroFor] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // Follow the task changing under us (another binding, or a full-form save).
  useEffect(() => {
    setPoints(task.points);
    setRetroFor(null);
    setError(null);
  }, [task.id, task.points]);

  const savePoints = async (next: number, retro?: "recompute" | "keep") => {
    setSaving(true);
    setError(null);
    try {
      const res = await updateEventTask(groupId, eventId, task.id, {
        points: next,
        ...(retro ? { retro } : {}),
      });
      if (!res.ok) {
        if (res.code === "retro_required") {
          setRetroFor(next);
          return;
        }
        setPoints(task.points);
        setError(res.error);
        return;
      }
      setRetroFor(null);
      onTaskUpdated?.({ ...task, points: next });
    } catch (err) {
      setPoints(task.points);
      setError(getErrorMessage(err, "Couldn't save the points. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const goal = taskGoal(task);

  return (
    <div className="border-osrs-bronze/30 bg-osrs-brown-dark/30 space-y-2 rounded border p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 text-sm">
          <span className="text-osrs-parchment-dark/50 mr-1.5 text-[11px] uppercase">
            {TASK_TYPE_LABELS[task.type]}
          </span>
          <span className="text-osrs-parchment/90">{task.label}</span>
          {goal && <span className="text-osrs-parchment-dark/60"> — {goal}</span>}
        </span>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          disabled={!editable}
          aria-expanded={formOpen}
          className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright shrink-0 rounded border px-2 py-1 text-xs disabled:opacity-50"
          title="Edit the task itself without leaving the board"
        >
          {formOpen ? "Close task editor" : "Edit this task"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs">
          <span className="text-osrs-parchment-dark/70">Points</span>
          <QuantityInput
            min={0}
            value={points}
            commitOn="blur"
            disabled={!editable || saving}
            onChange={(next) => {
              setPoints(next);
              if (next !== task.points) void savePoints(next);
            }}
            className={`${field} w-24 py-1`}
          />
        </label>
        <span className="text-osrs-parchment-dark/50 text-xs">
          {saving ? "Saving…" : "Scored from the task — this edits the task everywhere it is used."}
        </span>
      </div>

      {retroFor != null && (
        <div className="border-osrs-gold/40 bg-osrs-gold/5 space-y-1.5 rounded border p-2 text-xs">
          <p className="text-osrs-parchment-dark/80">
            Teams have already scored this task. Re-score their recorded progress at {retroFor}{" "}
            points, or leave existing scores alone and apply it going forward?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void savePoints(retroFor, "recompute")}
              disabled={saving}
              className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-2 py-1 font-medium disabled:opacity-50"
            >
              Re-score existing progress
            </button>
            <button
              type="button"
              onClick={() => void savePoints(retroFor, "keep")}
              disabled={saving}
              className="border-osrs-bronze/40 hover:border-osrs-gold rounded border px-2 py-1 disabled:opacity-50"
            >
              Apply going forward
            </button>
            <button
              type="button"
              onClick={() => {
                setRetroFor(null);
                setPoints(task.points);
              }}
              className="text-osrs-parchment-dark/70 hover:text-osrs-parchment px-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-osrs-red text-xs">{error}</p>}

      {formOpen && (
        <div className="border-osrs-bronze/20 border-t pt-2">
          <EventTaskFormWithAi
            groupId={groupId}
            eventId={eventId}
            initial={task}
            liveEvent={liveEvent}
            onSaved={(updated) => {
              onTaskUpdated?.(updated);
              setFormOpen(false);
            }}
            onCancel={() => setFormOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
