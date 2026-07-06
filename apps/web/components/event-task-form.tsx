"use client";

/**
 * Type-aware event task create/edit form (parity with the XenForo addon's
 * tasks_create form): picking a type swaps in the fields that type actually
 * needs, item/NPC names come from autocomplete against the game databases
 * (exact names required — the engine matches by name), and the numeric goal
 * is labelled per type (KC, XP, level, sub-time, GP…).
 *
 * Create mode POSTs a full EventTaskInput. Edit mode PATCHes the patchable
 * fields (label / target / target_value / points / review flag); the type and
 * item-list config are fixed after creation — delete and recreate to change
 * them (matches the API surface).
 */

import { useEffect, useRef, useState, useTransition } from "react";
import {
  EVENT_TASK_TYPES,
  type EventMetaEntry,
  type EventTask,
  type EventTaskInput,
} from "@droptracker/api-types";
import {
  OSRS_SKILLS,
  TASK_TYPE_HELP,
  TASK_TYPE_LABELS,
  formatSeconds,
  parseTimeToSeconds,
  taskConfig,
  taskConfigItems,
} from "@/lib/events";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";
import {
  addEventTask,
  searchEventItems,
  searchEventNpcs,
  updateEventTask,
} from "@/app/(admin)/groups/[id]/events/actions";

const field =
  "bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-osrs-gold/60";

type ItemMode = "single" | "any_of" | "all_of" | "point_collection";

const ITEM_MODE_LABELS: Record<ItemMode, string> = {
  single: "Single item",
  any_of: "Any item from a list",
  all_of: "All items from a list",
  point_collection: "Points from a list",
};

