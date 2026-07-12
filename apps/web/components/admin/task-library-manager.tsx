"use client";

/**
 * Superadmin task-library manager (/admin/task-library).
 *
 * The write surface over the reusable task presets that back every clan's
 * event pickers: curated seeds, admin-created presets, and tasks clans saved
 * publicly. Live search with icon rows, inline edit through the same
 * drag-and-drop item/NPC picker the event task builder uses, and soft delete
 * (a removed preset leaves the pickers; tasks already copied into events are
 * their own rows and keep working).
 */

import { useEffect, useRef, useState, useTransition } from "react";
import {
  EVENT_TASK_DIFFICULTIES,
  EVENT_TASK_TYPES,
  type EventTaskLibraryItem,
  type EventTaskLibraryItemInput,
} from "@droptracker/api-types";
import {
  OSRS_SKILLS,
  TASK_TYPE_HELP,
  TASK_TYPE_LABELS,
  formatSeconds,
  parseTimeToSeconds,
  taskConfig,
  taskConfigItems,
  taskGoal,
} from "@/lib/events";
import { getErrorMessage } from "@/lib/errors";
import { Alert, EmptyState } from "@/components/ui";
import { ItemNpcPicker, type PickerEntry } from "@/components/item-npc-picker";
import {
  createTaskPreset,
  deleteTaskPreset,
  resolveLibraryMeta,
  searchLibraryItems,
  searchLibraryNpcs,
  searchTaskLibrary,
  updateTaskPreset,
} from "@/app/(admin)/admin/task-library/actions";

const field =
  "bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-osrs-gold/60";

const PAGE_SIZE = 50; // mirrors the API's _LIBRARY_PAGE_SIZE

const IMG_BASE = "https://www.droptracker.io/img";

type ItemMode = "single" | "any_of" | "all_of" | "point_collection";

const ITEM_MODE_LABELS: Record<ItemMode, string> = {
  single: "Single item",
  any_of: "Any item from a list",
  all_of: "All items from a list",
  point_collection: "Points from a list",
};

/** Which icon (if any) represents a preset row: its target NPC/item, or the
 * first entry of its item list / source-NPC list. */
function rowIconRef(item: EventTaskLibraryItem): { kind: "item" | "npc"; name: string } | null {
  if (item.type === "kc_target" || item.type === "pb_target") {
    return item.target ? { kind: "npc", name: item.target } : null;
  }
  if (item.type === "item_collection") {
    if (item.target) return { kind: "item", name: item.target };
    const items = taskConfigItems({ config: item.config ?? null });
    return items[0] ? { kind: "item", name: items[0].item_name } : null;
  }
  if (item.type === "loot_value") {
    const sources = taskConfig({ config: item.config ?? null }).source_npcs;
    return Array.isArray(sources) && typeof sources[0] === "string"
      ? { kind: "npc", name: sources[0] }
      : null;
  }
  return null;
}

