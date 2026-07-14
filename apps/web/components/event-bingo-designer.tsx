"use client";

/**
 * Bingo board designer (Task 20, events-prd.md B1). Admin-only Board section
 * of the event manager: size picker (re-grids, confirms on shrink), click-a-
 * cell editor binding cells to existing tasks / library presets / inline
 * custom tasks / free cells, bonus point fields. Read-only with a notice once
 * the event has started (the API answers 409 then too).
 *
 * Saving is automatic: every change debounces into a PUT (which replaces the
 * whole board), closing the cell editor flushes immediately, and a periodic
 * sweep retries anything still dirty. A revision counter guards the
 * post-save state refresh — the server response only replaces local cells
 * when nothing changed while the save was in flight and no editor is open,
 * so autosave never clobbers in-progress work. Re-saving un-refreshed state
 * is safe: the PUT garbage-collects auto-created tasks the new board no
 * longer references.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { QuantityInput } from "@/components/quantity-input";
import {
  saveEventBingo,
  searchEventTaskLibrary,
  updateGroupEvent,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";

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

function cellsFromEvent(event: EventDetail, size: number, tasks: EventTask[]): DesignerCell[] {
  const cells: DesignerCell[] = Array.from({ length: size * size }, () => ({ ...FREE_CELL }));
  if (event.bingo && event.bingo.size === size) {
    for (const c of event.bingo.cells) {
      if (c.index < cells.length) {
        // The API stores a *display* label on every cell (the bound task's
        // name, or "Free space" for unbound ones). Only a label that differs
        // from that derived value is a real custom label; importing derived
        // ones as custom froze the tile text — a cell once saved free kept
        // showing "Free space" no matter what task was bound afterwards.
        const derived =
          c.task_id != null
            ? (tasks.find((t) => t.id === c.task_id)?.label ?? "")
            : "Free space";
        const label = c.label.trim() === derived.trim() ? "" : c.label;
        cells[c.index] = { ...FREE_CELL, label, taskId: c.task_id ?? null };
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
  const [cells, setCells] = useState<DesignerCell[]>(() => cellsFromEvent(event, initialSize, tasks));
  const [selected, setSelected] = useState<number | null>(null);
  const [bonusLine, setBonusLine] = useState(String(event.bonus_line_points ?? 0));
  const [bonusBlackout, setBonusBlackout] = useState(String(event.bonus_blackout_points ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");

  // Autosave plumbing. `rev` bumps on every edit; `savedRev` is the last
  // revision persisted. Timers and the interval always call the freshest
  // flush via `flushRef` (assigned every render) so they never see stale
  // state. `savingRef` serializes PUTs — the completion handler reschedules
  // when edits arrived mid-flight.
  const revRef = useRef(0);
  const savedRevRef = useRef(0);
  const savingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => void>(() => {});
  const selectedRef = useRef<number | null>(null);
  const saveStateRef = useRef(saveState);

  const selectedCell = selected != null ? cells[selected] : undefined;

  const schedule = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flushRef.current(), 1500);
  };

  const markDirty = () => {
    revRef.current++;
    setSaveState("dirty");
    schedule();
  };

  const buildInput = (): BingoBoardInput => ({
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
  });

  const flush = async () => {
    if (!editable || savingRef.current) return;
    if (revRef.current === savedRevRef.current) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    savingRef.current = true;
    setSaveState("saving");
    const rev = revRef.current;
    const line = Number(bonusLine);
    const blackout = Number(bonusBlackout);
    const bonusValid =
      Number.isInteger(line) && line >= 0 && Number.isInteger(blackout) && blackout >= 0;
    const input = buildInput();
    try {
      if (
        bonusValid &&
        (line !== (event.bonus_line_points ?? 0) || blackout !== (event.bonus_blackout_points ?? 0))
      ) {
        await updateGroupEvent(groupId, event.id, {
          bonus_line_points: line,
          bonus_blackout_points: blackout,
        });
      }
      const detail = await saveEventBingo(groupId, event.id, input);
      savedRevRef.current = rev;
      setError(
        bonusValid
          ? null
          : "Bonus points must be non-negative whole numbers — the board was saved without them.",
      );
      if (revRef.current === rev) {
        // Only adopt the server's cells (library/custom picks become real
        // task bindings) when nothing changed mid-flight and no cell editor
        // is open — otherwise keep local state; a follow-up save converges.
        if (selectedRef.current == null) {
          setCells(cellsFromEvent(detail, detail.bingo?.size ?? size, detail.tasks));
        }
        setSaveState("saved");
      } else {
        setSaveState("dirty");
        schedule();
      }
      onSaved(detail);
    } catch (err) {
      setError(getErrorMessage(err, "Autosave failed. Your changes are kept locally — edit again or press Save now to retry."));
      setSaveState("error");
    } finally {
      savingRef.current = false;
    }
  };

  // Keep refs pointing at this render's values for timers/handlers.
  useEffect(() => {
    flushRef.current = flush;
    selectedRef.current = selected;
    saveStateRef.current = saveState;
  });

  // Periodic sweep: saves anything still dirty (e.g. a tab left idle with
  // the cell editor open). Deliberately skips the error state — errors retry
  // on the next edit or via the Save now button instead of looping.
  useEffect(() => {
    const id = setInterval(() => {
      if (saveStateRef.current === "dirty" && !savingRef.current) flushRef.current();
    }, 30_000);
    return () => {
      clearInterval(id);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Warn before the browser unloads with unsaved work (autosave narrows the
  // window to ~seconds, but a failed save could still be pending).
  const hasUnsaved = saveState === "dirty" || saveState === "saving" || saveState === "error";
  useEffect(() => {
    if (!hasUnsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsaved]);

  /** Closing the tile editor flushes right away — finishing a tile is the
   * natural "my edit is done" moment. */
  const closeEditor = () => {
    setSelected(null);
    // selectedRef updates after the re-render; the flush only reads it at
    // completion time, so kicking it off now is safe.
    flushRef.current();
  };

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
    markDirty();
  };

  const updateCell = (idx: number, patch: Partial<DesignerCell>) => {
    setCells((prev) => prev.map((cell, i) => (i === idx ? { ...cell, ...patch } : cell)));
    markDirty();
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
              markDirty();
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
              markDirty();
            }}
            className={`${field} w-28`}
            title="Points for completing the whole board. 0 disables."
          />
        </label>
        <div className="flex items-center gap-3 pb-2">
          <button
            onClick={() => flushRef.current()}
            disabled={saveState === "saving" || saveState === "saved" || saveState === "idle"}
            className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border px-3 py-2 text-sm disabled:opacity-50"
            title="Changes save automatically — this forces an immediate save"
          >
            Save now
          </button>
          <SaveStatus state={saveState} />
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
        {cells.map((cell, idx) => {
          const isFree = cell.taskId == null && !cell.library && !cell.newTask;
          const isSelected = selected === idx;
          return (
            <button
              key={idx}
              onClick={() => (isSelected ? closeEditor() : setSelected(idx))}
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
        <CellEditorModal onClose={closeEditor}>
          <CellEditor
            key={selected}
            groupId={groupId}
            idx={selected}
            size={size}
            cell={selectedCell}
            tasks={tasks}
            onChange={(patch) => updateCell(selected, patch)}
            onClose={closeEditor}
          />
        </CellEditorModal>
      )}
      <p className="text-osrs-parchment-dark/50 text-xs">
        Click a cell to bind it to a task, pick one from the library, or leave it free. Free cells
        complete for every team the moment the event starts. Changes save automatically.
      </p>
    </div>
  );
}

