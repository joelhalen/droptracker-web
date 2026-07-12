"use client";

/**
 * Bingo board designer (Task 20, events-prd.md B1). Admin-only Board section
 * of the event manager: size picker (re-grids, confirms on shrink), click-a-
 * cell editor binding cells to existing tasks / library presets / inline
 * custom tasks / free cells, bonus point fields, one PUT on save. Read-only
 * with a notice once the event has started (the API answers 409 then too).
 */
import { useState, useTransition } from "react";
import {
  EVENT_BOARD_SIZES,
  EVENT_TASK_TYPES,
  type BingoBoardInput,
  type BingoCellInput,
  type EventDetail,
  type EventTask,
  type EventTaskLibraryItem,
} from "@droptracker/api-types";
import { TASK_TYPE_LABELS } from "@/lib/events";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";
import {
  saveEventBingo,
  searchEventTaskLibrary,
  updateGroupEvent,
} from "@/app/(admin)/groups/[id]/events/actions";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-2 text-sm outline-none";

type CustomTaskDraft = {
  type: EventTask["type"];
  label: string;
  target: string;
  targetValue: string;
  points: string;
};

/** Local editing model for one cell. Exactly one binding (or none = free). */
type DesignerCell = {
  label: string;
  taskId: number | null;
  library: EventTaskLibraryItem | null;
  /** Points override for a library pick. */
  points: number | null;
  newTask: { type: EventTask["type"]; label: string; target?: string; target_value?: number; points: number } | null;
};

const FREE_CELL: DesignerCell = { label: "", taskId: null, library: null, points: null, newTask: null };

function cellsFromEvent(event: EventDetail, size: number): DesignerCell[] {
  const cells: DesignerCell[] = Array.from({ length: size * size }, () => ({ ...FREE_CELL }));
  if (event.bingo && event.bingo.size === size) {
    for (const c of event.bingo.cells) {
      if (c.index < cells.length) {
        cells[c.index] = { ...FREE_CELL, label: c.label, taskId: c.task_id ?? null };
      }
    }
  }
  return cells;
}

/** Re-grid to a new size, keeping cells whose (row, col) still fit. */
function regrid(cells: DesignerCell[], oldSize: number, newSize: number): DesignerCell[] {
  const next: DesignerCell[] = Array.from({ length: newSize * newSize }, () => ({ ...FREE_CELL }));
  for (let r = 0; r < Math.min(oldSize, newSize); r++) {
    for (let c = 0; c < Math.min(oldSize, newSize); c++) {
      const cell = cells[r * oldSize + c];
      if (cell) next[r * newSize + c] = cell;
    }
  }
  return next;
}

function cellBindingSummary(cell: DesignerCell, tasks: EventTask[]): string {
  if (cell.taskId != null) {
    const task = tasks.find((t) => t.id === cell.taskId);
    return task ? `Task: ${task.label}` : `Task #${cell.taskId}`;
  }
  if (cell.library) return `Library: ${cell.library.name}`;
  if (cell.newTask) return `New ${TASK_TYPE_LABELS[cell.newTask.type]} task`;
  return "Free cell";
}

function cellDisplayLabel(cell: DesignerCell, tasks: EventTask[]): string {
  if (cell.label.trim()) return cell.label.trim();
  if (cell.taskId != null) return tasks.find((t) => t.id === cell.taskId)?.label ?? `Task #${cell.taskId}`;
  if (cell.library) return cell.library.name;
  if (cell.newTask) return cell.newTask.label;
  return "Free";
}

/** Mirrors the API's edit gate: draft, or never activated with a start still
 * in the future. Task 21's explicit lifecycle tightens this to draft-only. */
export function boardEditable(event: EventDetail): boolean {
  if (event.status === "draft") return true;
  const now = Math.floor(Date.now() / 1000);
  return event.activated_at == null && (event.starts_at == null || event.starts_at > now);
}