export function TaskLibraryManager({ initial }: { initial: EventTaskLibraryItem[] }) {
  const [rows, setRows] = useState<EventTaskLibraryItem[]>(initial);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initial.length === PAGE_SIZE);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const seq = useRef(0);
  const firstRender = useRef(true);

  // Icon hydration: preset rows store names; resolve them to game ids once.
  const [iconIds, setIconIds] = useState<Map<string, number>>(new Map());
  const iconTried = useRef<Set<string>>(new Set());

  useEffect(() => {
    const wanted = new Map<"item" | "npc", string[]>();
    for (const row of rows) {
      const ref = rowIconRef(row);
      if (!ref) continue;
      const key = `${ref.kind}:${ref.name}`;
      if (iconIds.has(key) || iconTried.current.has(key)) continue;
      iconTried.current.add(key);
      wanted.set(ref.kind, [...(wanted.get(ref.kind) ?? []), ref.name]);
    }
    if (!wanted.size) return;
    let cancelled = false;
    (async () => {
      const merged = new Map(iconIds);
      for (const [kind, names] of wanted) {
        try {
          const found = await resolveLibraryMeta(kind, names);
          for (const f of found) merged.set(`${kind}:${f.name}`, f.id);
        } catch {
          // icons are decoration — a failed resolve just leaves them off
        }
      }
      if (!cancelled) setIconIds(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  // Live search (debounced) whenever the query/type filter changes.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSearching(true);
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const found = await searchTaskLibrary({
          query: query.trim() || undefined,
          type: typeFilter || undefined,
        });
        if (seq.current === mine) {
          setRows(found);
          setPage(1);
          setHasMore(found.length === PAGE_SIZE);
        }
      } catch (err) {
        if (seq.current === mine)
          setError(getErrorMessage(err, "Search failed. Please try again."));
      } finally {
        if (seq.current === mine) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, typeFilter]);

  const loadMore = () => {
    const next = page + 1;
    setSearching(true);
    startTransition(async () => {
      try {
        const found = await searchTaskLibrary({
          query: query.trim() || undefined,
          type: typeFilter || undefined,
          page: next,
        });
        setRows((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...found.filter((r) => !seen.has(r.id))];
        });
        setPage(next);
        setHasMore(found.length === PAGE_SIZE);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't load more presets."));
      } finally {
        setSearching(false);
      }
    });
  };

  const onDelete = (item: EventTaskLibraryItem) => {
    setConfirmDeleteId(null);
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== item.id));
    setError(null);
    startTransition(async () => {
      const res = await deleteTaskPreset(item.id);
      if ("error" in res) {
        setRows(prev);
        setError(res.error ?? "Couldn't delete the preset.");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="heading-rule text-osrs-gold mb-1 pb-1 text-lg font-semibold">
          Event task library
        </h2>
        <p className="text-osrs-parchment-dark/70 text-sm">
          The presets behind every clan&apos;s task pickers — curated site presets and tasks clans
          saved. Public rows show for everyone; private rows only for the owning clan. Deleting a
          preset removes it from the pickers, but tasks already added to events keep working.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search presets by name…"
          className={`${field} min-w-48 flex-1`}
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
        {!creating && (
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditingId(null);
            }}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-2 text-sm font-medium"
          >
            New preset
          </button>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {creating && (
        <PresetForm
          onSaved={(item) => {
            setRows((prev) => [item, ...prev]);
            setCreating(false);
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {rows.length ? (
        <ul className="divide-osrs-bronze/20 border-osrs-bronze/20 divide-y rounded border">
          {rows.map((item) => {
            const ref = rowIconRef(item);
            const iconId = ref ? iconIds.get(`${ref.kind}:${ref.name}`) : undefined;
            return editingId === item.id ? (
              <li key={item.id} className="p-3">
                <PresetForm
                  initial={item}
                  onSaved={(updated) => {
                    setRows((prev) => prev.map((r) => (r.id === item.id ? updated : r)));
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li key={item.id} className="px-3 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  {ref && iconId != null ? (
                    <img
                      src={`${IMG_BASE}/${ref.kind === "item" ? "itemdb" : "npcdb"}/${iconId}.png`}
                      alt=""
                      width={24}
                      height={24}
                      className="shrink-0 object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                  ) : (
                    <span className="inline-block size-6 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="text-osrs-parchment font-medium" title={item.description ?? undefined}>
                      {item.name}
                    </span>
                    <span className="text-osrs-parchment-dark/50 ml-2 text-xs uppercase">
                      {TASK_TYPE_LABELS[item.type]}
                    </span>
                    {taskGoal({
                      type: item.type,
                      target: item.target ?? null,
                      target_value: item.target_value ?? null,
                      config: item.config ?? null,
                    }) && (
                      <span className="text-osrs-parchment-dark/60 ml-2 text-xs">
                        {taskGoal({
                          type: item.type,
                          target: item.target ?? null,
                          target_value: item.target_value ?? null,
                          config: item.config ?? null,
                        })}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {item.difficulty && (
                      <span className="text-osrs-gold-bright/70 text-xs capitalize">
                        {item.difficulty}
                      </span>
                    )}
                    <span className="text-osrs-parchment-dark/60 text-xs">
                      {item.default_points} pts
                    </span>
                    <span
                      className={`rounded border px-1 text-[10px] uppercase ${
                        item.visibility === "private"
                          ? "border-osrs-bronze/40 text-osrs-parchment-dark/70"
                          : "border-osrs-gold/40 text-osrs-gold/80"
                      }`}
                      title={
                        item.visibility === "private"
                          ? "Only the owning clan sees this preset"
                          : "Every clan's picker shows this preset"
                      }
                    >
                      {item.visibility}
                    </span>
                    <span
                      className="border-osrs-bronze/40 text-osrs-parchment-dark/60 rounded border px-1 text-[10px] uppercase"
                      title={
                        item.group_id == null
                          ? "Site-wide preset (curated or admin-created)"
                          : `Saved by group #${item.group_id}`
                      }
                    >
                      {item.group_id == null ? "site" : `clan ${item.group_id}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(item.id);
                        setCreating(false);
                        setConfirmDeleteId(null);
                      }}
                      className="text-osrs-parchment-dark/70 hover:bg-osrs-bronze/15 rounded px-2 py-1 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(item.id)}
                      disabled={pending}
                      className="text-osrs-red hover:bg-osrs-red/10 rounded px-2 py-1 text-xs disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </span>
                </div>
                {confirmDeleteId === item.id && (
                  <div className="border-osrs-red/30 bg-osrs-red/5 mt-2 rounded border p-2 text-xs">
                    <p className="text-osrs-parchment-dark/80">
                      Delete <span className="font-medium">{item.name}</span> from the library? It
                      disappears from every clan&apos;s picker; tasks already copied into events
                      are untouched.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        disabled={pending}
                        className="bg-osrs-red/80 hover:bg-osrs-red text-osrs-parchment rounded px-3 py-1 text-xs font-medium disabled:opacity-50"
                      >
                        Delete preset
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-osrs-parchment-dark/70 hover:text-osrs-parchment rounded px-2 py-1 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title={searching ? "Searching…" : "No presets found"}
          hint={query || typeFilter ? "Try a different search or type filter." : undefined}
        />
      )}

      {hasMore && rows.length > 0 && (
        <div className="text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={searching || pending}
            className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border px-4 py-2 text-sm disabled:opacity-50"
          >
            {searching ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Create/edit form for one preset — the same type-aware goal fields and
 * drag-and-drop picker as the event task builder, minus the event-only bits
 * (review flag), plus the library-only ones (description, difficulty). */
function PresetForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: EventTaskLibraryItem;
  onSaved: (item: EventTaskLibraryItem) => void;
  onCancel: () => void;
}) {
  const editing = initial != null;
  const initialItems: PickerEntry[] = initial
    ? taskConfigItems({ config: initial.config ?? null }).map((it) => ({
        name: it.item_name,
        points: it.points,
      }))
    : [];
  const initialConfig = initial ? taskConfig({ config: initial.config ?? null }) : {};

  const [type, setType] = useState<EventTaskLibraryItem["type"]>(
    initial?.type ?? "item_collection",
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [defaultPoints, setDefaultPoints] = useState(initial?.default_points ?? 0);
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "");
  const [visibility, setVisibility] = useState<"public" | "private">(
    initial?.visibility ?? "public",
  );

  const [itemMode, setItemMode] = useState<ItemMode>(
    initialItems.length ? ((initialConfig.kind as ItemMode) ?? "any_of") : "single",
  );
  const [singleItem, setSingleItem] = useState<PickerEntry[]>(
    initial?.type === "item_collection" && initial.target ? [{ name: initial.target }] : [],
  );
  const [quantity, setQuantity] = useState(
    initial?.type === "item_collection" && !initialItems.length ? (initial.target_value ?? 1) : 1,
  );
  const [listItems, setListItems] = useState<PickerEntry[]>(initialItems);
  const [pointsGoal, setPointsGoal] = useState(
    initial?.type === "item_collection" && initialItems.length ? (initial.target_value ?? 0) : 0,
  );
  const [npcSel, setNpcSel] = useState<PickerEntry[]>(
    initial && ["kc_target", "pb_target"].includes(initial.type) && initial.target
      ? [{ name: initial.target }]
      : [],
  );
  const [numericGoal, setNumericGoal] = useState<number>(
    initial && !["pb_target", "item_collection"].includes(initial.type)
      ? (initial.target_value ?? 0)
      : 0,
  );
  const [timeText, setTimeText] = useState(
    initial?.type === "pb_target" && initial.target_value != null
      ? formatSeconds(initial.target_value)
      : "",
  );
  const [skill, setSkill] = useState(
    initial && ["xp_target", "skill_target"].includes(initial.type)
      ? (initial.target ?? "Attack")
      : "Attack",
  );
  const [sourceNpcs, setSourceNpcs] = useState<PickerEntry[]>(
    ((initialConfig.source_npcs as string[] | undefined) ?? []).map((n) => ({ name: n })),
  );
  const [customTarget, setCustomTarget] = useState(
    initial?.type === "custom" ? (initial.target ?? "") : "",
  );

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const resolveItems = (names: string[]) => resolveLibraryMeta("item", names);
  const resolveNpcs = (names: string[]) => resolveLibraryMeta("npc", names);

  const itemName = singleItem[0]?.name ?? "";
  const npcName = npcSel[0]?.name ?? "";

  const validate = (): string | null => {
    if (!name.trim()) return "Give the preset a name.";
    switch (type) {
      case "item_collection":
        if (itemMode === "single") {
          if (!itemName) return "Pick an item.";
          if (quantity < 1) return "Quantity must be at least 1.";
        } else if (itemMode === "point_collection") {
          if (listItems.length < 1) return "Add at least one item to the list.";
          if (pointsGoal < 1) return "Set a points goal.";
        } else if (listItems.length < 2) {
          return "Add at least two items to the list.";
        }
        break;
      case "kc_target":
        if (!npcName) return "Pick an NPC.";
        if (numericGoal < 1) return "Set a kill count.";
        break;
      case "pb_target":
        if (!npcName) return "Pick an NPC.";
        if (parseTimeToSeconds(timeText) == null || parseTimeToSeconds(timeText)! < 1)
          return "Enter the time limit as mm:ss (or h:mm:ss).";
        break;
      case "xp_target":
        if (numericGoal < 1) return "Set an XP goal.";
        break;
      case "skill_target":
        if (numericGoal < 2 || numericGoal > 99) return "Target level must be 2–99.";
        break;
      case "loot_value":
        if (numericGoal < 1) return "Set a GP goal.";
        break;
      case "ehp_target":
      case "ehb_target":
        if (numericGoal < 1) return "Set a target amount.";
        break;
      case "custom":
        break;
    }
    return null;
  };

  const buildInput = (): EventTaskLibraryItemInput => {
    const base: EventTaskLibraryItemInput = {
      name: name.trim(),
      description: description.trim() || null,
      type,
      default_points: defaultPoints,
      difficulty: (difficulty || null) as EventTaskLibraryItemInput["difficulty"],
      visibility,
      target: null,
      target_value: null,
      config: null,
    };
    switch (type) {
      case "item_collection":
        if (itemMode === "single") return { ...base, target: itemName, target_value: quantity };
        return {
          ...base,
          target_value: itemMode === "point_collection" ? pointsGoal : listItems.length,
          config: JSON.stringify({
            kind: itemMode,
            items:
              itemMode === "point_collection"
                ? listItems.map((i) => ({ item_name: i.name, points: i.points ?? 1 }))
                : listItems.map((i) => i.name),
          }),
        };
      case "kc_target":
        return { ...base, target: npcName, target_value: numericGoal };
      case "pb_target":
        return { ...base, target: npcName, target_value: parseTimeToSeconds(timeText) ?? 0 };
      case "xp_target":
      case "skill_target":
        return { ...base, target: skill, target_value: numericGoal };
      case "loot_value":
        return {
          ...base,
          target_value: numericGoal,
          config: sourceNpcs.length
            ? JSON.stringify({ source_npcs: sourceNpcs.map((n) => n.name) })
            : null,
        };
      case "ehp_target":
      case "ehb_target":
        return { ...base, target_value: numericGoal };
      default:
        return { ...base, target: customTarget.trim() || null };
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    const input = buildInput();
    startTransition(async () => {
      const res = editing
        ? await updateTaskPreset(initial.id, input)
        : await createTaskPreset(input);
      if ("error" in res) {
        setError(res.error ?? "Couldn't save the preset.");
        return;
      }
      onSaved(res.item);
    });
  };

  const goalField = (labelText: string, placeholder: string, min = 1, max?: number) => (
    <label className="grid gap-1 text-sm">
      <span className="text-osrs-parchment-dark/80">{labelText}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={numericGoal || ""}
        onChange={(e) => setNumericGoal(Number(e.target.value))}
        placeholder={placeholder}
        className={field}
      />
    </label>
  );

  return (
    <form
      onSubmit={onSubmit}
      className="border-osrs-bronze/25 bg-osrs-brown-dark/30 grid gap-3 rounded-lg border p-4"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-osrs-gold text-sm font-semibold">
          {editing ? `Edit preset — ${initial.name}` : "New site-wide preset"}
        </h4>
        {editing && initial.group_id != null && (
          <span className="text-osrs-parchment-dark/60 text-xs">
            Saved by group #{initial.group_id}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-osrs-parchment-dark/80">Preset name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="e.g. Slay Zulrah 50 times"
            className={field}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-osrs-parchment-dark/80">Task type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as EventTaskLibraryItem["type"])}
            className={field}
          >
            {EVENT_TASK_TYPES.map((tt) => (
              <option key={tt} value={tt}>
                {TASK_TYPE_LABELS[tt]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-osrs-parchment-dark/60 text-xs">{TASK_TYPE_HELP[type]}</p>

      {type === "item_collection" && (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-osrs-parchment-dark/80">Collection mode</span>
              <select
                value={itemMode}
                onChange={(e) => setItemMode(e.target.value as ItemMode)}
                className={field}
              >
                {(Object.keys(ITEM_MODE_LABELS) as ItemMode[]).map((m) => (
                  <option key={m} value={m}>
                    {ITEM_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            {itemMode === "single" ? (
              <label className="grid gap-1 text-sm">
                <span className="text-osrs-parchment-dark/80">Quantity</span>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className={field}
                />
              </label>
            ) : itemMode === "point_collection" ? (
              <label className="grid gap-1 text-sm">
                <span className="text-osrs-parchment-dark/80">Points goal</span>
                <input
                  type="number"
                  min={1}
                  value={pointsGoal || ""}
                  onChange={(e) => setPointsGoal(Number(e.target.value))}
                  className={field}
                />
              </label>
            ) : null}
          </div>
          <ItemNpcPicker
            kind="item"
            mode={itemMode === "single" ? "single" : "list"}
            withPoints={itemMode === "point_collection"}
            selected={itemMode === "single" ? singleItem : listItems}
            onChange={itemMode === "single" ? setSingleItem : setListItems}
            search={searchLibraryItems}
            resolve={resolveItems}
          />
        </div>
      )}

      {(type === "kc_target" || type === "pb_target") && (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {type === "kc_target" ? (
              goalField("Kill count", "e.g. 50")
            ) : (
              <label className="grid gap-1 text-sm">
                <span className="text-osrs-parchment-dark/80">Time limit (mm:ss or h:mm:ss)</span>
                <input
                  value={timeText}
                  onChange={(e) => setTimeText(e.target.value)}
                  placeholder="e.g. 1:10"
                  className={field}
                />
              </label>
            )}
          </div>
          <ItemNpcPicker
            kind="npc"
            mode="single"
            selected={npcSel}
            onChange={setNpcSel}
            search={searchLibraryNpcs}
            resolve={resolveNpcs}
            selectionTitle="Target NPC"
          />
        </div>
      )}

      {(type === "xp_target" || type === "skill_target") && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-osrs-parchment-dark/80">Skill</span>
            <select value={skill} onChange={(e) => setSkill(e.target.value)} className={field}>
              {OSRS_SKILLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          {type === "xp_target"
            ? goalField("XP to gain", "e.g. 1000000")
            : goalField("Target level", "e.g. 99", 2, 99)}
        </div>
      )}

      {type === "loot_value" && (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">{goalField("GP to earn", "e.g. 25000000")}</div>
          <div className="grid gap-1 text-sm">
            <span className="text-osrs-parchment-dark/80">Only count drops from (optional)</span>
            <ItemNpcPicker
              kind="npc"
              mode="list"
              selected={sourceNpcs}
              onChange={setSourceNpcs}
              search={searchLibraryNpcs}
              resolve={resolveNpcs}
              selectionTitle="Counting drops from"
              emptyHint="Leave empty to count drops from anywhere."
            />
          </div>
        </div>
      )}

      {(type === "ehp_target" || type === "ehb_target") &&
        goalField(type === "ehp_target" ? "Target EHP" : "Target EHB", "e.g. 25")}

      {type === "custom" && (
        <label className="grid gap-1 text-sm">
          <span className="text-osrs-parchment-dark/80">Goal description (optional)</span>
          <input
            value={customTarget}
            onChange={(e) => setCustomTarget(e.target.value)}
            placeholder="e.g. Win a clan fight"
            className={field}
          />
        </label>
      )}

      <label className="grid gap-1 text-sm">
        <span className="text-osrs-parchment-dark/80">Description (shown in pickers)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Optional blurb clans see when browsing the library"
          className={field}
        />
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-osrs-parchment-dark/80">Default points</span>
          <input
            type="number"
            min={0}
            value={defaultPoints}
            onChange={(e) => setDefaultPoints(Math.max(0, Number(e.target.value)))}
            className={`${field} w-24`}
            title="Points a task starts with when copied from this preset"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-osrs-parchment-dark/80">Difficulty</span>
          <select
            value={difficulty ?? ""}
            onChange={(e) => setDifficulty(e.target.value)}
            className={field}
          >
            <option value="">None</option>
            {EVENT_TASK_DIFFICULTIES.map((d) => (
              <option key={d} value={d} className="capitalize">
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-osrs-parchment-dark/80">Visibility</span>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as "public" | "private")}
            className={field}
          >
            <option value="public">Public — every clan&apos;s picker</option>
            <option value="private">Private — owning clan only</option>
          </select>
        </label>
        <div className="ml-auto flex items-center gap-2">
          {validate() !== null && (
            <span className="text-osrs-parchment-dark/50 text-xs">{validate()}</span>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="text-osrs-parchment-dark/80 hover:text-osrs-parchment rounded px-3 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || validate() !== null}
            title={validate() ?? undefined}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Saving…" : editing ? "Save preset" : "Create preset"}
          </button>
        </div>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
    </form>
  );
}
