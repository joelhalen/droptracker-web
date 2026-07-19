"use client";

/**
 * Loot Sweep set editor (v2) — the authoring side of a `loot_sweep` task. A set
 * is one or more **groups** (sub-sets): each group ties items to its source
 * NPC(s), awards a bonus when its items are collected once, and the whole set
 * awards a bonus when every group is done. Items decay in batches
 * (`awardsPerTier`) — the live preview shows the exact sequence.
 *
 * Controlled: the parent (event-task-form) owns a `LootSweepDraft` and turns it
 * into the task `config` via {@link lootSweepToConfig}.
 */

import { useEffect, useRef, useState } from "react";
import type { EventMetaEntry, LootSweepDecayMode } from "@droptracker/api-types";
import { ItemDbIcon } from "@/components/item-db-icon";
import { QuantityInput } from "@/components/quantity-input";
import { decaySequence, defaultMaxAwards } from "@/lib/loot-sweep";

export type LootSweepEntity = { name: string; id?: number | null };

export type LootSweepItemDraft = {
  name: string;
  id?: number | null;
  points: number;
  awardsPerTier: number;
  maxAwards?: number | null;
  countsForGroup: boolean;
  /** "drop" (NPC-scoped) or "pet" (credited from a pet submission by name). */
  source: "drop" | "pet";
  /** Alternate drop names that credit this same entry (vestige + gold ring,
   * or an "any ancestral piece" pool listing every piece). */
  matchNames: string[];
  /** Receipts (any mix of names) needed before this entry counts toward the
   * group's completion — "any 3 ancestral pieces". Default 1. */
  required: number;
};

export type LootSweepGroupDraft = {
  label: string;
  npcs: LootSweepEntity[];
  bonusPoints: number;
  bonusMax: number;
  items: LootSweepItemDraft[];
  /** Custom uploaded boss/category image; null = use the NPC's own art. */
  imageUrl: string | null;
};

export type LootSweepDraft = {
  decayPercent: number;
  decayMode: LootSweepDecayMode;
  setBonusPoints: number;
  setBonusMax: number;
  groups: LootSweepGroupDraft[];
};

const emptyGroup = (): LootSweepGroupDraft => ({
  label: "",
  npcs: [],
  bonusPoints: 0,
  bonusMax: 1,
  items: [],
  imageUrl: null,
});

export function emptyLootSweepDraft(): LootSweepDraft {
  return {
    decayPercent: 20,
    decayMode: "linear",
    setBonusPoints: 0,
    setBonusMax: 1,
    groups: [emptyGroup()],
  };
}

/** Rebuild the editor draft from a stored `loot_sweep` config (v2, with a v1
 * flat-items fallback). */
export function lootSweepFromConfig(config: Record<string, unknown> | null | undefined): LootSweepDraft {
  const c = (config ?? {}) as Record<string, unknown>;
  const rawGroups = Array.isArray(c.groups)
    ? (c.groups as Record<string, unknown>[])
    : Array.isArray(c.items)
      ? [{ npcs: (c.npcs as unknown[]) ?? [], bonus_points: c.set_bonus_points, items: c.items }]
      : [];
  const group = (g: Record<string, unknown>): LootSweepGroupDraft => ({
    label: String(g.label ?? ""),
    npcs: (Array.isArray(g.npcs) ? (g.npcs as unknown[]) : []).map((n) => ({
      name: String(n),
      id: null,
    })),
    bonusPoints: typeof g.bonus_points === "number" ? g.bonus_points : 0,
    bonusMax: typeof g.bonus_max === "number" ? g.bonus_max : 1,
    imageUrl: typeof g.image_url === "string" ? g.image_url : null,
    items: (Array.isArray(g.items) ? (g.items as Record<string, unknown>[]) : []).map((it) => ({
      name: String(it.item_name ?? it.name ?? ""),
      id: typeof it.item_id === "number" ? it.item_id : null,
      points: typeof it.points === "number" ? it.points : 1,
      awardsPerTier: typeof it.awards_per_tier === "number" ? it.awards_per_tier : 1,
      maxAwards: typeof it.max_awards === "number" ? it.max_awards : null,
      countsForGroup: it.counts_for_group !== false,
      source: it.source === "pet" ? "pet" : "drop",
      matchNames: Array.isArray(it.match_names) ? (it.match_names as unknown[]).map(String) : [],
      required: typeof it.required === "number" && it.required > 1 ? it.required : 1,
    })),
  });
  return {
    decayPercent: typeof c.decay_percent === "number" ? c.decay_percent : 20,
    decayMode: c.decay_mode === "geometric" ? "geometric" : "linear",
    setBonusPoints: typeof c.set_bonus_points === "number" ? c.set_bonus_points : 0,
    setBonusMax: typeof c.set_bonus_max === "number" ? c.set_bonus_max : 1,
    groups: rawGroups.length ? rawGroups.map(group) : [emptyGroup()],
  };
}

