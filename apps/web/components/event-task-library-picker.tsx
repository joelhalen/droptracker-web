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
 */

import { useState, useTransition } from "react";
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
} from "@/app/(admin)/groups/[id]/events/actions";

const field =
  "bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-osrs-gold/60";

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
  const [typeFilter, setTypeFilter] = useState("");
  const [results, setResults] = useState<EventTaskLibraryItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const doSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSearching(true);
    setError(null);
    try {
      const found = await searchEventTaskLibrary(groupId, {
        query: query.trim() || undefined,
        type: typeFilter || undefined,
      });
      setResults(found);
    } catch (err) {
      setError(getErrorMessage(err, "Library search failed. Please try again."));
    } finally {
      setSearching(false);
    }
  };

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
          // The copy is this event's own task; keep the clan's default
          // sharing (public) — the admin can flip it to private when editing.
          visibility: "public" as const,
        };
        const { id } = await addEventTask(groupId, eventId, input);
        onAdded({
          id,
          ...input,
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
      <form onSubmit={doSearch} className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks by name…"
          className={`${field} min-w-40 flex-1`}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className={field}
        >
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
      {error && <p className="text-osrs-red text-xs">{error}</p>}
      {results && (
        <ul className="border-osrs-bronze/20 max-h-64 overflow-y-auto rounded border">
          {results.length ? (
            results.map((item) => (
              <li
                key={item.id}
                className="hover:bg-osrs-bronze/10 flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
              >
                <span>
                  {item.name}
                  <span className="text-osrs-parchment-dark/50 ml-2 text-xs uppercase">
                    {TASK_TYPE_LABELS[item.type]}
                  </span>
                  {item.difficulty && (
                    <span className="text-osrs-gold-bright/70 ml-2 text-xs capitalize">
                      {item.difficulty}
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
            <li className="text-osrs-parchment-dark/50 px-3 py-2 text-xs">No matching tasks.</li>
          )}
        </ul>
      )}
      {!results && (
        <p className="text-osrs-parchment-dark/50 text-xs">
          Search to browse — leave the box empty to list everything.
        </p>
      )}
    </div>
  );
}
