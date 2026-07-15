"use client";

/**
 * Copy a task-library preset into an event as a regular (non-bingo) task.
 *
 * The library mixes curated presets with tasks other clans shared publicly
 * and this clan's own private saves (the API already scopes what the viewer
 * may see); picking one POSTs a full EventTaskInput built from the preset, so
 * the copy is an ordinary event task the admin can edit or delete afterwards.
 * The bingo designer has its own picker (cells bind `library_item_id`
 * server-side) — this component is for the flat tasks list.
 *
 * Browsing UX: the whole library is listed as soon as the picker opens (no
 * search required); the type dropdown and the search box both filter live, and
 * "Load more" pages through everything the filter matches.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  EVENT_TASK_TYPES,
  type EventTask,
  type EventTaskLibraryItem,
} from "@droptracker/api-types";
import { TASK_TYPE_LABELS } from "@/lib/events";
import { getErrorMessage } from "@/lib/errors";
import {
  addEventTask,
  searchEventTaskLibrary,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";

const field =
  "bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-osrs-gold/60";

// Mirrors the API's page size (web_api/routes/event_admin.py _LIBRARY_PAGE_SIZE):
// a full page means there may be more to load.
const PAGE_SIZE = 50;

export function EventTaskLibraryPicker({
  groupId,
  eventId,
  onAdded,
  onClose,
}: {
  groupId: number | null;
  eventId: number;
  onAdded: (task: EventTask) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [items, setItems] = useState<EventTaskLibraryItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        const found = await searchEventTaskLibrary(groupId, {
          query: debouncedQuery || undefined,
          type: typeFilter || undefined,
          page: pageNum,
        });
        setItems((prev) => (replace || !prev ? found : [...prev, ...found]));
        setHasMore(found.length === PAGE_SIZE);
        setPage(pageNum);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't load the task library. Please try again."));
      } finally {
        setLoading(false);
      }
    },
    [groupId, debouncedQuery, typeFilter],
  );

  // List everything on open, and re-list from page 1 whenever a filter changes.
  useEffect(() => {
    load(1, true);
  }, [load]);

  const copyIn = (item: EventTaskLibraryItem) => {
    setError(null);
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
          // The copy is this event's own task. "public" is the sitewide
          // default; the API dedupes by requirements, so re-sharing a preset
          // that already exists never creates a second public library row.
          visibility: "public" as const,
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

  return (
    <div className="border-osrs-bronze/25 bg-osrs-brown-dark/30 grid gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-osrs-gold text-sm font-semibold">Copy a task from the library</h4>
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
      </div>
      {error && <p className="text-osrs-red text-xs">{error}</p>}

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
                <span>
                  {item.name}
                  <span className="text-osrs-parchment-dark/50 ml-2 text-xs uppercase">
                    {TASK_TYPE_LABELS[item.type]}
                  </span>
                  {/* item.difficulty (air/water/earth/fire) is the legacy
                      BoardGame tier — meaningless for the current event types,
                      so it stays data-only until a board-style mode returns. */}
                  {item.visibility === "private" && (
                    <span
                      className="border-osrs-bronze/40 text-osrs-parchment-dark/70 ml-2 rounded border px-1 text-[10px] uppercase"
                      title="Saved privately by your clan — other clans can't see it"
                    >
                      private
                    </span>
                  )}
                </span>
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