export function EventBingoDesigner({
  groupId,
  event,
  tasks,
  onSaved,
}: {
  groupId: number | null;
  event: EventDetail;
  tasks: EventTask[];
  /** Fired with the refreshed detail after a successful save (the PUT can
   * create/delete tasks, so the whole manager state refreshes). */
  onSaved: (detail: EventDetail) => void;
}) {
  const editable = boardEditable(event);
  const initialSize = event.bingo?.size && event.bingo.size >= 3 ? event.bingo.size : (event.board_size ?? 5);
  const [size, setSize] = useState<number>(initialSize);
  const [cells, setCells] = useState<DesignerCell[]>(() => cellsFromEvent(event, initialSize));
  const [selected, setSelected] = useState<number | null>(null);
  const [bonusLine, setBonusLine] = useState(String(event.bonus_line_points ?? 0));
  const [bonusBlackout, setBonusBlackout] = useState(String(event.bonus_blackout_points ?? 0));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const selectedCell = selected != null ? cells[selected] : undefined;

  const onSizeChange = (next: number) => {
    if (next === size) return;
    if (next < size) {
      const dropped = cells.some((cell, i) => {
        const r = Math.floor(i / size);
        const c = i % size;
        const bound = cell.taskId != null || cell.library || cell.newTask || cell.label.trim();
        return bound && (r >= next || c >= next);
      });
      if (
        dropped &&
        !window.confirm(`Shrinking to ${next}×${next} removes the cells outside the new grid. Continue?`)
      ) {
        return;
      }
    }
    setCells((prev) => regrid(prev, size, next));
    setSize(next);
    setSelected(null);
  };

  const updateCell = (idx: number, patch: Partial<DesignerCell>) => {
    setCells((prev) => prev.map((cell, i) => (i === idx ? { ...cell, ...patch } : cell)));
    setSaved(false);
  };

  const onSave = () => {
    setError(null);
    const line = Number(bonusLine);
    const blackout = Number(bonusBlackout);
    if (!Number.isInteger(line) || line < 0 || !Number.isInteger(blackout) || blackout < 0) {
      setError("Bonus points must be non-negative whole numbers.");
      return;
    }
    const input: BingoBoardInput = {
      size,
      cells: cells.map((cell, idx): BingoCellInput => {
        const out: BingoCellInput = { idx };
        const label = cell.label.trim();
        if (label) out.label = label;
        if (cell.taskId != null) out.task_id = cell.taskId;
        else if (cell.library) {
          out.library_item_id = cell.library.id;
          if (cell.points != null) out.points = cell.points;
        } else if (cell.newTask) {
          out.new_task = {
            type: cell.newTask.type,
            label: cell.newTask.label,
            target: cell.newTask.target || undefined,
            target_value: cell.newTask.target_value,
            points: cell.newTask.points,
          };
        }
        return out;
      }),
    };
    startTransition(async () => {
      try {
        if (line !== (event.bonus_line_points ?? 0) || blackout !== (event.bonus_blackout_points ?? 0)) {
          await updateGroupEvent(groupId, event.id, {
            bonus_line_points: line,
            bonus_blackout_points: blackout,
          });
        }
        const detail = await saveEventBingo(groupId, event.id, input);
        setSaved(true);
        setSelected(null);
        onSaved(detail);
        setCells(cellsFromEvent(detail, detail.bingo?.size ?? size));
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save the board. Please try again."));
      }
    });
  };

  if (!editable) {
    return (
      <div className="space-y-3">
        <Alert variant="info">
          The event has started, so the bingo board is locked. Cell completions now come from the
          engine and the Review queue.
        </Alert>
        {event.bingo ? (
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${event.bingo.size}, minmax(0, 1fr))` }}
          >
            {event.bingo.cells.map((cell) => (
              <div
                key={cell.index}
                className="border-osrs-bronze/30 bg-osrs-brown-dark/40 text-osrs-parchment-dark/80 flex aspect-square flex-col items-center justify-center rounded border p-1 text-center text-[11px] leading-tight"
              >
                <span className="line-clamp-3">{cell.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-osrs-parchment-dark/60 text-sm">No board was configured for this event.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="block text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Board size</span>
          <select
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            className={field}
            disabled={pending}
          >
            {EVENT_BOARD_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} × {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Line bonus (pts)</span>
          <input
            type="number"
            min={0}
            value={bonusLine}
            onChange={(e) => {
              setBonusLine(e.target.value);
              setSaved(false);
            }}
            className={`${field} w-28`}
            title="Points a team earns for each completed row/column/diagonal. 0 disables."
          />
        </label>
        <label className="block text-sm">
          <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Blackout bonus (pts)</span>
          <input
            type="number"
            min={0}
            value={bonusBlackout}
            onChange={(e) => {
              setBonusBlackout(e.target.value);
              setSaved(false);
            }}
            className={`${field} w-28`}
            title="Points for completing the whole board. 0 disables."
          />
        </label>
        <button
          onClick={onSave}
          disabled={pending}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save board"}
        </button>
        {saved && !pending && <span className="text-osrs-green text-sm">Saved ✓</span>}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
        {cells.map((cell, idx) => {
          const isFree = cell.taskId == null && !cell.library && !cell.newTask;
          const isSelected = selected === idx;
          return (
            <button
              key={idx}
              onClick={() => setSelected(isSelected ? null : idx)}
              title={cellBindingSummary(cell, tasks)}
              className={`flex aspect-square flex-col items-center justify-center rounded border p-1 text-center text-[11px] leading-tight transition-colors ${
                isSelected
                  ? "border-osrs-gold bg-osrs-gold/10 text-osrs-parchment"
                  : isFree
                    ? "border-osrs-bronze/20 bg-osrs-brown-dark/20 text-osrs-parchment-dark/50"
                    : "border-osrs-bronze/40 bg-osrs-brown-dark/40 text-osrs-parchment-dark/90 hover:border-osrs-gold/60"
              }`}
            >
              <span className="line-clamp-3">{cellDisplayLabel(cell, tasks)}</span>
              {isFree && <span className="mt-0.5 text-[9px] uppercase opacity-60">free</span>}
            </button>
          );
        })}
      </div>

      {selected != null && selectedCell && (
        <CellEditor
          key={selected}
          groupId={groupId}
          idx={selected}
          size={size}
          cell={selectedCell}
          tasks={tasks}
          pending={pending}
          onChange={(patch) => updateCell(selected, patch)}
          onClose={() => setSelected(null)}
        />
      )}
      <p className="text-osrs-parchment-dark/50 text-xs">
        Click a cell to bind it to a task, pick one from the library, or leave it free. Free cells
        complete for every team the moment the event starts. Saving replaces the whole board.
      </p>
    </div>
  );
}

function CellEditor({
  groupId,
  idx,
  size,
  cell,
  tasks,
  pending,
  onChange,
  onClose,
}: {
  groupId: number | null;
  idx: number;
  size: number;
  cell: DesignerCell;
  tasks: EventTask[];
  pending: boolean;
  onChange: (patch: Partial<DesignerCell>) => void;
  onClose: () => void;
}) {
  const row = Math.floor(idx / size);
  const col = idx % size;
  const [tab, setTab] = useState<"library" | "existing" | "custom">("library");

  // Library search state.
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [results, setResults] = useState<EventTaskLibraryItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [custom, setCustom] = useState<CustomTaskDraft>({
    type: "item_collection",
    label: "",
    target: "",
    targetValue: "",
    points: "0",
  });

  const doSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSearching(true);
    setSearchError(null);
    try {
      const found = await searchEventTaskLibrary(groupId, {
        query: query.trim() || undefined,
        type: typeFilter || undefined,
      });
      setResults(found);
    } catch (err) {
      setSearchError(getErrorMessage(err, "Library search failed. Please try again."));
    } finally {
      setSearching(false);
    }
  };

  const useCustom = () => {
    if (!custom.label.trim()) return;
    const targetValue = custom.targetValue.trim() ? Number(custom.targetValue) : undefined;
    const points = Number(custom.points) || 0;
    onChange({
      taskId: null,
      library: null,
      points: null,
      newTask: {
        type: custom.type,
        label: custom.label.trim(),
        target: custom.target.trim() || undefined,
        target_value: Number.isInteger(targetValue) && targetValue! >= 0 ? targetValue : undefined,
        points: Number.isInteger(points) && points >= 0 ? points : 0,
      },
    });
  };

  const tabBtn = (key: typeof tab, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={`rounded px-2 py-1 text-xs ${
        tab === key
          ? "bg-osrs-bronze/30 text-osrs-gold-bright"
          : "text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="border-osrs-bronze/30 space-y-3 rounded border p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-osrs-gold text-sm font-semibold">
          Cell {idx} <span className="text-osrs-parchment-dark/50 font-normal">(row {row + 1}, col {col + 1})</span>
          <span className="text-osrs-parchment-dark/60 ml-2 font-normal">— {cellBindingSummary(cell, tasks)}</span>
        </h4>
        <button onClick={onClose} className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm">
          Close
        </button>
      </div>

      <label className="block text-sm">
        <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
          Cell label (optional — defaults to the task name)
        </span>
        <input
          value={cell.label}
          onChange={(e) => onChange({ label: e.target.value })}
          maxLength={255}
          placeholder="e.g. Any Barrows piece"
          className={`${field} w-full`}
        />
      </label>

      <div className="flex items-center gap-2">
        {tabBtn("library", "Task library")}
        {tabBtn("existing", "Existing task")}
        {tabBtn("custom", "Custom task")}
        <span className="grow" />
        <button
          onClick={() => onChange({ taskId: null, library: null, newTask: null, points: null })}
          disabled={pending}
          className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border px-2 py-1 text-xs disabled:opacity-50"
          title="Label-only cell that counts as completed for every team from the start"
        >
          Make free cell
        </button>
      </div>

      {tab === "library" && (
        <div className="space-y-2">
          <form onSubmit={doSearch} className="flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search presets by name…"
              className={`${field} min-w-40 flex-1`}
            />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={field}>
              <option value="">All types</option>
              {EVENT_TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TASK_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={searching}
              className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border px-3 py-2 text-sm disabled:opacity-50"
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          {searchError && <p className="text-osrs-red text-xs">{searchError}</p>}
          {results && (
            <ul className="border-osrs-bronze/20 max-h-56 overflow-y-auto rounded border">
              {results.length ? (
                results.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() =>
                        onChange({
                          library: item,
                          taskId: null,
                          newTask: null,
                          points: item.default_points,
                        })
                      }
                      disabled={pending}
                      className={`hover:bg-osrs-bronze/10 flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm disabled:opacity-50 ${
                        cell.library?.id === item.id ? "bg-osrs-bronze/15" : ""
                      }`}
                    >
                      <span>
                        {item.name}
                        <span className="text-osrs-parchment-dark/50 ml-2 text-xs uppercase">
                          {TASK_TYPE_LABELS[item.type]}
                        </span>
                        {item.difficulty && (
                          <span className="text-osrs-gold-bright/70 ml-2 text-xs capitalize">{item.difficulty}</span>
                        )}
                        {item.visibility === "private" && (
                          <span
                            className="border-osrs-bronze/40 text-osrs-parchment-dark/70 ml-2 rounded border px-1 text-[10px] uppercase"
                            title="Saved privately by your clan — other clans can't see it"
                          >
                            private
                          </span>
                        )}
                      </span>
                      <span className="text-osrs-parchment-dark/60 shrink-0 text-xs">
                        {item.default_points} pts
                      </span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="text-osrs-parchment-dark/50 px-3 py-2 text-xs">No matching presets.</li>
              )}
            </ul>
          )}
          {cell.library && (
            <label className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                Points for “{cell.library.name}”
              </span>
              <input
                type="number"
                min={0}
                value={cell.points ?? cell.library.default_points}
                onChange={(e) => onChange({ points: Math.max(0, Number(e.target.value) || 0) })}
                className={`${field} w-28`}
              />
            </label>
          )}
        </div>
      )}

      {tab === "existing" && (
        <div className="space-y-1">
          {tasks.length ? (
            <select
              value={cell.taskId ?? ""}
              onChange={(e) =>
                onChange({
                  taskId: e.target.value ? Number(e.target.value) : null,
                  library: null,
                  newTask: null,
                  points: null,
                })
              }
              className={`${field} w-full`}
            >
              <option value="">— pick a task already on this event —</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {TASK_TYPE_LABELS[t.type]}: {t.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-osrs-parchment-dark/50 text-xs">
              This event has no tasks yet — add one in the Tasks section, or use the library/custom
              options here.
            </p>
          )}
        </div>
      )}

      {tab === "custom" && (
        <div className="grid gap-2 sm:grid-cols-[9rem_1fr_8rem_6rem_5rem_auto]">
          <select
            value={custom.type}
            onChange={(e) => setCustom((c) => ({ ...c, type: e.target.value as EventTask["type"] }))}
            className={field}
          >
            {EVENT_TASK_TYPES.map((t) => (
              <option key={t} value={t}>
                {TASK_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <input
            value={custom.label}
            onChange={(e) => setCustom((c) => ({ ...c, label: e.target.value }))}
            placeholder="Label"
            className={field}
          />
          <input
            value={custom.target}
            onChange={(e) => setCustom((c) => ({ ...c, target: e.target.value }))}
            placeholder="Target"
            className={field}
          />
          <input
            type="number"
            min={0}
            value={custom.targetValue}
            onChange={(e) => setCustom((c) => ({ ...c, targetValue: e.target.value }))}
            placeholder="Goal #"
            className={field}
          />
          <input
            type="number"
            min={0}
            value={custom.points}
            onChange={(e) => setCustom((c) => ({ ...c, points: e.target.value }))}
            placeholder="Pts"
            className={field}
          />
          <button
            onClick={useCustom}
            disabled={pending || !custom.label.trim()}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Use task
          </button>
        </div>
      )}
    </div>
  );
}