/** Serialize the draft into the task `config` the backend validates. */
export function lootSweepToConfig(d: LootSweepDraft): string {
  return JSON.stringify({
    kind: "loot_sweep",
    decay_percent: d.decayPercent,
    decay_mode: d.decayMode,
    set_bonus_points: d.setBonusPoints,
    set_bonus_max: d.setBonusMax,
    groups: d.groups.map((g) => ({
      ...(g.label.trim() ? { label: g.label.trim() } : {}),
      npcs: g.npcs.map((n) => n.name),
      ...(g.imageUrl ? { image_url: g.imageUrl } : {}),
      bonus_points: g.bonusPoints,
      bonus_max: g.bonusMax,
      items: g.items.map((i) => ({
        item_name: i.name,
        ...(i.id != null ? { item_id: i.id } : {}),
        points: i.points,
        ...(i.awardsPerTier > 1 ? { awards_per_tier: i.awardsPerTier } : {}),
        ...(i.maxAwards != null ? { max_awards: i.maxAwards } : {}),
        ...(i.countsForGroup ? {} : { counts_for_group: false }),
        ...(i.source === "pet" ? { source: "pet" } : {}),
        ...(i.matchNames.length ? { match_names: i.matchNames } : {}),
        ...(i.required > 1 ? { required: i.required } : {}),
      })),
    })),
  });
}

const field =
  "bg-osrs-brown-dark/60 border-osrs-bronze/30 text-osrs-parchment focus:ring-osrs-gold/60 rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1";

const IMG_BASE = "/img";

function EntityIcon({ kind, id, size = 22 }: { kind: "item" | "npc"; id?: number | null; size?: number }) {
  if (kind === "item") return <ItemDbIcon itemId={id} size={size} />;
  if (id == null) return <span style={{ width: size, height: size }} className="inline-block shrink-0" />;
  return (
    <img
      src={`${IMG_BASE}/npcdb/${id}.png`}
      alt=""
      width={size}
      height={size}
      className="inline-block shrink-0 object-contain"
      onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")}
    />
  );
}

