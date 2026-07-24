"use client";

/**
 * Type-aware event task create/edit form (parity with the XenForo addon's
 * tasks_create form): picking a type swaps in the fields that type actually
 * needs, and item/NPC selection runs through the drag-and-drop search picker
 * (ItemNpcPicker) against the game databases — exact names required, the
 * engine matches by name. The numeric goal is labelled per type (KC, XP,
 * level, sub-time, GP…).
 *
 * Create mode POSTs a full EventTaskInput. Edit mode PATCHes label / goal /
 * points / review flag / visibility AND the item-list config (the API
 * revalidates the whole goal), so lists are edited in place — only the task
 * type itself is fixed after creation.
 *
 * Draft mode (`onDraftSubmit`) skips the API entirely and hands the built
 * EventTaskInput to the caller — the bingo cell editor embeds the form this
 * way so inline cell tasks get every option (item pickers, admin review,
 * source restrictions…) while staying deferred until the board PUT.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import {
  EVENT_TASK_DIFFICULTIES,
  EVENT_TASK_TYPES,
  type EventMetaEntry,
  type EventPetCategory,
  type EventTask,
  type EventTaskInput,
} from "@droptracker/api-types";
import {
  OSRS_SKILLS,
  PET_CATEGORY_KEYS,
  PET_CATEGORY_LABELS,
  TASK_DIFFICULTY_LABELS,
  TASK_TYPE_HELP,
  TASK_TYPE_LABELS,
  formatSeconds,
  parseTimeToSeconds,
  pbRequirement,
  taskConfig,
  taskConfigItems,
  taskConfigPetNames,
  taskSourceNpcs,
  type PbRequirementMode,
} from "@/lib/events";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";
import {
  ItemNpcPicker,
  type BossImportApi,
  type PickerEntry,
} from "@/components/item-npc-picker";
import { ItemDbIcon } from "@/components/item-db-icon";
import { ItemSourceRestriction } from "@/components/item-source-restriction";
import {
  LootSweepEditor,
  type LootSweepDraft,
  emptyLootSweepDraft,
  lootSweepFromConfig,
  lootSweepToConfig,
} from "@/components/loot-sweep-editor";
import { QuantityInput } from "@/components/quantity-input";
import {
  addEventTask,
  fetchEventPetCategories,
  fetchItemSources,
  fetchNpcDropItems,
  resolveEventMetaNames,
  searchEventItems,
  searchEventNpcs,
  searchEventPets,
  updateEventTask,
  uploadLootSweepImage,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";

const field =
  "bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-osrs-gold/60";

type ItemMode = "single" | "any_of" | "all_of" | "point_collection" | "groups" | "any_path";

const ITEM_MODE_LABELS: Record<ItemMode, string> = {
  single: "Single item",
  any_of: "Any item(s) from a list",
  all_of: "All items from a list",
  point_collection: "Points from a list",
  groups: "Combined requirements",
  any_path: "Either-or (alternative paths)",
};

const ITEM_MODE_HELP: Record<ItemMode, string> = {
  single: "One specific item (optionally more than once).",
  any_of: "Any items from the list count — set how many are needed (e.g. any 2 boaters).",
  all_of: "The team must collect every item on the list.",
  point_collection:
    "Each item is worth points — the team races to the points goal. Weight rare drops higher.",
  groups:
    "Combine lists: every group must be satisfied — e.g. ALL three godsword shards plus ANY one hilt.",
  any_path:
    "Completing ANY one path finishes the task. Paths can be item lists (the full Justiciar " +
    "set OR any 5 Justiciar items), a weighted points race, or metric goals — e.g. a Godwars " +
    "boss pet OR 5,000 kills at Godwars bosses OR 500 points of listed drops.",
};

/** How a pet_collection task is scoped. */
type PetMode = "specific" | "category" | "custom" | "any";

const PET_MODE_LABELS: Record<PetMode, string> = {
  specific: "A specific pet",
  category: "Any pet from a category",
  custom: "A custom list of pets",
  any: "Any pet",
};

const PET_MODE_HELP: Record<PetMode, string> = {
  specific: "One named pet (e.g. Baby mole). Credited from that pet's submission.",
  category: "Any pet in the chosen categories counts (boss / skilling / raids / misc).",
  custom:
    "Only pets on the list count. Start from a category preset, then remove or add individual pets.",
  any: "Any pet at all — but trivial/stackable 'misc' pets are excluded. Pick the category mode and add 'Misc pets' to include them.",
};

/** One sub-requirement of a "Combined requirements" task. */
type GroupDraft = { mode: "all_of" | "any_of"; need: number; items: PickerEntry[] };

/** How a pb task completes: once (legacy), a kill count of qualifying beats,
 * N unique players, or every rostered member of the team. */
type PbChoice = "once" | PbRequirementMode;

const PB_CHOICE_LABELS: Record<PbChoice, string> = {
  once: "Beaten once",
  times: "Beaten a number of times",
  unique_players: "Beaten by N unique players",
  whole_team: "Beaten by every team member",
};

const PB_CHOICE_HELP: Record<PbChoice, string> = {
  once: "The first qualifying kill completes the task.",
  times: "Every kill under the time counts — teammates on one kill each count, and one player may repeat.",
  unique_players: "That many different players must each record a qualifying time.",
  whole_team: "Every player rostered on the team must record a qualifying time — the target scales to each team's size.",
};

/** What one "Either-or" path requires: an item checklist, a points race over
 * a weighted item list, a kill count at chosen NPC(s), or a GP total of drops
 * (optionally NPC-scoped). */
type PathKind = "items" | "points" | "kc" | "loot_value";

const PATH_KIND_LABELS: Record<PathKind, string> = {
  items: "Items",
  points: "Points from a list",
  kc: "Kill count",
  loot_value: "Loot value (GP)",
};

/** One alternative of an "Either-or" task — its own requirement groups
 * (`items`), a weighted item list raced to a points goal (`points`: items +
 * need), or a metric goal (`kc` / `loot_value`: npcs + need). */
type PathDraft = {
  label: string;
  kind: PathKind;
  groups: GroupDraft[];
  items: PickerEntry[];
  npcs: PickerEntry[];
  need: number;
};

const emptyPathDraft = (kind: PathKind, groupMode: "all_of" | "any_of" = "any_of"): PathDraft => ({
  label: "",
  kind,
  groups: kind === "items" ? [{ mode: groupMode, need: 1, items: [] }] : [],
  items: [],
  npcs: [],
  need: 1,
});

/** Lower-cased `{item_name: [npc]}` restriction lookup from a stored config. */
function itemNpcsLookup(config: Record<string, unknown>): Record<string, string[]> {
  const raw = config.item_npcs;
  const out: Record<string, string[]> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        const npcs = v.filter((n): n is string => typeof n === "string");
        if (npcs.length) out[k.toLowerCase()] = npcs;
      }
    }
  }
  return out;
}

