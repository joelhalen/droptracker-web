"use client";

/**
 * Team-agnostic hover cards for the Loot Sweep board's left rail — the "what
 * is this?" companions to the per-team receipt card:
 *
 *  - `IconCluster` — the rail's icon(s) for an entry: a single item icon, or a
 *    tidy row of the real pieces a pooled / "Any …" entry stands for.
 *  - `ItemInfoCard` — hover an item's name to see its pieces, decay schedule
 *    (hover a chip for that receipt's exact points), and completion rule.
 *  - `SectionInfoCard` — hover a boss/group to see every item it holds with
 *    each one's point value, plus what clearing the whole section is worth.
 */
import type { LootSweepConfigItem, LootSweepSet } from "@droptracker/api-types";
import { ItemDbIcon } from "@/components/item-db-icon";
import { CARD_SECTION_CLASS } from "@/components/hover-card";
import { decaySequence } from "@/lib/loot-sweep";
import {
  fmtPoints,
  groupClearPoints,
  iconIdsOf,
  maxAwardsOf,
  sectionClearPoints,
  sectionMaxPoints,
} from "@/lib/loot-sweep-matrix";

const fmt = fmtPoints;

/** Rail icon(s) for an entry. One id → a plain icon; several → a wrapped
 * cluster of the pieces (pooled / virtual entries). */
export function IconCluster({
  ids,
  size = 22,
  max = 4,
  title,
}: {
  ids: number[];
  size?: number;
  /** Cap the icons shown; the rest collapse into a "+N". */
  max?: number;
  title?: string;
}) {
  if (ids.length === 0) {
    return <span style={{ width: size, height: size }} className="inline-block shrink-0" />;
  }
  if (ids.length === 1) {
    return <ItemDbIcon itemId={ids[0]} size={size} className={title ? "" : ""} />;
  }
  const shown = ids.slice(0, max);
  const extra = ids.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-[2px]" title={title}>
      {shown.map((id, i) => (
        <ItemDbIcon key={i} itemId={id} size={size} />
      ))}
      {extra > 0 && (
        <span className="text-osrs-parchment-dark/50 text-[10px] font-medium">+{extra}</span>
      )}
    </span>
  );
}

/** Decay-schedule chips; each chip's title is that receipt's exact points, so
 * you can hover "the 5th one" to see what it awards. */
function ScheduleChips({ item, set }: { item: LootSweepConfigItem; set: Pick<LootSweepSet, "decay_percent" | "decay_mode"> }) {
  const max = maxAwardsOf(item);
  const apt = item.awards_per_tier ?? 1;
  const seq = decaySequence(item.points, max, set.decay_percent, apt, set.decay_mode);
  const SHOWN = 12;
  return (
    <div className="flex flex-wrap items-center gap-1" aria-label="points per receipt">
      {seq.slice(0, SHOWN).map((pts, i) => (
        <span
          key={i}
          className="bg-osrs-surface-2 text-osrs-parchment-dark/80 rounded px-1.5 py-0.5 text-[11px] font-medium leading-none tabular-nums"
          title={`Receipt ${i + 1} → ${fmt(pts)} pts`}
        >
          {fmt(pts)}
        </span>
      ))}
      {seq.length > SHOWN && (
        <span className="text-osrs-parchment-dark/45 text-[10px]">+{seq.length - SHOWN} more</span>
      )}
      {apt > 1 && <span className="text-osrs-parchment-dark/50 text-[10px]">×{apt} per step</span>}
    </div>
  );
}