function SaveStatus({ state }: { state: "idle" | "dirty" | "saving" | "saved" | "error" }) {
  if (state === "idle") {
    return <span className="text-osrs-parchment-dark/50 text-xs">Autosaves as you edit</span>;
  }
  if (state === "saving") {
    return <span className="text-osrs-parchment-dark/70 text-sm">Saving…</span>;
  }
  if (state === "saved") {
    return <span className="text-osrs-green text-sm">All changes saved ✓</span>;
  }
  if (state === "error") {
    return <span className="text-osrs-red text-sm">Autosave failed</span>;
  }
  return <span className="text-osrs-parchment-dark/70 text-sm">Unsaved changes…</span>;
}

/** Floating card for the cell editor, so configuring a tile doesn't require
 * scrolling beneath the board. Backdrop click and Escape both close it (the
 * cell edits apply live to board state, so closing never loses work). */
function CellEditorModal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configure bingo cell"
        className="card-pop menu-in relative max-h-[85vh] w-full max-w-2xl overflow-y-auto p-4"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function CellEditor({
  groupId,
  idx,
  size,
  cell,
  tasks,
  onChange,
  onClose,
}: {
  groupId: number | null;
  idx: number;
  size: number;
  cell: DesignerCell;
  tasks: EventTask[];
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
    <div className="space-y-3">
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
          className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border px-2 py-1 text-xs"
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
                      className={`hover:bg-osrs-bronze/10 flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm ${
                        cell.library?.id === item.id ? "bg-osrs-bronze/15" : ""
                      }`}
                    >
                      <span>
                        {item.name}
                        <span className="text-osrs-parchment-dark/50 ml-2 text-xs uppercase">
                          {TASK_TYPE_LABELS[item.type]}
                        </span>
                        {/* item.difficulty (air/water/earth/fire) is the legacy
                            BoardGame tier — meaningless for bingo, so not shown.
                            Future board-style event types may surface it again. */}
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
              <QuantityInput
                min={0}
                value={cell.points ?? cell.library.default_points}
                onChange={(points) => onChange({ points })}
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
            disabled={!custom.label.trim()}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Use task
          </button>
        </div>
      )}
    </div>
  );
}