function parseGroupDrafts(
  raw: unknown,
  itemNpcs: Record<string, string[]> = {},
  petNames: Set<string> = new Set(),
): GroupDraft[] {
  if (!Array.isArray(raw)) return [];
  return (raw as { mode?: string; need?: number; items?: unknown[] }[]).map((g) => ({
    mode: g.mode === "any_of" ? "any_of" : "all_of",
    need: typeof g.need === "number" && g.need >= 1 ? g.need : 1,
    items: (Array.isArray(g.items) ? g.items : []).flatMap((it): PickerEntry[] => {
      const name = typeof it === "string" ? it : (it as { item_name?: string } | null)?.item_name;
      if (!name) return [];
      const npcs = itemNpcs[name.toLowerCase()];
      return [
        {
          name,
          ...(npcs ? { npcs } : {}),
          ...(petNames.has(name.toLowerCase()) ? { isPet: true } : {}),
        },
      ];
    }),
  }));
}

function groupsFromConfig(config: Record<string, unknown>, petNames: Set<string>): GroupDraft[] {
  return parseGroupDrafts(config.groups, itemNpcsLookup(config), petNames);
}

function pathsFromConfig(config: Record<string, unknown>, petNames: Set<string>): PathDraft[] {
  if (config.kind !== "any_path" || !Array.isArray(config.paths)) return [];
  const itemNpcs = itemNpcsLookup(config);
  return (
    config.paths as {
      label?: unknown;
      groups?: unknown;
      metric?: unknown;
      npcs?: unknown;
      need?: unknown;
      kind?: unknown;
      items?: unknown;
    }[]
  ).map((p) => {
    const label = typeof p.label === "string" ? p.label : "";
    if (p.metric === "kc" || p.metric === "loot_value") {
      return {
        label,
        kind: p.metric,
        groups: [],
        items: [],
        npcs: (Array.isArray(p.npcs) ? p.npcs : [])
          .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
          .map((name) => ({ name })),
        need: typeof p.need === "number" && p.need >= 1 ? p.need : 1,
      };
    }
    if (p.kind === "points") {
      return {
        label,
        kind: "points" as const,
        groups: [],
        items: (Array.isArray(p.items) ? p.items : []).flatMap((it): PickerEntry[] => {
          const name =
            typeof it === "string" ? it : (it as { item_name?: string } | null)?.item_name;
          if (!name) return [];
          const pts = typeof it === "object" && it ? (it as { points?: number }).points : undefined;
          const npcs = itemNpcs[name.toLowerCase()];
          return [
            {
              name,
              points: typeof pts === "number" && pts >= 1 ? pts : 1,
              ...(npcs ? { npcs } : {}),
              ...(petNames.has(name.toLowerCase()) ? { isPet: true } : {}),
            },
          ];
        }),
        npcs: [],
        need: typeof p.need === "number" && p.need >= 1 ? p.need : 1,
      };
    }
    return {
      label,
      kind: "items" as const,
      groups: parseGroupDrafts(p.groups, itemNpcs, petNames),
      items: [],
      npcs: [],
      need: 1,
    };
  });
}

function serializeGroups(groups: GroupDraft[]) {
  return groups.map((g) =>
    g.mode === "any_of"
      ? { mode: "any_of", need: g.need, items: g.items.map((i) => i.name) }
      : { mode: "all_of", items: g.items.map((i) => i.name) },
  );
}

const groupsNeed = (groups: GroupDraft[]) =>
  groups.reduce((n, g) => n + (g.mode === "all_of" ? g.items.length : g.need), 0);

/** Flat `{item_name: [npc]}` source-restriction map from picked entries — only
 * the items that carry a restriction. Used for every multi-item config kind so
 * it survives groups/any_path (whose serialized item lists are bare strings).
 * Pets are skipped: they have no drop source (they ride in `pet_items`). */
function itemNpcsFromEntries(items: PickerEntry[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const it of items) {
    if (!it.isPet && it.npcs && it.npcs.length) out[it.name] = it.npcs;
  }
  return out;
}

/** Flat `pet_items` list from picked entries — the names flagged as pets
 * (credited from pet submissions). Same flat-map rationale as item_npcs. */
function petItemsFromEntries(items: PickerEntry[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    if (it.isPet && !seen.has(it.name.toLowerCase())) {
      seen.add(it.name.toLowerCase());
      out.push(it.name);
    }
  }
  return out;
}

/** null ⇒ valid; the shared group-list checks for groups mode and each path. */
function validateGroupDrafts(groups: GroupDraft[], where = ""): string | null {
  for (const [i, g] of groups.entries()) {
    if (!g.items.length) return `${where}Requirement ${i + 1}: add at least one item.`;
    if (g.mode === "any_of" && g.need < 1)
      return `${where}Requirement ${i + 1}: "how many" must be at least 1.`;
  }
  const names = groups.flatMap((g) => g.items.map((it) => it.name.toLowerCase()));
  if (new Set(names).size !== names.length)
    return `${where}An item can only appear in one requirement group.`;
  return null;
}

/** Editable list of all-of / any-of requirement groups (shared between the
 * "Combined requirements" mode and each path of an "Either-or" task). */
function GroupListEditor({
  groups,
  onChange,
  search,
  resolve,
  renderEntryExtra,
  bossImport,
  searchPets,
}: {
  groups: GroupDraft[];
  onChange: (groups: GroupDraft[]) => void;
  search: (q: string) => Promise<EventMetaEntry[]>;
  resolve: (names: string[]) => Promise<EventMetaEntry[]>;
  renderEntryExtra?: (entry: PickerEntry, setNpcs: (npcs: string[]) => void) => React.ReactNode;
  bossImport?: BossImportApi;
  searchPets?: (q: string) => Promise<EventMetaEntry[]>;
}) {
  const patch = (gi: number, p: Partial<GroupDraft>) =>
    onChange(groups.map((g, i) => (i === gi ? { ...g, ...p } : g)));
  return (
    <div className="grid gap-3">
      {groups.map((g, gi) => (
        <div key={gi} className="border-osrs-bronze/25 grid gap-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-end gap-2">
            <span className="text-osrs-gold-bright/80 self-center text-xs font-semibold uppercase">
              Requirement {gi + 1}
            </span>
            <span className="grow" />
            <label className="grid gap-1 text-sm">
              <span className="text-osrs-parchment-dark/70 text-xs">Mode</span>
              <select
                value={g.mode}
                onChange={(e) => patch(gi, { mode: e.target.value as GroupDraft["mode"] })}
                className={field}
              >
                <option value="all_of">All of these</option>
                <option value="any_of">Any of these</option>
              </select>
            </label>
            {g.mode === "any_of" && (
              <label className="grid gap-1 text-sm">
                <span className="text-osrs-parchment-dark/70 text-xs">How many</span>
                <QuantityInput
                  min={1}
                  value={g.need}
                  onChange={(need) => patch(gi, { need })}
                  className={`${field} w-24`}
                />
              </label>
            )}
            {groups.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(groups.filter((_, i) => i !== gi))}
                className="border-osrs-bronze/40 text-osrs-parchment-dark/70 hover:border-osrs-red hover:text-osrs-red rounded border px-2 py-2 text-xs"
              >
                Remove
              </button>
            )}
          </div>
          <ItemNpcPicker
            kind="item"
            mode="list"
            selected={g.items}
            onChange={(items) => patch(gi, { items })}
            search={search}
            resolve={resolve}
            renderEntryExtra={renderEntryExtra}
            bossImport={bossImport}
            searchPets={searchPets}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...groups, { mode: "any_of", need: 1, items: [] }])}
        className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright justify-self-start rounded border px-3 py-1.5 text-xs"
      >
        + Add requirement group
      </button>
    </div>
  );
}

