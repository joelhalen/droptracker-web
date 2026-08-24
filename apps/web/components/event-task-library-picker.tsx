"use client";

/**
 * Copy task-library presets into an event.
 *
 * The library mixes curated presets with tasks other clans shared publicly
 * and this clan's own private saves (the API already scopes what the viewer
 * may see); picking one copies it in as an ordinary event task the admin can
 * edit or delete afterwards. The bingo designer has its own picker (cells bind
 * `library_item_id` server-side) — this component is for the flat tasks list.
 *
 * Three ways in, cheapest first:
 *
 *  - **Stock by difficulty** (board-game events): "give me 10 easy, 10 medium,
 *    …" in one request. A dice board rolls each tile's task from its tier's
 *    pool, so a board needs *pools*, not a handful of tasks — and building one
 *    at one-click-per-task is why boards shipped under-stocked.
 *  - **Multi-select**: tick several rows, add them together.
 *  - **Add** on a single row (the original one-at-a-time path).
 *
 * Browsing UX: the whole library lists as soon as the picker opens; type,
 * difficulty and the search box all filter live, and "Load more" pages through
 * whatever the filter matches.
 */

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  EVENT_TASK_DIFFICULTIES,
  EVENT_TASK_TYPES,
  type EventTask,
  type EventTaskDifficulty,
  type EventTaskLibraryItem,
} from "@droptracker/api-types";
import { TASK_DIFFICULTY_LABELS, TASK_TYPE_LABELS } from "@/lib/events";
import { getErrorMessage } from "@/lib/errors";
import { QuantityInput } from "@/components/quantity-input";
import {
  addEventTask,
  addEventTasksFromLibrary,
  searchEventTaskLibraryPage,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";

const field =
  "bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-osrs-gold/60";

// Mirrors the API's page size (web_api/routes/event_admin.py _LIBRARY_PAGE_SIZE):
// a full page means there may be more to load.
const PAGE_SIZE = 50;

/** Matches the backend's `_MAX_BULK_LIBRARY_TASKS`. */
const MAX_BULK = 100;

type TierCounts = Partial<Record<EventTaskDifficulty, number>>;

/** "Stock the pools" panel: a count per difficulty tier, added in one request. */
function StockByDifficulty({
  counts,
  available,
  busy,
  onChange,
  onSubmit,
}: {
  counts: TierCounts;
  available: TierCounts;
  busy: boolean;
  onChange: (tier: EventTaskDifficulty, value: number) => void;
  onSubmit: () => void;
}) {
  const total = EVENT_TASK_DIFFICULTIES.reduce((sum, d) => sum + (counts[d] ?? 0), 0);
  const over = total > MAX_BULK;
  return (
    <div className="border-osrs-bronze/25 bg-osrs-brown-dark/40 grid gap-2 rounded p-3">
      <div>
        <h5 className="text-osrs-gold text-xs font-semibold">Stock the difficulty pools</h5>
        <p className="text-osrs-parchment-dark/60 mt-0.5 text-[11px]">
          Board tiles roll a random task from their tier&apos;s pool, so each tier wants several
          tasks. Presets already in this event are skipped, so you can top a pool up later.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {EVENT_TASK_DIFFICULTIES.map((d) => {
          const have = available[d] ?? 0;
          return (
            <label key={d} className="block text-sm">
              <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                {TASK_DIFFICULTY_LABELS[d]}
                <span className="text-osrs-parchment-dark/40"> · {have} available</span>
              </span>
              <QuantityInput
                min={0}
                max={Math.min(have, MAX_BULK)}
                value={counts[d] ?? 0}
                emptyAs={0}
                disabled={have === 0}
                onChange={(n) => onChange(d, n)}
                placeholder="0"
                aria-label={`${TASK_DIFFICULTY_LABELS[d]} tasks to add`}
                className={`${field} w-20 text-right disabled:opacity-40`}
              />
            </label>
          );
        })}
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || total === 0 || over}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Adding…" : total > 0 ? `Add ${total} task${total === 1 ? "" : "s"}` : "Add tasks"}
        </button>
      </div>
      {over && (
        <p className="text-osrs-red text-xs">
          At most {MAX_BULK} tasks can be added at once — currently {total}.
        </p>
      )}
    </div>
  );
}