/** Hover-card body for one item's name in the rail (team-agnostic). */
export function ItemInfoCard({
  item,
  set,
}: {
  item: LootSweepConfigItem;
  set: Pick<LootSweepSet, "label" | "decay_percent" | "decay_mode">;
}) {
  const ids = iconIdsOf(item);
  const max = maxAwardsOf(item);
  const isPet = item.source === "pet";
  const bonus = item.counts_for_group === false;
  const required = item.required ?? 1;
  const pieces = item.match_names ?? [];
  return (
    <div className="p-3 text-sm">
      <div className="flex items-center gap-2.5">
        <IconCluster ids={ids} size={30} max={6} />
        <div className="min-w-0 flex-1">
          <p className="text-osrs-parchment truncate font-semibold leading-tight">
            {item.item_name}
            {(isPet || bonus) && (
              <span className="text-osrs-gold/70 ring-osrs-gold/30 ml-1.5 rounded px-1 align-middle text-[9px] font-medium uppercase tracking-wider ring-1">
                {isPet ? "pet" : "bonus"}
              </span>
            )}
          </p>
          <p className="text-osrs-parchment-dark/60 truncate text-xs">
            worth {fmt(item.points)} first, up to {max}
          </p>
        </div>
      </div>

      {pieces.length > 0 && (
        <p className="text-osrs-parchment-dark/70 mt-2 text-xs leading-relaxed">
          {item.virtual ? "Any of these count" : "Also counts"}: {pieces.join(", ")}
          {required > 1 && (
            <>
              {" "}
              — need <span className="text-osrs-gold-bright font-medium">{required}</span> to clear
              this slot.
            </>
          )}
        </p>
      )}
      {pieces.length === 0 && required > 1 && (
        <p className="text-osrs-parchment-dark/70 mt-2 text-xs">
          Need <span className="text-osrs-gold-bright font-medium">{required}</span> to clear this
          slot.
        </p>
      )}

      <div className="mt-2.5">
        <p className="text-osrs-parchment-dark/50 mb-1.5 text-[10px] font-medium uppercase tracking-wider">
          Points per receipt
        </p>
        <ScheduleChips item={item} set={set} />
      </div>
    </div>
  );
}

/** Hover-card body for a boss / group header — every item + its point value,
 * and what clearing the section is worth. */
export function SectionInfoCard({
  set,
  groupIdx,
}: {
  set: LootSweepSet;
  /** When set, describe only this sub-group (meta-set row); else the whole set. */
  groupIdx?: number;
}) {
  const groups = groupIdx != null ? [set.groups[groupIdx]!] : set.groups;
  const title = groupIdx != null ? set.groups[groupIdx]!.label || set.label : set.label;
  const clear =
    groupIdx != null
      ? groupClearPoints(set.groups[groupIdx]!, set.decay_percent, set.decay_mode)
      : sectionClearPoints(set);
  const max = sectionMaxPoints(set);

  // Split the items so it's obvious which ones you actually need for a clear:
  // gating items (1 of each = a clear) vs BONUS/PET items that score on their
  // own but are never part of the set requirement.
  const all = groups.flatMap((g, gi) =>
    g.items.map((it, ii) => ({ it, key: `${gi}-${ii}` })),
  );
  const required = all.filter(({ it }) => it.counts_for_group !== false);
  const bonus = all.filter(({ it }) => it.counts_for_group === false);

  const renderItem = ({ it, key }: (typeof all)[number]) => {
    const isBonus = it.counts_for_group === false;
    return (
      <li key={key} className="flex items-center gap-2 text-xs">
        <IconCluster ids={iconIdsOf(it)} size={18} max={3} />
        <span className="text-osrs-parchment min-w-0 flex-1 truncate">
          {it.item_name}
          {(it.required ?? 1) > 1 && (
            <span className="text-osrs-parchment-dark/50"> ×{it.required}</span>
          )}
          {isBonus && (
            <span className="text-osrs-gold/60 ml-1 text-[9px] uppercase">
              {it.source === "pet" ? "pet" : "bonus"}
            </span>
          )}
        </span>
        <span className="text-osrs-gold-bright shrink-0 tabular-nums">{fmt(it.points)}</span>
      </li>
    );
  };

  const caption = "text-osrs-parchment-dark/50 text-[10px] font-medium uppercase tracking-wider";
  return (
    <div className="p-3 text-sm">
      <p className="text-osrs-gold truncate font-semibold">{title}</p>
      <p className="text-osrs-parchment-dark/60 mt-0.5 text-xs">
        Clear it for <span className="text-osrs-gold-bright font-medium">{fmt(clear)} pts</span>
        <span className="text-osrs-parchment-dark/50">
          {" "}
          — clear it again for less each time (decays {set.decay_percent}%)
          {groupIdx == null && <>, up to {fmt(max)} total</>}
        </span>
      </p>
      <div className={CARD_SECTION_CLASS}>
        {bonus.length === 0 ? (
          <ul className="space-y-1.5">{all.map(renderItem)}</ul>
        ) : (
          <>
            <p className={`${caption} mb-1.5`}>Need to clear · 1 of each</p>
            <ul className="space-y-1.5">{required.map(renderItem)}</ul>
            <p className={`${caption} mb-1.5 mt-3`}>Bonus · extra points, not required</p>
            <ul className="space-y-1.5">{bonus.map(renderItem)}</ul>
          </>
        )}
      </div>
    </div>
  );
}