/** Debounced name autocomplete against the item/NPC databases. */
function NameSearch({
  placeholder,
  search,
  iconBase,
  onPick,
  disabled,
}: {
  placeholder: string;
  search: (q: string) => Promise<EventMetaEntry[]>;
  /** droptracker.io image dir for row icons (itemdb | npcdb), if any. */
  iconBase?: "itemdb" | "npcdb";
  onPick: (entry: EventMetaEntry) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EventMetaEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const rows = await search(q);
        if (seq.current === mine) {
          setResults(rows);
          setOpen(true);
        }
      } catch {
        if (seq.current === mine) setResults([]);
      } finally {
        if (seq.current === mine) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        disabled={disabled}
        className={`${field} w-full`}
      />
      {open && (results.length > 0 || searching) && (
        <ul className="bg-osrs-brown-dark border-osrs-bronze/40 absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded border shadow-lg">
          {searching && !results.length && (
            <li className="text-osrs-parchment-dark/60 px-3 py-2 text-sm">Searching…</li>
          )}
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(r);
                  setQuery("");
                  setResults([]);
                  setOpen(false);
                }}
                className="text-osrs-parchment hover:bg-osrs-bronze/20 flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
              >
                {iconBase && (
                  <img
                    src={`https://www.droptracker.io/img/${iconBase}/${r.id}.png`}
                    alt=""
                    className="size-5 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.visibility = "hidden";
                    }}
                  />
                )}
                {r.name}
              </button>
            </li>
          ))}
          {!searching && query.trim().length >= 2 && !results.length && (
            <li className="text-osrs-parchment-dark/60 px-3 py-2 text-sm">
              No exact matches — in-game names required.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Removable name chip (selected items / source NPCs). */
function Chip({
  label,
  onRemove,
  extra,
}: {
  label: string;
  onRemove?: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <span className="bg-osrs-bronze/20 border-osrs-bronze/30 text-osrs-parchment inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs">
      {label}
      {extra}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-osrs-parchment-dark/70 hover:text-red-400"
          aria-label={`Remove ${label}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

export function EventTaskForm({
  groupId,
  eventId,
  initial,
  onSaved,
  onCancel,
}: {
  groupId: number | null;
  eventId: number;
  /** Present ⇒ edit mode (type and item-list config are fixed). */
  initial?: EventTask;
  onSaved: (task: EventTask) => void;
  onCancel?: () => void;
}) {
  const editing = initial != null;
  const initialItems = initial ? taskConfigItems(initial) : [];
  const initialConfig = initial ? taskConfig(initial) : {};

  const [type, setType] = useState<EventTask["type"]>(initial?.type ?? "item_collection");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [points, setPoints] = useState(initial?.points ?? 0);
  const [requiresReview, setRequiresReview] = useState(initial?.requires_confirmation ?? false);

  // item_collection
  const [itemMode, setItemMode] = useState<ItemMode>(
    initialItems.length ? ((initialConfig.kind as ItemMode) ?? "any_of") : "single",
  );
  const [itemName, setItemName] = useState(initial?.target ?? "");
  const [quantity, setQuantity] = useState(initial?.type === "item_collection" ? (initial.target_value ?? 1) : 1);
  const [listItems, setListItems] = useState<{ item_name: string; points?: number }[]>(initialItems);
  const [pointsGoal, setPointsGoal] = useState(
    initial?.type === "item_collection" && initialItems.length ? (initial.target_value ?? 0) : 0,
  );

  // kc / pb / xp / skill / loot / ehp / ehb
  const [npcName, setNpcName] = useState(
    initial && ["kc_target", "pb_target"].includes(initial.type) ? (initial.target ?? "") : "",
  );
  const [numericGoal, setNumericGoal] = useState<number>(
    initial && !["pb_target", "item_collection"].includes(initial.type) ? (initial.target_value ?? 0) : 0,
  );
  const [timeText, setTimeText] = useState(
    initial?.type === "pb_target" && initial.target_value != null ? formatSeconds(initial.target_value) : "",
  );
  const [skill, setSkill] = useState(
    initial && ["xp_target", "skill_target"].includes(initial.type) ? (initial.target ?? "Attack") : "Attack",
  );
  const [sourceNpcs, setSourceNpcs] = useState<string[]>(
    (initialConfig.source_npcs as string[] | undefined) ?? [],
  );
  const [customTarget, setCustomTarget] = useState(
    initial?.type === "custom" ? (initial.target ?? "") : "",
  );

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const searchItems = (q: string) => searchEventItems(groupId, q);
  const searchNpcs = (q: string) => searchEventNpcs(groupId, q);

  /** null ⇒ valid; otherwise the reason the submit button is disabled. */
  const validate = (): string | null => {
    switch (type) {
      case "item_collection":
        if (itemMode === "single") {
          if (!itemName) return "Pick an item.";
          if (quantity < 1) return "Quantity must be at least 1.";
        } else {
          if (editing) break;
          if (listItems.length < 2) return "Add at least two items to the list.";
          if (itemMode === "point_collection" && pointsGoal < 1) return "Set a points goal.";
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

  const suggestedLabel = (): string => {
    switch (type) {
      case "item_collection":
        if (itemMode === "single")
          return quantity > 1 ? `${quantity}× ${itemName}` : itemName;
        if (itemMode === "any_of") return `Any of ${listItems.length} items`;
        if (itemMode === "all_of") return `Collect all ${listItems.length} items`;
        return `${pointsGoal.toLocaleString()} collection points`;
      case "kc_target":
        return `${numericGoal}× ${npcName}`;
      case "pb_target":
        return `${npcName} in ${timeText}`;
      case "xp_target":
        return `${numericGoal.toLocaleString()} ${skill} XP`;
      case "skill_target":
        return `Level ${numericGoal} ${skill}`;
      case "loot_value":
        return `${numericGoal.toLocaleString()} GP${sourceNpcs.length ? ` from ${sourceNpcs.join(", ")}` : ""}`;
      default:
        return "";
    }
  };

  const buildInput = (): EventTaskInput => {
    const base: EventTaskInput = {
      type,
      label: label.trim() || suggestedLabel() || "Task",
      points,
      requires_confirmation: requiresReview,
    };
    switch (type) {
      case "item_collection":
        if (itemMode === "single") return { ...base, target: itemName, target_value: quantity };
        return {
          ...base,
          target_value: itemMode === "point_collection" ? pointsGoal : listItems.length,
          config: JSON.stringify({
            kind: itemMode,
            items: itemMode === "point_collection" ? listItems : listItems.map((i) => i.item_name),
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
          config: sourceNpcs.length ? JSON.stringify({ source_npcs: sourceNpcs }) : undefined,
        };
      case "ehp_target":
      case "ehb_target":
        return { ...base, target_value: numericGoal };
      default:
        return { ...base, target: customTarget.trim() || undefined };
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
      try {
        if (editing) {
          await updateEventTask(groupId, eventId, initial.id, {
            label: input.label,
            target: input.target ?? null,
            target_value: input.target_value ?? null,
            points: input.points,
            requires_confirmation: input.requires_confirmation,
          });
          onSaved({ ...initial, ...input, config: initial.config });
        } else {
          const { id } = await addEventTask(groupId, eventId, input);
          onSaved({
            id,
            ...input,
            points: input.points ?? 0,
            requires_confirmation: input.requires_confirmation ?? false,
          });
        }
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save the task. Please try again."));
      }
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

  const listLocked = editing && type === "item_collection" && itemMode !== "single";

  return (
    <form
      onSubmit={onSubmit}
      className="border-osrs-bronze/25 bg-osrs-brown-dark/30 grid gap-3 rounded-lg border p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-osrs-parchment-dark/80">Task type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as EventTask["type"])}
            disabled={editing}
            className={field}
          >
            {EVENT_TASK_TYPES.map((tt) => (
              <option key={tt} value={tt}>
                {TASK_TYPE_LABELS[tt]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-osrs-parchment-dark/80">Label (shown to players)</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={suggestedLabel() || "e.g. Slay the Wyrm"}
            className={field}
          />
        </label>
      </div>
      <p className="text-osrs-parchment-dark/60 text-xs">{TASK_TYPE_HELP[type]}</p>

      {/* ── per-type goal fields ─────────────────────────────────────────── */}
      {type === "item_collection" && (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-osrs-parchment-dark/80">Collection mode</span>
              <select
                value={itemMode}
                onChange={(e) => setItemMode(e.target.value as ItemMode)}
                disabled={editing}
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
                  disabled={listLocked}
                  className={field}
                />
              </label>
            ) : null}
          </div>
          {itemMode === "single" ? (
            <div className="grid gap-1 text-sm">
              <span className="text-osrs-parchment-dark/80">Item (exact in-game name)</span>
              {itemName ? (
                <div>
                  <Chip label={itemName} onRemove={() => setItemName("")} />
                </div>
              ) : (
                <NameSearch
                  placeholder="Search items…"
                  search={searchItems}
                  iconBase="itemdb"
                  onPick={(r) => setItemName(r.name)}
                />
              )}
            </div>
          ) : (
            <div className="grid gap-1 text-sm">
              <span className="text-osrs-parchment-dark/80">Items</span>
              {listLocked ? (
                <p className="text-osrs-parchment-dark/60 text-xs">
                  The item list can't be changed after creation — delete the task and recreate it.
                </p>
              ) : (
                <NameSearch
                  placeholder="Search items to add…"
                  search={searchItems}
                  iconBase="itemdb"
                  onPick={(r) =>
                    setListItems((prev) =>
                      prev.some((i) => i.item_name === r.name)
                        ? prev
                        : [...prev, itemMode === "point_collection" ? { item_name: r.name, points: 1 } : { item_name: r.name }],
                    )
                  }
                />
              )}
              {listItems.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {listItems.map((it, i) => (
                    <Chip
                      key={it.item_name}
                      label={it.item_name}
                      extra={
                        itemMode === "point_collection" && !listLocked ? (
                          <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={it.points ?? 1}
                            onChange={(e) =>
                              setListItems((prev) =>
                                prev.map((x, j) => (j === i ? { ...x, points: Number(e.target.value) } : x)),
                              )
                            }
                            className="bg-osrs-brown-dark/80 border-osrs-bronze/30 w-14 rounded border px-1 text-center text-xs"
                            title="Points this item is worth"
                          />
                        ) : itemMode === "point_collection" && it.points != null ? (
                          <span className="text-osrs-gold/80">({it.points})</span>
                        ) : undefined
                      }
                      onRemove={
                        listLocked
                          ? undefined
                          : () => setListItems((prev) => prev.filter((_, j) => j !== i))
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(type === "kc_target" || type === "pb_target") && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1 text-sm">
            <span className="text-osrs-parchment-dark/80">NPC (exact in-game name)</span>
            {npcName ? (
              <div>
                <Chip label={npcName} onRemove={() => setNpcName("")} />
              </div>
            ) : (
              <NameSearch
                placeholder="Search NPCs…"
                search={searchNpcs}
                iconBase="npcdb"
                onPick={(r) => setNpcName(r.name)}
              />
            )}
          </div>
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
          {goalField("GP to earn", "e.g. 25000000")}
          <div className="grid gap-1 text-sm">
            <span className="text-osrs-parchment-dark/80">
              Only count drops from (optional)
            </span>
            {!editing && (
              <NameSearch
                placeholder="Search NPCs to add…"
                search={searchNpcs}
                iconBase="npcdb"
                onPick={(r) =>
                  setSourceNpcs((prev) => (prev.includes(r.name) ? prev : [...prev, r.name]))
                }
              />
            )}
            {sourceNpcs.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {sourceNpcs.map((n) => (
                  <Chip
                    key={n}
                    label={n}
                    onRemove={editing ? undefined : () => setSourceNpcs((prev) => prev.filter((x) => x !== n))}
                  />
                ))}
              </div>
            )}
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

      {/* ── points / review / submit ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-osrs-parchment-dark/80">Points</span>
          <input
            type="number"
            min={0}
            value={points}
            onChange={(e) => setPoints(Math.max(0, Number(e.target.value)))}
            className={`${field} w-24`}
          />
        </label>
        <label className="text-osrs-parchment-dark/80 mb-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={requiresReview}
            onChange={(e) => setRequiresReview(e.target.checked)}
          />
          Completions require admin review
        </label>
        <div className="ml-auto flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-osrs-parchment-dark/80 hover:text-osrs-parchment rounded px-3 py-2 text-sm"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={pending || validate() !== null}
            title={validate() ?? undefined}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {editing ? "Save task" : "Add task"}
          </button>
        </div>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
    </form>
  );
}