export function EventTaskLibraryPicker({
  groupId,
  eventId,
  isBoardGame = false,
  onAdded,
  onBulkAdded,
  onClose,
}: {
  groupId: number | null;
  eventId: number;
  /** Board-game events open on the "stock the pools" panel — their tiles roll
   * from per-tier pools, so bulk is the normal path, not the exception. */
  isBoardGame?: boolean;
  onAdded: (task: EventTask) => void;
  /** Many tasks at once (bulk copy). Falls back to repeated `onAdded` if the
   * host doesn't handle batches. */
  onBulkAdded?: (tasks: EventTask[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [items, setItems] = useState<EventTaskLibraryItem[] | null>(null);
  const [tierCounts, setTierCounts] = useState<TierCounts>({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [stock, setStock] = useState<TierCounts>({});
  const [showStock, setShowStock] = useState(isBoardGame);
  const [pending, startTransition] = useTransition();

  // Debounce the search box so typing filters live without a request per key.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(
    async (pageNum: number, replace: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const found = await searchEventTaskLibraryPage(groupId, {
          query: debouncedQuery || undefined,
          type: typeFilter || undefined,
          difficulty: difficultyFilter || undefined,
          page: pageNum,
        });
        setItems((prev) => (replace || !prev ? found.items : [...prev, ...found.items]));
        setHasMore(found.items.length === PAGE_SIZE);
        setPage(pageNum);
        // Counts only come back on an unfiltered-by-tier read; keep the last
        // known set so switching the tier filter doesn't blank the panel.
        if (!difficultyFilter) setTierCounts(found.difficulty_counts as TierCounts);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't load the task library. Please try again."));
      } finally {
        setLoading(false);
      }
    },
    [groupId, debouncedQuery, typeFilter, difficultyFilter],
  );

  // List everything on open, and re-list from page 1 whenever a filter changes.
  useEffect(() => {
    load(1, true);
  }, [load]);

  const emitCreated = useCallback(
    (tasks: EventTask[]) => {
      if (onBulkAdded) onBulkAdded(tasks);
      else tasks.forEach(onAdded);
    },
    [onAdded, onBulkAdded],
  );

  const reportBulk = (created: number, skipped: string[]) => {
    const parts = [`Added ${created} task${created === 1 ? "" : "s"}.`];
    if (skipped.length) {
      parts.push(
        `Skipped ${skipped.length} already in this event or no longer valid` +
          (skipped.length <= 4 ? `: ${skipped.join(", ")}.` : "."),
      );
    }
    setNotice(parts.join(" "));
  };

  const copyIn = (item: EventTaskLibraryItem) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const input = {
          type: item.type,
          label: item.name,
          target: item.target ?? undefined,
          target_value: item.target_value ?? undefined,
          points: item.default_points,
          config: item.config ?? undefined,
          // Board-game tier rides along so difficulty-tile roll pools see
          // the copied task (web44a).
          ...(item.difficulty ? { difficulty: item.difficulty } : {}),
          // The copy is this event's own PRIVATE task, fully independent of
          // the template it came from: editing it later must never rewrite
          // the shared library row other clans pick from. (The API also
          // dedupes by requirements, so the copy never duplicates the
          // library entry itself.)
          visibility: "private" as const,
        };
        const res = await addEventTask(groupId, eventId, input);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        onAdded({
          ...input,
          id: res.id,
          visibility: res.visibility ?? input.visibility,
          target: input.target ?? null,
          target_value: input.target_value ?? null,
          config: input.config ?? null,
          requires_confirmation: false,
        });
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't add the task. Please try again."));
      }
    });
  };

  const addSelected = () => {
    if (!selected.size) return;
    setError(null);
    setNotice(null);
    const ids = [...selected];
    startTransition(async () => {
      const res = await addEventTasksFromLibrary(groupId, eventId, { library_item_ids: ids });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      emitCreated(res.created);
      setSelected(new Set());
      reportBulk(res.created.length, res.skipped);
    });
  };

  const addStock = () => {
    const picks = EVENT_TASK_DIFFICULTIES.map((d) => ({
      difficulty: d,
      count: stock[d] ?? 0,
    })).filter((p) => p.count > 0);
    if (!picks.length) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await addEventTasksFromLibrary(groupId, eventId, {
        picks,
        type: (typeFilter || undefined) as never,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      emitCreated(res.created);
      setStock({});
      reportBulk(res.created.length, res.skipped);
    });
  };

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allShownSelected = useMemo(
    () => !!items?.length && items.every((i) => selected.has(i.id)),
    [items, selected],
  );

  const toggleAllShown = () =>
    setSelected((prev) => {
      if (!items) return prev;
      const next = new Set(prev);
      if (allShownSelected) items.forEach((i) => next.delete(i.id));
      else items.slice(0, MAX_BULK).forEach((i) => next.add(i.id));
      return next;
    });

  return (
    <div className="border-osrs-bronze/25 bg-osrs-brown-dark/30 grid gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-osrs-gold text-sm font-semibold">Add tasks from the library</h4>
        <button
          type="button"
          onClick={onClose}
          className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm"
        >
          Close
        </button>
      </div>
      <p className="text-osrs-parchment-dark/60 text-xs">
        Curated presets, tasks other clans shared publicly, and your clan&apos;s private saves.
      </p>

      {error && <p className="text-osrs-red text-xs">{error}</p>}
      {notice && <p className="text-osrs-green text-xs">{notice}</p>}

      {showStock ? (
        <StockByDifficulty
          counts={stock}
          available={tierCounts}
          busy={pending}
          onChange={(tier, value) => setStock((prev) => ({ ...prev, [tier]: value }))}
          onSubmit={addStock}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowStock(true)}
          className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright self-start rounded border px-3 py-1.5 text-xs"
        >
          Stock by difficulty instead…
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name…"
          aria-label="Filter tasks by name"
          className={`${field} min-w-40 flex-1`}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter tasks by type"
          className={field}
        >
          <option value="">All types</option>
          {EVENT_TASK_TYPES.map((t) => (
            <option key={t} value={t}>
              {TASK_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={difficultyFilter}
          onChange={(e) => setDifficultyFilter(e.target.value)}
          aria-label="Filter tasks by difficulty"
          className={field}
        >
          <option value="">All difficulties</option>
          {EVENT_TASK_DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {TASK_DIFFICULTY_LABELS[d]}
              {tierCounts[d] != null ? ` (${tierCounts[d]})` : ""}
            </option>
          ))}
        </select>
      </div>

      {items !== null && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-osrs-parchment-dark/70 flex cursor-pointer items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={allShownSelected}
              onChange={toggleAllShown}
              className="size-3.5"
            />
            Select all {items.length} shown
          </label>
          <button
            type="button"
            onClick={addSelected}
            disabled={pending || selected.size === 0}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1 text-xs font-medium disabled:opacity-40"
          >
            {pending
              ? "Adding…"
              : `Add ${selected.size || ""} selected`.replace("  ", " ").trim()}
          </button>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-xs"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {items === null ? (
        <p className="text-osrs-parchment-dark/50 px-1 py-2 text-xs">Loading the task library…</p>
      ) : (
        <ul className="border-osrs-bronze/20 max-h-72 overflow-y-auto rounded border">
          {items.length ? (
            items.map((item) => (
              <li
                key={item.id}
                className="hover:bg-osrs-bronze/10 flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggle(item.id)}
                    className="size-3.5 shrink-0"
                    aria-label={`Select ${item.name}`}
                  />
                  <span className="min-w-0">
                    {item.name}
                    <span className="text-osrs-parchment-dark/50 ml-2 text-xs uppercase">
                      {TASK_TYPE_LABELS[item.type]}
                    </span>
                    {/* The board-game tier: which difficulty pool a tile rolls
                        this task from. */}
                    {item.difficulty && (
                      <span className="border-osrs-bronze/40 text-osrs-parchment-dark/70 ml-2 rounded border px-1 text-[10px] uppercase">
                        {TASK_DIFFICULTY_LABELS[item.difficulty]}
                      </span>
                    )}
                    {item.visibility === "private" && (
                      <span
                        className="border-osrs-bronze/40 text-osrs-parchment-dark/70 ml-2 rounded border px-1 text-[10px] uppercase"
                        title="Saved privately by your clan — other clans can't see it"
                      >
                        private
                      </span>
                    )}
                    {item.description && (
                      <span className="text-osrs-parchment-dark/50 ml-2 text-xs">
                        {item.description}
                      </span>
                    )}
                  </span>
                </label>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-osrs-parchment-dark/60 text-xs">
                    {item.default_points} pts
                  </span>
                  <button
                    type="button"
                    onClick={() => copyIn(item)}
                    disabled={pending}
                    className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-2 py-1 text-xs font-medium disabled:opacity-50"
                  >
                    Add
                  </button>
                </span>
              </li>
            ))
          ) : (
            <li className="text-osrs-parchment-dark/50 px-3 py-2 text-xs">
              {loading ? "Loading…" : "No tasks match your filters."}
            </li>
          )}
        </ul>
      )}

      {items !== null && hasMore && (
        <button
          type="button"
          onClick={() => load(page + 1, false)}
          disabled={loading}
          className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright self-start rounded border px-3 py-1.5 text-xs disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