/** Compact debounced search dropdown, reused for items and NPCs. */
function InlineSearch({
  kind,
  search,
  onPick,
  placeholder,
  disabled,
  taken,
}: {
  kind: "item" | "npc";
  search: (q: string) => Promise<EventMetaEntry[]>;
  onPick: (e: EventMetaEntry) => void;
  placeholder: string;
  disabled?: boolean;
  taken: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EventMetaEntry[]>([]);
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
        if (seq.current === mine) setResults(rows);
      } catch {
        if (seq.current === mine) setResults([]);
      } finally {
        if (seq.current === mine) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, search]);

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (results[0]) {
              onPick(results[0]);
              setQuery("");
              setResults([]);
            }
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={`${field} w-full`}
      />
      {query.trim().length >= 2 && (results.length > 0 || searching) && (
        <ul className="border-osrs-bronze/30 bg-osrs-brown-dark absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded border shadow-lg">
          {searching && !results.length ? (
            <li className="text-osrs-parchment-dark/50 px-3 py-2 text-xs">Searching…</li>
          ) : (
            results.map((r) => {
              const added = taken.has(r.name.toLowerCase());
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => {
                      onPick(r);
                      setQuery("");
                      setResults([]);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                      added ? "text-osrs-gold-bright/70" : "text-osrs-parchment hover:bg-osrs-bronze/20"
                    }`}
                  >
                    <EntityIcon kind={kind} id={r.id} />
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    {kind === "item" && r.tracked === false && (
                      <span className="text-amber-500/80 text-xs">⚠ never dropped</span>
                    )}
                    <span className="text-osrs-parchment-dark/40 text-xs">{added ? "✓" : "+"}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

function GroupCard({
  group,
  index,
  decayPercent,
  decayMode,
  onChange,
  onRemove,
  removable,
  searchItems,
  searchNpcs,
  uploadImage,
  disabled,
}: {
  group: LootSweepGroupDraft;
  index: number;
  decayPercent: number;
  decayMode: LootSweepDecayMode;
  onChange: (g: LootSweepGroupDraft) => void;
  onRemove: () => void;
  removable: boolean;
  searchItems: (q: string) => Promise<EventMetaEntry[]>;
  searchNpcs: (q: string) => Promise<EventMetaEntry[]>;
  uploadImage?: (form: FormData) => Promise<{ url: string }>;
  disabled?: boolean;
}) {
  const patch = (p: Partial<LootSweepGroupDraft>) => onChange({ ...group, ...p });
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uploadImage) return;
    setUploading(true);
    setUploadErr(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const { url } = await uploadImage(form);
      patch({ imageUrl: url });
    } catch {
      setUploadErr("Upload failed — PNG/JPEG/WebP, under 4 MB.");
    } finally {
      setUploading(false);
    }
  };
  const itemNames = new Set(
    group.items.flatMap((i) => [i.name.toLowerCase(), ...i.matchNames.map((a) => a.toLowerCase())]),
  );
  const npcNames = new Set(group.npcs.map((n) => n.name.toLowerCase()));

  const addItem = (e: EventMetaEntry) => {
    if (itemNames.has(e.name.toLowerCase())) return;
    patch({
      items: [
        ...group.items,
        { name: e.name, id: e.id, points: 1, awardsPerTier: 1, maxAwards: null,
          countsForGroup: true, source: "drop", matchNames: [], required: 1 },
      ],
    });
  };
  const patchItem = (i: number, p: Partial<LootSweepItemDraft>) =>
    patch({ items: group.items.map((it, idx) => (idx === i ? { ...it, ...p } : it)) });
  // Which item row has its "also counts" search open (by item name).
  const [aliasOpenFor, setAliasOpenFor] = useState<string | null>(null);

  return (
    <div className="border-osrs-bronze/25 bg-osrs-brown-dark/20 grid gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <input
          value={group.label}
          onChange={(e) => patch({ label: e.target.value })}
          placeholder={`Group ${index + 1} name (e.g. Ahrim)`}
          disabled={disabled}
          className={`${field} flex-1`}
        />
        {removable && !disabled && (
          <button
            type="button"
            onClick={onRemove}
            className="text-osrs-parchment-dark/50 hover:text-osrs-red text-sm"
            aria-label={`Remove group ${index + 1}`}
          >
            Remove group
          </button>
        )}
      </div>

      {/* boss/category image */}
      {uploadImage && (
        <div className="flex items-center gap-3">
          {group.imageUrl ? (            <img
              src={group.imageUrl}
              alt=""
              className="border-osrs-bronze/30 h-12 w-12 rounded border object-contain"
            />
          ) : (
            <div className="border-osrs-bronze/20 text-osrs-parchment-dark/30 flex h-12 w-12 items-center justify-center rounded border border-dashed text-[9px]">
              no img
            </div>
          )}
          <div className="grid gap-0.5 text-xs">
            <div className="flex items-center gap-2">
              <label
                className={`text-osrs-parchment-dark/80 hover:text-osrs-gold-bright cursor-pointer ${
                  uploading || disabled ? "pointer-events-none opacity-50" : ""
                }`}
              >
                {uploading ? "Uploading…" : group.imageUrl ? "Replace image" : "Upload image"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  disabled={uploading || disabled}
                  onChange={onPickImage}
                />
              </label>
              {group.imageUrl && !disabled && (
                <button
                  type="button"
                  onClick={() => patch({ imageUrl: null })}
                  className="text-osrs-parchment-dark/50 hover:text-osrs-red"
                >
                  Remove
                </button>
              )}
            </div>
            <span className="text-osrs-parchment-dark/40">
              {uploadErr ?? "Optional — the boss's own NPC art is used if none is set."}
            </span>
          </div>
        </div>
      )}

      {/* NPCs */}
      <div className="grid gap-1.5">
        <span className="text-osrs-parchment-dark/70 text-xs">
          Source NPC(s) — items only count when dropped by these
        </span>
        {group.npcs.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {group.npcs.map((n) => (
              <li
                key={n.name}
                className="border-osrs-bronze/30 bg-osrs-brown-dark/60 flex items-center gap-1.5 rounded border px-2 py-1 text-xs"
              >
                <EntityIcon kind="npc" id={n.id} size={16} />
                <span className="text-osrs-parchment">{n.name}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => patch({ npcs: group.npcs.filter((x) => x.name !== n.name) })}
                    className="text-osrs-parchment-dark/50 hover:text-osrs-red"
                    aria-label={`Remove ${n.name}`}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <InlineSearch
          kind="npc"
          search={searchNpcs}
          onPick={(e) => !npcNames.has(e.name.toLowerCase()) && patch({ npcs: [...group.npcs, { name: e.name, id: e.id }] })}
          placeholder="Add a source NPC…"
          disabled={disabled}
          taken={npcNames}
        />
      </div>

      {/* group bonus */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs">
          <span className="text-osrs-parchment-dark/80">Group bonus (all items once)</span>
          <QuantityInput
            min={0}
            emptyAs={0}
            value={group.bonusPoints}
            onChange={(n) => patch({ bonusPoints: n })}
            disabled={disabled}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-xs">
          <span className="text-osrs-parchment-dark/80">Group bonus max</span>
          <QuantityInput
            min={1}
            max={100}
            value={group.bonusMax}
            onChange={(n) => patch({ bonusMax: n })}
            disabled={disabled || group.bonusPoints <= 0}
            className={field}
          />
        </label>
      </div>

      {/* items */}
      <InlineSearch
        kind="item"
        search={searchItems}
        onPick={addItem}
        placeholder="Add an item to this group…"
        disabled={disabled}
        taken={itemNames}
      />
      {group.items.length === 0 ? (
        <p className="border-osrs-bronze/20 text-osrs-parchment-dark/40 rounded border border-dashed px-3 py-4 text-center text-xs">
          Search above to add this group&apos;s items.
        </p>
      ) : (
        <ul className="grid gap-2">
          {group.items.map((it, idx) => {
            const max = it.maxAwards ?? defaultMaxAwards(it.awardsPerTier);
            const seqPts = decaySequence(it.points, max, decayPercent, it.awardsPerTier, decayMode);
            return (
              <li
                key={it.name}
                className="border-osrs-bronze/20 bg-osrs-brown-dark/40 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded border p-2"
              >
                <ItemDbIcon itemId={it.id} size={26} />
                <span className="text-osrs-parchment min-w-0 flex-1 truncate text-sm">
                  {it.name}
                  {it.source === "pet" && (
                    <span
                      className="border-osrs-gold/40 text-osrs-gold-bright ml-1.5 rounded border px-1 text-[10px]"
                      title="Credited from a pet submission (not a drop)"
                    >
                      pet
                    </span>
                  )}
                </span>
                <label className="flex items-center gap-1 text-xs">
                  <span className="text-osrs-parchment-dark/70">Pts</span>
                  <QuantityInput
                    min={1}
                    value={it.points}
                    onChange={(n) => patchItem(idx, { points: n })}
                    disabled={disabled}
                    className={`${field} w-14`}
                    title="Points the first receipt is worth."
                  />
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <span
                    className="text-osrs-parchment-dark/70"
                    title="Receipts per decay step — how many pay the SAME points before the next −% step (1 = decay every receipt; 3 = full points ×3, then step). Not a completion requirement."
                  >
                    /step
                  </span>
                  <QuantityInput
                    min={1}
                    max={20}
                    value={it.awardsPerTier}
                    onChange={(n) => patchItem(idx, { awardsPerTier: n })}
                    disabled={disabled}
                    className={`${field} w-12`}
                    title="How many receipts share each decay tier (1 = decay every receipt; 3 = full for 3, then step)."
                  />
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <span
                    className="text-osrs-parchment-dark/70"
                    title="Receipts needed (any mix of this entry's names) before it counts toward the group's completion — e.g. 3 for an 'any 3 ancestral pieces' entry."
                  >
                    Need
                  </span>
                  <QuantityInput
                    min={1}
                    max={100}
                    value={it.required}
                    onChange={(n) => patchItem(idx, { required: n })}
                    disabled={disabled}
                    className={`${field} w-12`}
                    title="How many receipts complete this entry for the group (default 1)."
                  />
                </label>
                <label
                  className="flex items-center gap-1.5 text-xs"
                  title="Required for this group's bonus? Turn off for pets / mega-rares."
                >
                  <input
                    type="checkbox"
                    checked={it.countsForGroup}
                    onChange={(e) => patchItem(idx, { countsForGroup: e.target.checked })}
                    disabled={disabled}
                    className="accent-osrs-gold"
                  />
                  <span className="text-osrs-parchment-dark/70">In group</span>
                </label>
                <span
                  className="text-osrs-parchment-dark/60 w-full font-mono text-[11px] sm:ml-auto sm:w-auto"
                  title="Points per successive receipt"
                >
                  {seqPts.join(" · ")}
                </span>
                {!disabled && it.matchNames.length === 0 && aliasOpenFor !== it.name && (
                  <button
                    type="button"
                    onClick={() => setAliasOpenFor(it.name)}
                    className="text-osrs-parchment-dark/50 hover:text-osrs-gold-bright text-[11px]"
                    title="Add another item name that credits this same entry (e.g. Gold ring on a vestige)"
                  >
                    + also counts
                  </button>
                )}
                {(it.matchNames.length > 0 || aliasOpenFor === it.name) && (
                  <div className="flex w-full flex-wrap items-center gap-1.5 pl-9">
                    <span className="text-osrs-parchment-dark/50 text-[10px] font-medium uppercase tracking-wider">
                      also counts
                    </span>
                    {it.matchNames.map((alias) => (
                      <span
                        key={alias}
                        className="border-osrs-bronze/30 text-osrs-parchment/80 flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]"
                      >
                        {alias}
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() =>
                              patchItem(idx, { matchNames: it.matchNames.filter((a) => a !== alias) })
                            }
                            className="text-osrs-parchment-dark/50 hover:text-osrs-red"
                            aria-label={`Remove ${alias}`}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                    {!disabled && aliasOpenFor === it.name ? (
                      <div className="w-56">
                        <InlineSearch
                          kind="item"
                          search={searchItems}
                          taken={itemNames}
                          placeholder="Another name that counts…"
                          onPick={(e) =>
                            patchItem(idx, { matchNames: [...it.matchNames, e.name] })
                          }
                          disabled={disabled}
                        />
                      </div>
                    ) : (
                      !disabled && (
                        <button
                          type="button"
                          onClick={() => setAliasOpenFor(it.name)}
                          className="text-osrs-parchment-dark/50 hover:text-osrs-gold-bright text-[11px]"
                        >
                          + add
                        </button>
                      )
                    )}
                  </div>
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => patch({ items: group.items.filter((_, i) => i !== idx) })}
                    className="text-osrs-parchment-dark/50 hover:text-osrs-red text-sm"
                    aria-label={`Remove ${it.name}`}
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function LootSweepEditor({
  value,
  onChange,
  searchItems,
  searchNpcs,
  uploadImage,
  disabled = false,
}: {
  value: LootSweepDraft;
  onChange: (next: LootSweepDraft) => void;
  searchItems: (q: string) => Promise<EventMetaEntry[]>;
  searchNpcs: (q: string) => Promise<EventMetaEntry[]>;
  uploadImage?: (form: FormData) => Promise<{ url: string }>;
  disabled?: boolean;
}) {
  const patch = (p: Partial<LootSweepDraft>) => onChange({ ...value, ...p });
  const setGroup = (i: number, g: LootSweepGroupDraft) =>
    patch({ groups: value.groups.map((x, idx) => (idx === i ? g : x)) });

  return (
    <div className="grid gap-4">
      {/* set-wide scoring */}
      <fieldset className="border-osrs-bronze/25 bg-osrs-brown-dark/20 grid gap-3 rounded-lg border p-3">
        <legend className="text-osrs-parchment-dark/70 px-1 text-xs font-medium">Set scoring</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">
            <span className="text-osrs-parchment-dark/80">Decay per tier</span>
            <div className="flex items-center gap-1">
              <QuantityInput
                min={0}
                max={100}
                value={value.decayPercent}
                onChange={(n) => patch({ decayPercent: n })}
                disabled={disabled}
                className={`${field} w-16`}
              />
              <span className="text-osrs-parchment-dark/50">%</span>
            </div>
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-osrs-parchment-dark/80">Decay curve</span>
            <select
              value={value.decayMode}
              onChange={(e) => patch({ decayMode: e.target.value as LootSweepDecayMode })}
              disabled={disabled}
              className={field}
            >
              <option value="linear">Linear (100 · 80 · 60 …)</option>
              <option value="geometric">Geometric (100 · 80 · 64 …)</option>
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">
            <span className="text-osrs-parchment-dark/80">Full-set bonus (all groups)</span>
            <QuantityInput
              min={0}
              emptyAs={0}
              value={value.setBonusPoints}
              onChange={(n) => patch({ setBonusPoints: n })}
              disabled={disabled}
              className={field}
              title="Points for completing every group. 0 = no whole-set bonus (fine for a single-boss set)."
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-osrs-parchment-dark/80">Full-set bonus max</span>
            <QuantityInput
              min={1}
              max={100}
              value={value.setBonusMax}
              onChange={(n) => patch({ setBonusMax: n })}
              disabled={disabled || value.setBonusPoints <= 0}
              className={field}
            />
          </label>
        </div>
      </fieldset>

      {value.groups.map((g, i) => (
        <GroupCard
          key={i}
          group={g}
          index={i}
          decayPercent={value.decayPercent}
          decayMode={value.decayMode}
          onChange={(ng) => setGroup(i, ng)}
          onRemove={() => patch({ groups: value.groups.filter((_, idx) => idx !== i) })}
          removable={value.groups.length > 1}
          searchItems={searchItems}
          searchNpcs={searchNpcs}
          uploadImage={uploadImage}
          disabled={disabled}
        />
      ))}

      {!disabled && (
        <button
          type="button"
          onClick={() => patch({ groups: [...value.groups, emptyGroup()] })}
          className="border-osrs-bronze/40 text-osrs-parchment-dark/80 hover:border-osrs-gold hover:text-osrs-gold-bright rounded border border-dashed px-3 py-2 text-sm"
        >
          + Add a group (sub-set)
        </button>
      )}
    </div>
  );
}