/** Debounced name autocomplete against the item/NPC databases.
 * (Legacy single-input variant — the task form now uses ItemNpcPicker, but
 * the points manager still builds on this.) */
export function NameSearch({
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

export function EventTaskForm({
  groupId,
  eventId,
  initial,
  onSaved,
  onCancel,
  onDraftSubmit,
  omitTypes,
  hideDifficulty,
  submitLabel,
}: {
  groupId: number | null;
  eventId: number;
  /** Present ⇒ edit mode (the task type is fixed; everything else edits).
   * In draft mode it only pre-fills the form — the type stays editable. */
  initial?: EventTask;
  onSaved?: (task: EventTask) => void;
  onCancel?: () => void;
  /** Draft mode: submit hands the built input to the caller instead of
   * calling the API (nothing is persisted here). */
  onDraftSubmit?: (input: EventTaskInput) => void;
  /** Task types to leave out of the type picker (e.g. loot_sweep makes no
   * sense on a bingo cell — it never completes). */
  omitTypes?: EventTask["type"][];
  /** Hide the board-game difficulty tier (meaningless outside dice boards). */
  hideDifficulty?: boolean;
  /** Override the submit button text. */
  submitLabel?: string;
}) {
  const draftMode = onDraftSubmit != null;
  const editing = !draftMode && initial != null;
  const initialPetNames = initial ? taskConfigPetNames(initial) : new Set<string>();
  const initialItems: PickerEntry[] = initial
    ? taskConfigItems(initial).map((it) => ({
        name: it.item_name,
        points: it.points,
        ...(it.npcs ? { npcs: it.npcs } : {}),
        ...(initialPetNames.has(it.item_name.toLowerCase()) ? { isPet: true } : {}),
      }))
    : [];
  const initialConfig = initial ? taskConfig(initial) : {};

  const [type, setType] = useState<EventTask["type"]>(initial?.type ?? "item_collection");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [points, setPoints] = useState(initial?.points ?? 0);
  const [requiresReview, setRequiresReview] = useState(initial?.requires_confirmation ?? false);
  const [difficulty, setDifficulty] = useState<"air" | "water" | "earth" | "fire" | null>(
    initial?.difficulty ?? null,
  );
  // Private by default (audit): defaulting to Public quietly shipped every
  // clan's in-jokes and event-specific labels into the shared cross-group
  // library — sharing should be a deliberate choice.
  const [visibility, setVisibility] = useState<"public" | "private">(
    initial?.visibility ?? "private",
  );

  // item_collection
  const initialGroups = groupsFromConfig(initialConfig, initialPetNames);
  const initialPaths = pathsFromConfig(initialConfig, initialPetNames);
  const [itemMode, setItemMode] = useState<ItemMode>(
    initialPaths.length
      ? "any_path"
      : initialGroups.length
        ? "groups"
        : initialItems.length
          ? ((initialConfig.kind as ItemMode) ?? "any_of")
          : "single",
  );
  const [singleItem, setSingleItem] = useState<PickerEntry[]>(
    initial?.type === "item_collection" && initial.target
      ? [
          {
            name: initial.target,
            ...(taskSourceNpcs(initial).length ? { npcs: taskSourceNpcs(initial) } : {}),
          },
        ]
      : [],
  );
  const [quantity, setQuantity] = useState(
    initial?.type === "item_collection" ? (initial.target_value ?? 1) : 1,
  );
  const [listItems, setListItems] = useState<PickerEntry[]>(initialItems);
  const [pointsGoal, setPointsGoal] = useState(
    initial?.type === "item_collection" && initialItems.length ? (initial.target_value ?? 0) : 0,
  );
  // any_of: how many qualifying drops complete the task ("any 2 boaters").
  const [anyOfQty, setAnyOfQty] = useState(
    initial?.type === "item_collection" && initialConfig.kind === "any_of"
      ? (initial.target_value ?? 1)
      : 1,
  );
  // Starter shape mirrors the classic use case: one all-of set + one any-of pick.
  const [groups, setGroups] = useState<GroupDraft[]>(
    initialGroups.length
      ? initialGroups
      : [
          { mode: "all_of", need: 1, items: [] },
          { mode: "any_of", need: 1, items: [] },
        ],
  );
  // Either-or starter mirrors the dryness-protection use case: a full set
  // OR any N pieces (the same items usually fill both paths). Paths can also
  // be metric goals — "boss pet OR 5,000 KC" — via the per-path type picker.
  const [paths, setPaths] = useState<PathDraft[]>(
    initialPaths.length
      ? initialPaths
      : [emptyPathDraft("items", "all_of"), emptyPathDraft("items", "any_of")],
  );
  const patchPath = (pi: number, patch: Partial<PathDraft>) =>
    setPaths((prev) => prev.map((p, i) => (i === pi ? { ...p, ...patch } : p)));

  // kc / pb / xp / skill / loot / ehp / ehb
  // kc_target may carry several NPCs (config.npcs) — a kill of ANY of them
  // counts; pb_target stays single-NPC.
  const [npcSel, setNpcSel] = useState<PickerEntry[]>(
    initial?.type === "kc_target" && Array.isArray(initialConfig.npcs)
      ? (initialConfig.npcs as string[]).map((name) => ({ name }))
      : initial && ["kc_target", "pb_target"].includes(initial.type) && initial.target
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
  // pb completion requirement: once (legacy) / N times / N unique players /
  // every rostered team member.
  const initialPbReq =
    initial?.type === "pb_target" ? pbRequirement(initial) : { mode: "times" as const, need: 1 };
  const [pbChoice, setPbChoice] = useState<PbChoice>(
    initialPbReq.mode === "times" && initialPbReq.need <= 1 ? "once" : initialPbReq.mode,
  );
  const [pbNeed, setPbNeed] = useState(Math.max(initialPbReq.need, 1));
  const [skill, setSkill] = useState(
    initial && ["xp_target", "skill_target"].includes(initial.type)
      ? (initial.target ?? "Attack")
      : "Attack",
  );
  const [sourceNpcs, setSourceNpcs] = useState<PickerEntry[]>(
    ((initialConfig.source_npcs as string[] | undefined) ?? []).map((name) => ({ name })),
  );
  const [customTarget, setCustomTarget] = useState(
    initial?.type === "custom" ? (initial.target ?? "") : "",
  );

  // pet_collection
  const initialPetCategories =
    initial?.type === "pet_collection" && Array.isArray(initialConfig.categories)
      ? (initialConfig.categories as string[])
      : [];
  const initialPetList =
    initial?.type === "pet_collection" && Array.isArray(initialConfig.pets)
      ? (initialConfig.pets as unknown[]).filter((n): n is string => typeof n === "string")
      : [];
  const [petMode, setPetMode] = useState<PetMode>(
    initial?.type === "pet_collection"
      ? initial.target
        ? "specific"
        : initialPetList.length
          ? "custom"
          : initialPetCategories.length
            ? "category"
            : "any"
      : "specific",
  );
  const [petItem, setPetItem] = useState<PickerEntry[]>(
    initial?.type === "pet_collection" && initial.target ? [{ name: initial.target }] : [],
  );
  const [petCategories, setPetCategories] = useState<string[]>(initialPetCategories);
  const [petList, setPetList] = useState<PickerEntry[]>(
    initialPetList.map((name) => ({ name })),
  );
  const [petCount, setPetCount] = useState(
    initial?.type === "pet_collection" ? (initial.target_value ?? 1) : 1,
  );
  const petName = petItem[0]?.name ?? "";
  const togglePetCategory = (key: string) =>
    setPetCategories((prev) =>
      prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key],
    );

  // Category → member-pets catalog, fetched once the first time a mode that
  // uses the presets is shown (seeds and previews the customizable list).
  const [petCatalog, setPetCatalog] = useState<EventPetCategory[] | null>(null);
  const petCatalogWanted =
    type === "pet_collection" && (petMode === "category" || petMode === "custom");
  useEffect(() => {
    if (!petCatalogWanted || petCatalog !== null) return;
    let cancelled = false;
    fetchEventPetCategories(groupId)
      .then((rows) => {
        if (!cancelled) setPetCatalog(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [petCatalogWanted, petCatalog, groupId]);

  /** Deduped picker entries for the pets in the given categories (raids
   * overlaps boss — Olmlet & co. appear once). */
  const petsForCategories = (keys: string[]): PickerEntry[] => {
    const out: PickerEntry[] = [];
    const seen = new Set<string>();
    for (const cat of petCatalog ?? []) {
      if (!keys.includes(cat.key)) continue;
      for (const p of cat.pets) {
        const k = p.name.toLowerCase();
        if (!seen.has(k)) {
          seen.add(k);
          out.push({ name: p.name, id: p.id });
        }
      }
    }
    return out;
  };

  /** "+ Boss pets" preset: merge that category's pets into the custom list. */
  const addPetPreset = (key: string) =>
    setPetList((prev) => {
      const seen = new Set(prev.map((p) => p.name.toLowerCase()));
      const added = petsForCategories([key]).filter((p) => !seen.has(p.name.toLowerCase()));
      return added.length ? [...prev, ...added] : prev;
    });

  /** Category mode → custom list, seeded with the chosen categories' pets so
   * individual ones can be removed (or extras added). */
  const customizePetList = () => {
    setPetList(petsForCategories(petCategories));
    setPetMode("custom");
  };

  // loot_sweep (one boss "set")
  const [lootSweep, setLootSweep] = useState<LootSweepDraft>(
    initial?.type === "loot_sweep" ? lootSweepFromConfig(initialConfig) : emptyLootSweepDraft(),
  );

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const searchItems = (q: string) => searchEventItems(groupId, q);
  const searchNpcs = (q: string) => searchEventNpcs(groupId, q);
  const searchPets = (q: string) => searchEventPets(groupId, q);
  const resolveItems = (names: string[]) => resolveEventMetaNames(groupId, "item", names);
  const resolveNpcs = (names: string[]) => resolveEventMetaNames(groupId, "npc", names);
  const fetchSources = (name: string) =>
    fetchItemSources(groupId, [name]).then((rows) => rows[0]?.npcs ?? []);
  // "Type a boss, add its drops" helper for every item-list picker.
  const bossImport: BossImportApi = {
    searchNpcs,
    fetchDrops: (npcId) => fetchNpcDropItems(groupId, npcId),
  };
  // Per-item "restrict to specific NPC sources" control, reused by every item
  // picker (single, flat list, groups, either-or paths).
  const renderSourceRestriction = (entry: PickerEntry, setNpcs: (npcs: string[]) => void) => (
    <ItemSourceRestriction
      itemName={entry.name}
      npcs={entry.npcs ?? []}
      onChange={setNpcs}
      fetchSources={fetchSources}
      disabled={pending}
    />
  );

  const itemName = singleItem[0]?.name ?? "";
  const npcName = npcSel[0]?.name ?? "";

  /** null ⇒ valid; otherwise the reason the submit button is disabled. */
  const validate = (): string | null => {
    switch (type) {
      case "item_collection":
        if (itemMode === "single") {
          if (!itemName) return "Pick an item.";
          if (quantity < 1) return "Quantity must be at least 1.";
        } else if (itemMode === "point_collection") {
          // point_collection is a points race — a single weighted item is a
          // valid config (e.g. 500 points of Zulrah's scales at 1pt each).
          if (listItems.length < 1) return "Add at least one item to the list.";
          if (pointsGoal < 1) return "Set a points goal.";
        } else if (itemMode === "groups") {
          const bad = validateGroupDrafts(groups);
          if (bad) return bad;
        } else if (itemMode === "any_path") {
          if (paths.length < 2) return "Add at least two paths — either-or needs alternatives.";
          for (const [pi, p] of paths.entries()) {
            if (p.kind === "kc") {
              if (!p.npcs.length) return `Path ${pi + 1}: pick at least one NPC to count kills at.`;
              if (p.need < 1) return `Path ${pi + 1}: set a kill count.`;
            } else if (p.kind === "loot_value") {
              if (p.need < 1) return `Path ${pi + 1}: set a GP goal.`;
            } else if (p.kind === "points") {
              if (p.items.length < 1) return `Path ${pi + 1}: add at least one item to the points list.`;
              if (p.need < 1) return `Path ${pi + 1}: set a points goal.`;
            } else {
              const bad = validateGroupDrafts(p.groups, `Path ${pi + 1}: `);
              if (bad) return bad;
            }
          }
        } else {
          if (listItems.length < 2) return "Add at least two items to the list.";
          if (itemMode === "any_of" && anyOfQty < 1)
            return "Set how many from the list are needed.";
        }
        break;
      case "kc_target":
        if (!npcSel.length) return "Pick at least one NPC.";
        if (numericGoal < 1) return "Set a kill count.";
        break;
      case "pb_target":
        if (!npcName) return "Pick an NPC.";
        if (parseTimeToSeconds(timeText) == null || parseTimeToSeconds(timeText)! < 1)
          return "Enter the time limit as mm:ss (or h:mm:ss).";
        if ((pbChoice === "times" || pbChoice === "unique_players") && pbNeed < 1)
          return pbChoice === "unique_players"
            ? "Set how many unique players must beat it."
            : "Set how many times it must be beaten.";
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
      case "pet_collection":
        if (petMode === "specific" && !petName) return "Pick a pet.";
        if (petMode === "category" && petCategories.length === 0)
          return "Choose at least one pet category.";
        if (petMode === "custom" && petList.length === 0)
          return "Add at least one pet to the list.";
        if (petMode !== "specific" && petCount < 1) return "Number of pets must be at least 1.";
        break;
      case "loot_sweep":
        if (lootSweep.groups.length < 1) return "Add at least one group.";
        for (const g of lootSweep.groups) {
          // NPCs are strongly recommended (items only count from their NPC), but
          // a few "section" sets legitimately span many sources — allow empty.
          if (g.items.length < 1) return "Every group needs at least one item.";
          if (g.items.some((i) => i.points < 1)) return "Every item needs at least 1 point.";
        }
        break;
      case "custom":
        break;
    }
    return null;
  };

  const suggestedLabel = (): string => {
    switch (type) {
      case "item_collection":
        if (itemMode === "single") return quantity > 1 ? `${quantity}× ${itemName}` : itemName;
        if (itemMode === "any_of")
          return anyOfQty > 1
            ? `Any ${anyOfQty} of ${listItems.length} items`
            : `Any of ${listItems.length} items`;
        if (itemMode === "all_of") return `Collect all ${listItems.length} items`;
        if (itemMode === "groups")
          return `Collect ${groups
            .map((g) =>
              g.mode === "all_of" ? `all ${g.items.length}` : `any ${g.need} of ${g.items.length}`,
            )
            .join(" + ")}`;
        if (itemMode === "any_path")
          return paths
            .map((p, pi) => {
              if (p.label.trim()) return p.label.trim();
              if (p.kind === "kc")
                return `${p.need.toLocaleString()} KC${p.npcs.length ? ` at ${p.npcs.map((n) => n.name).join(" / ")}` : ""}`;
              if (p.kind === "loot_value")
                return `${p.need.toLocaleString()} GP${p.npcs.length ? ` from ${p.npcs.map((n) => n.name).join(" / ")}` : ""}`;
              if (p.kind === "points") return `${p.need.toLocaleString()} pts`;
              return (
                p.groups
                  .map((g) =>
                    g.mode === "all_of"
                      ? `all ${g.items.length}`
                      : `any ${g.need} of ${g.items.length}`,
                  )
                  .join(" + ") || `path ${pi + 1}`
              );
            })
            .join(" OR ");
        return `${pointsGoal.toLocaleString()} collection points`;
      case "kc_target":
        return `${numericGoal}× ${npcSel.map((n) => n.name).join(" / ")}`;
      case "pb_target": {
        const base = `${npcName} in ${timeText}`;
        if (pbChoice === "whole_team") return `${base} — whole team`;
        if (pbChoice === "unique_players") return `${base} — ${pbNeed} unique players`;
        return pbChoice === "times" && pbNeed > 1 ? `${base} ×${pbNeed}` : base;
      }
      case "xp_target":
        return `${numericGoal.toLocaleString()} ${skill} XP`;
      case "skill_target":
        return `Level ${numericGoal} ${skill}`;
      case "loot_value":
        return `${numericGoal.toLocaleString()} GP${sourceNpcs.length ? ` from ${sourceNpcs.map((n) => n.name).join(", ")}` : ""}`;
      case "pet_collection": {
        const n = petCount > 1 ? `${petCount}× ` : "";
        if (petMode === "specific") return `${n}${petName}`;
        if (petMode === "category")
          return `${n}Any ${petCategories.map((c) => PET_CATEGORY_LABELS[c] ?? c).join(" / ").toLowerCase()}`;
        if (petMode === "custom")
          return petList.length <= 3
            ? `${n}Any of ${petList.map((p) => p.name).join(" / ")}`
            : `${n}Any of ${petList.length} pets`;
        return petCount > 1 ? `Any ${petCount} pets` : "Any pet";
      }
      case "loot_sweep": {
        const items = lootSweep.groups.reduce((n, g) => n + g.items.length, 0);
        if (lootSweep.groups.length === 1 && lootSweep.groups[0]?.label.trim())
          return lootSweep.groups[0].label.trim();
        return items ? `${items}-item Loot Sweep set` : "Loot Sweep set";
      }
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
      visibility,
      difficulty,
    };
    switch (type) {
      case "item_collection":
        if (itemMode === "single") {
          // Single-item source restriction rides in config.source_npcs.
          const src = singleItem[0]?.npcs ?? [];
          return {
            ...base,
            target: itemName,
            target_value: quantity,
            config: src.length ? JSON.stringify({ source_npcs: src }) : undefined,
          };
        }
        if (itemMode === "groups") {
          const groupItems = groups.flatMap((g) => g.items);
          const itemNpcs = itemNpcsFromEntries(groupItems);
          const petItems = petItemsFromEntries(groupItems);
          return {
            ...base,
            // Display value; the API recomputes the threshold from the groups.
            target_value: groupsNeed(groups),
            config: JSON.stringify({
              kind: "groups",
              groups: serializeGroups(groups),
              ...(Object.keys(itemNpcs).length ? { item_npcs: itemNpcs } : {}),
              ...(petItems.length ? { pet_items: petItems } : {}),
            }),
          };
        }
        if (itemMode === "any_path") {
          const pathItems = paths.flatMap((p) =>
            p.kind === "items"
              ? p.groups.flatMap((g) => g.items)
              : p.kind === "points"
                ? p.items
                : [],
          );
          const itemNpcs = itemNpcsFromEntries(pathItems);
          const petItems = petItemsFromEntries(pathItems);
          return {
            ...base,
            // Either-or progress is a percentage of the closest path; the
            // API pins the threshold to 100 either way.
            target_value: 100,
            config: JSON.stringify({
              kind: "any_path",
              paths: paths.map((p) => {
                const label = p.label.trim() ? { label: p.label.trim() } : {};
                if (p.kind === "kc" || p.kind === "loot_value") {
                  return {
                    ...label,
                    metric: p.kind,
                    need: p.need,
                    ...(p.npcs.length ? { npcs: p.npcs.map((n) => n.name) } : {}),
                  };
                }
                if (p.kind === "points") {
                  return {
                    ...label,
                    kind: "points",
                    need: p.need,
                    items: p.items.map((i) => ({ item_name: i.name, points: i.points ?? 1 })),
                  };
                }
                return { ...label, groups: serializeGroups(p.groups) };
              }),
              ...(Object.keys(itemNpcs).length ? { item_npcs: itemNpcs } : {}),
              ...(petItems.length ? { pet_items: petItems } : {}),
            }),
          };
        }
        {
          const itemNpcs = itemNpcsFromEntries(listItems);
          const petItems = petItemsFromEntries(listItems);
          return {
            ...base,
            target_value:
              itemMode === "point_collection"
                ? pointsGoal
                : itemMode === "any_of"
                  ? anyOfQty
                  : listItems.length,
            config: JSON.stringify({
              kind: itemMode,
              items:
                itemMode === "point_collection"
                  ? listItems.map((i) => ({ item_name: i.name, points: i.points ?? 1 }))
                  : listItems.map((i) => i.name),
              ...(Object.keys(itemNpcs).length ? { item_npcs: itemNpcs } : {}),
              ...(petItems.length ? { pet_items: petItems } : {}),
            }),
          };
        }
      case "kc_target": {
        // Several NPCs ride in config.npcs ("either counts"); a single NPC
        // keeps plain target semantics (the API collapses a 1-list anyway).
        const npcs = npcSel.map((n) => n.name);
        return {
          ...base,
          target: npcs[0],
          target_value: numericGoal,
          config: npcs.length > 1 ? JSON.stringify({ npcs }) : undefined,
        };
      }
      case "pb_target": {
        // Completion requirement rides in config; "beat it once" stays the
        // legacy config-free shape (the API collapses times ×1 anyway).
        const pbConfig =
          pbChoice === "whole_team"
            ? { mode: "whole_team" }
            : pbChoice === "unique_players"
              ? { mode: "unique_players", need: pbNeed }
              : pbChoice === "times" && pbNeed > 1
                ? { mode: "times", need: pbNeed }
                : null;
        return {
          ...base,
          target: npcName,
          target_value: parseTimeToSeconds(timeText) ?? 0,
          config: pbConfig ? JSON.stringify(pbConfig) : undefined,
        };
      }
      case "xp_target":
      case "skill_target":
        return { ...base, target: skill, target_value: numericGoal };
      case "loot_value":
        return {
          ...base,
          target_value: numericGoal,
          config: sourceNpcs.length
            ? JSON.stringify({ source_npcs: sourceNpcs.map((n) => n.name) })
            : undefined,
        };
      case "ehp_target":
      case "ehb_target":
        return { ...base, target_value: numericGoal };
      case "pet_collection":
        if (petMode === "specific")
          return { ...base, target: petName, target_value: petCount };
        if (petMode === "category")
          return {
            ...base,
            target_value: petCount,
            config: JSON.stringify({ categories: petCategories }),
          };
        if (petMode === "custom")
          return {
            ...base,
            target_value: petCount,
            config: JSON.stringify({ pets: petList.map((p) => p.name) }),
          };
        return { ...base, target_value: petCount }; // any pet (misc excluded)
      case "loot_sweep":
        // One task = one boss "set"; params + items live in config. The task
        // never "completes", so target/target_value are unused.
        return { ...base, config: lootSweepToConfig(lootSweep) };
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
    if (onDraftSubmit) {
      onDraftSubmit(input);
      return;
    }
    startTransition(async () => {
      try {
        if (editing) {
          await updateEventTask(groupId, eventId, initial.id, {
            label: input.label,
            target: input.target ?? null,
            target_value: input.target_value ?? null,
            points: input.points,
            requires_confirmation: input.requires_confirmation,
            visibility: input.visibility,
            difficulty: input.difficulty ?? null,
            // Explicit null clears a list config (e.g. back to single item);
            // the API revalidates the whole goal either way.
            config: input.config ?? null,
          });
          onSaved?.({ ...initial, ...input, config: input.config ?? null });
        } else {
          const res = await addEventTask(groupId, eventId, input);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          onSaved?.({
            ...input,
            id: res.id,
            points: input.points ?? 0,
            requires_confirmation: input.requires_confirmation ?? false,
            // The API may demote a public save to private when its
            // requirements duplicate an existing public preset.
            visibility: res.visibility ?? input.visibility ?? "private",
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
      <QuantityInput
        min={min}
        max={max}
        emptyAs={0}
        value={numericGoal}
        onChange={setNumericGoal}
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
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="text-osrs-parchment-dark/80">Task type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as EventTask["type"])}
            disabled={editing}
            className={field}
          >
            {EVENT_TASK_TYPES.filter((tt) => !omitTypes?.includes(tt)).map((tt) => (
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
                <QuantityInput min={1} value={quantity} onChange={setQuantity} className={field} />
              </label>
            ) : itemMode === "point_collection" ? (
              <label className="grid gap-1 text-sm">
                <span className="text-osrs-parchment-dark/80">Points goal</span>
                <QuantityInput
                  min={1}
                  emptyAs={0}
                  value={pointsGoal}
                  onChange={setPointsGoal}
                  className={field}
                />
              </label>
            ) : itemMode === "any_of" ? (
              <label className="grid gap-1 text-sm">
                <span className="text-osrs-parchment-dark/80">How many from the list</span>
                <QuantityInput
                  min={1}
                  value={anyOfQty}
                  onChange={setAnyOfQty}
                  className={field}
                  title="Total qualifying drops needed — duplicates count (any 2 boaters)."
                />
              </label>
            ) : null}
          </div>
          <p className="text-osrs-parchment-dark/50 text-xs">{ITEM_MODE_HELP[itemMode]}</p>
          {itemMode === "groups" ? (
            <GroupListEditor
              groups={groups}
              onChange={setGroups}
              search={searchItems}
              resolve={resolveItems}
              renderEntryExtra={renderSourceRestriction}
              bossImport={bossImport}
              searchPets={searchPets}
            />
          ) : itemMode === "any_path" ? (
            <div className="grid gap-2">
              {paths.map((p, pi) => (
                <div key={pi} className="grid gap-2">
                  {pi > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="bg-osrs-bronze/25 h-px flex-1" />
                      <span className="text-osrs-gold-bright text-xs font-bold uppercase">or</span>
                      <span className="bg-osrs-bronze/25 h-px flex-1" />
                    </div>
                  )}
                  <div className="border-osrs-gold/25 bg-osrs-brown-dark/20 grid gap-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-end gap-2">
                      <span className="text-osrs-gold-bright/80 self-center text-xs font-semibold uppercase">
                        Path {pi + 1}
                      </span>
                      <label className="grid gap-1 text-sm">
                        <span className="text-osrs-parchment-dark/70 text-xs">Counts</span>
                        <select
                          value={p.kind}
                          onChange={(e) => {
                            const kind = e.target.value as PathKind;
                            patchPath(pi, {
                              ...emptyPathDraft(kind),
                              label: p.label,
                              // Keep whatever the admin already built in case
                              // they toggle back.
                              ...(kind === "items" && p.groups.length
                                ? { groups: p.groups }
                                : {}),
                              ...(kind === "points" && p.items.length
                                ? { items: p.items }
                                : {}),
                            });
                          }}
                          className={field}
                          disabled={pending}
                        >
                          {(Object.keys(PATH_KIND_LABELS) as PathKind[]).map((k) => (
                            <option key={k} value={k}>
                              {PATH_KIND_LABELS[k]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid grow gap-1 text-sm">
                        <span className="text-osrs-parchment-dark/70 text-xs">
                          Path name (optional, shown to players)
                        </span>
                        <input
                          value={p.label}
                          onChange={(e) => patchPath(pi, { label: e.target.value })}
                          placeholder={pi === 0 ? "e.g. Full set" : "e.g. 5,000 kills"}
                          maxLength={80}
                          className={field}
                        />
                      </label>
                      {paths.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPaths((prev) => prev.filter((_, i) => i !== pi))}
                          className="border-osrs-bronze/40 text-osrs-parchment-dark/70 hover:border-osrs-red hover:text-osrs-red rounded border px-2 py-2 text-xs"
                        >
                          Remove path
                        </button>
                      )}
                    </div>
                    {p.kind === "items" ? (
                      <GroupListEditor
                        groups={p.groups}
                        onChange={(gs) => patchPath(pi, { groups: gs })}
                        search={searchItems}
                        resolve={resolveItems}
                        renderEntryExtra={renderSourceRestriction}
                        bossImport={bossImport}
                        searchPets={searchPets}
                      />
                    ) : p.kind === "points" ? (
                      <div className="grid gap-2">
                        <label className="grid gap-1 text-sm sm:max-w-56">
                          <span className="text-osrs-parchment-dark/80">Points goal</span>
                          <QuantityInput
                            min={1}
                            emptyAs={0}
                            value={p.need}
                            onChange={(need) => patchPath(pi, { need })}
                            className={field}
                            title="Weighted point total the team must reach to finish this path."
                          />
                        </label>
                        <p className="text-osrs-parchment-dark/50 text-xs">
                          Each item is worth points — the team races to the goal. Weight rare
                          drops higher.
                        </p>
                        <ItemNpcPicker
                          kind="item"
                          mode="list"
                          withPoints
                          selected={p.items}
                          onChange={(items) => patchPath(pi, { items })}
                          search={searchItems}
                          resolve={resolveItems}
                          renderEntryExtra={renderSourceRestriction}
                          bossImport={bossImport}
                          searchPets={searchPets}
                        />
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        <label className="grid gap-1 text-sm sm:max-w-56">
                          <span className="text-osrs-parchment-dark/80">
                            {p.kind === "kc" ? "Kill count" : "GP goal"}
                          </span>
                          <QuantityInput
                            value={p.need}
                            onChange={(need) => patchPath(pi, { need })}
                            className={field}
                            title={
                              p.kind === "kc"
                                ? "Kills of the listed NPC(s) that complete this path."
                                : "Total GP of qualifying drops that completes this path."
                            }
                          />
                        </label>
                        <ItemNpcPicker
                          kind="npc"
                          mode="list"
                          selected={p.npcs}
                          onChange={(npcs) => patchPath(pi, { npcs })}
                          search={searchNpcs}
                          resolve={resolveNpcs}
                          selectionTitle={p.kind === "kc" ? "Count kills at" : "Only drops from"}
                          emptyHint={
                            p.kind === "kc"
                              ? "Add one or more NPCs — a kill of any of them counts."
                              : "Optional — leave empty to count drops from any source."
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {paths.length < 4 && (
                <button
                  type="button"
                  onClick={() => setPaths((prev) => [...prev, emptyPathDraft("items")])}
                  className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright justify-self-start rounded border px-3 py-1.5 text-xs"
                >
                  + Add path
                </button>
              )}
            </div>
          ) : (
            <ItemNpcPicker
              kind="item"
              mode={itemMode === "single" ? "single" : "list"}
              withPoints={itemMode === "point_collection"}
              selected={itemMode === "single" ? singleItem : listItems}
              onChange={itemMode === "single" ? setSingleItem : setListItems}
              search={searchItems}
              resolve={resolveItems}
              renderEntryExtra={renderSourceRestriction}
              bossImport={bossImport}
              searchPets={searchPets}
            />
          )}
        </div>
      )}

      {(type === "kc_target" || type === "pb_target") && (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {type === "kc_target" ? (
              goalField("Kill count", "e.g. 50")
            ) : (
              <>
                <label className="grid gap-1 text-sm">
                  <span className="text-osrs-parchment-dark/80">Time limit (mm:ss or h:mm:ss)</span>
                  <input
                    value={timeText}
                    onChange={(e) => setTimeText(e.target.value)}
                    placeholder="e.g. 1:10"
                    className={field}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-osrs-parchment-dark/80">The time must be…</span>
                  <select
                    value={pbChoice}
                    onChange={(e) => setPbChoice(e.target.value as PbChoice)}
                    className={field}
                    disabled={pending}
                  >
                    {(Object.keys(PB_CHOICE_LABELS) as PbChoice[]).map((c) => (
                      <option key={c} value={c}>
                        {PB_CHOICE_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </label>
                {(pbChoice === "times" || pbChoice === "unique_players") && (
                  <label className="grid gap-1 text-sm">
                    <span className="text-osrs-parchment-dark/80">
                      {pbChoice === "times" ? "Times to beat it" : "Unique players needed"}
                    </span>
                    <QuantityInput
                      value={pbNeed}
                      onChange={setPbNeed}
                      className={field}
                      title={PB_CHOICE_HELP[pbChoice]}
                    />
                  </label>
                )}
              </>
            )}
          </div>
          {type === "pb_target" && (
            <p className="text-osrs-parchment-dark/50 text-xs">{PB_CHOICE_HELP[pbChoice]}</p>
          )}
          <ItemNpcPicker
            kind="npc"
            mode={type === "kc_target" ? "list" : "single"}
            selected={npcSel}
            onChange={setNpcSel}
            search={searchNpcs}
            resolve={resolveNpcs}
            selectionTitle={type === "kc_target" ? "Target NPC(s)" : "Target NPC"}
            emptyHint={
              type === "kc_target"
                ? "Add one or more NPCs — a kill of any of them counts toward the goal."
                : undefined
            }
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
          <div className="grid gap-3 sm:grid-cols-2">
            {goalField("GP to earn", "e.g. 25000000")}
          </div>
          <div className="grid gap-1 text-sm">
            <span className="text-osrs-parchment-dark/80">
              Only count drops from (optional)
            </span>
            <ItemNpcPicker
              kind="npc"
              mode="list"
              selected={sourceNpcs}
              onChange={setSourceNpcs}
              search={searchNpcs}
              resolve={resolveNpcs}
              selectionTitle="Counting drops from"
              emptyHint="Leave empty to count drops from anywhere."
            />
          </div>
        </div>
      )}

      {type === "pet_collection" && (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-osrs-parchment-dark/80">Pet requirement</span>
              <select
                value={petMode}
                onChange={(e) => setPetMode(e.target.value as PetMode)}
                className={field}
              >
                {(Object.keys(PET_MODE_LABELS) as PetMode[]).map((m) => (
                  <option key={m} value={m}>
                    {PET_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            {petMode !== "specific" && (
              <label className="grid gap-1 text-sm">
                <span className="text-osrs-parchment-dark/80">Number of pets</span>
                <QuantityInput
                  min={1}
                  value={petCount}
                  onChange={setPetCount}
                  className={field}
                  title="How many qualifying pets the team must obtain (default 1)."
                />
              </label>
            )}
          </div>
          <p className="text-osrs-parchment-dark/50 text-xs">{PET_MODE_HELP[petMode]}</p>
          {petMode === "specific" ? (
            <ItemNpcPicker
              kind="item"
              mode="single"
              selected={petItem}
              onChange={setPetItem}
              search={searchPets}
              resolve={resolveItems}
              selectionTitle="Pet"
            />
          ) : petMode === "category" ? (
            <div className="grid gap-2">
              <div className="flex flex-wrap gap-2">
                {PET_CATEGORY_KEYS.map((key) => {
                  const on = petCategories.includes(key);
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => togglePetCategory(key)}
                      aria-pressed={on}
                      className={`rounded border px-3 py-1.5 text-sm ${
                        on
                          ? "border-osrs-gold bg-osrs-gold/15 text-osrs-gold-bright"
                          : "border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold"
                      }`}
                    >
                      {PET_CATEGORY_LABELS[key]}
                    </button>
                  );
                })}
              </div>
              {petCategories.length > 0 &&
                petCatalog &&
                (() => {
                  const included = petsForCategories(petCategories);
                  return (
                    <div className="border-osrs-bronze/30 grid gap-2 rounded border p-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-osrs-parchment-dark/60 text-xs">
                          {included.length} pets currently count — new pets released into
                          these categories count automatically.
                        </span>
                        <button
                          type="button"
                          onClick={customizePetList}
                          disabled={pending}
                          className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border px-2.5 py-1 text-xs"
                          title="Copy these pets into an editable list — remove some or add extras."
                        >
                          Customize this list…
                        </button>
                      </div>
                      <ul className="flex flex-wrap gap-1.5">
                        {included.map((p) => (
                          <li
                            key={p.name}
                            className="border-osrs-bronze/30 text-osrs-parchment-dark/80 flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs"
                          >
                            <ItemDbIcon itemId={p.id} size={16} />
                            {p.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
            </div>
          ) : petMode === "custom" ? (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-osrs-parchment-dark/60 text-xs">Add a preset:</span>
                {PET_CATEGORY_KEYS.map((key) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => addPetPreset(key)}
                    disabled={pending || !petCatalog}
                    className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold rounded border px-2.5 py-1 text-xs disabled:opacity-50"
                    title={`Add every ${(PET_CATEGORY_LABELS[key] ?? key).toLowerCase()} to the list (already-listed pets are skipped).`}
                  >
                    + {PET_CATEGORY_LABELS[key] ?? key}
                  </button>
                ))}
                {petList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPetList([])}
                    disabled={pending}
                    className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-xs underline"
                  >
                    Clear list
                  </button>
                )}
              </div>
              <ItemNpcPicker
                kind="item"
                mode="list"
                selected={petList}
                onChange={setPetList}
                search={searchPets}
                resolve={resolveItems}
                disabled={pending}
                selectionTitle="Pets that count"
                emptyHint="Add a category preset above, or search for individual pets."
              />
            </div>
          ) : null}
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

      {type === "loot_sweep" && (
        <LootSweepEditor
          value={lootSweep}
          onChange={setLootSweep}
          searchItems={searchItems}
          searchNpcs={searchNpcs}
          uploadImage={
            groupId != null
              ? (form) => uploadLootSweepImage(groupId, eventId, form)
              : undefined
          }
          disabled={pending}
        />
      )}

      {/* ── points / review / sharing / submit ───────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Loot Sweep scores from its per-item config, not a flat task award. */}
        {type !== "loot_sweep" && (
          <label className="grid gap-1 text-sm">
            <span className="text-osrs-parchment-dark/80">Points</span>
            <QuantityInput min={0} value={points} onChange={setPoints} className={`${field} w-24`} />
          </label>
        )}
        {!hideDifficulty && (
          <label className="grid gap-1 text-sm">
            <span className="text-osrs-parchment-dark/80">Difficulty</span>
            <select
              value={difficulty ?? ""}
              onChange={(e) =>
                setDifficulty((e.target.value || null) as typeof difficulty)
              }
              className={field}
              title="Board-game tier: difficulty tiles roll random tasks from this tier's pool"
            >
              <option value="">— none —</option>
              {EVENT_TASK_DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {TASK_DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1 text-sm">
          <span className="text-osrs-parchment-dark/80">Task library</span>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as "public" | "private")}
            className={field}
            title="Every task is saved to the reusable task library — choose who can find it there"
          >
            <option value="private">Private — save for this clan only</option>
            <option value="public">Public — share it so any clan can reuse it</option>
          </select>
        </label>
        <label className="text-osrs-parchment-dark/80 mb-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={requiresReview}
            onChange={(e) => setRequiresReview(e.target.checked)}
          />
          Completions require admin review
        </label>
        <div className="ml-auto flex items-center gap-2">
          {validate() !== null && (
            <span className="text-osrs-parchment-dark/50 text-xs">{validate()}</span>
          )}
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
            {submitLabel ?? (editing ? "Save task" : "Add task")}
          </button>
        </div>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
    </form>
  );
}
