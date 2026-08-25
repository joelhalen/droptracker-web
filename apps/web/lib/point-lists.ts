/**
 * Pure shaping for the points include/exclude lists (blacklist / whitelist /
 * no-split) — what the editor sends, and how stored rows read back.
 *
 * The rule that drives all of it: a stored row matches a submission only when
 * BOTH its item and its NPC match, and loot from a reward container is recorded
 * against the container rather than the boss that dropped it. A row saying
 * "Contract of shard acquisition" + "Yama" therefore matched nothing — contracts
 * arrive under "Dossier" — and the blacklisted item kept awarding points. So:
 *
 * - an entry restricted to N sources is N rows, not one row with N ids, and
 *   {@link groupEntries} collapses them back into one thing to look at;
 * - "all sources selected" sends no NPC at all rather than an enumeration of
 *   today's sources, so a source first seen tomorrow is still covered.
 */

import type { EventItemSourceNpc, PointListEntry } from "@droptracker/api-types";

/** The real recorded npc ids a source chip stands for. A merged display alias
 * ("Wintertodt") carries its reward containers in `member_ids`; an entry has to
 * store those, because the alias's own `npc_id` is only its icon representative
 * and may name an NPC no drop is ever recorded under. */
export const sourceNpcIds = (src: EventItemSourceNpc): number[] =>
  src.member_ids?.length ? src.member_ids : [src.npc_id];

export type PointListPayload = {
  list_type: string;
  item_id: number | null;
  npc_id: number | null;
  npc_ids?: number[];
};

/** The POST body for one added entry.
 *
 * `excluded` holds the npc_id of each DESELECTED source, so the default —
 * nothing deselected — produces an unrestricted entry. A restriction is only
 * expressed when the admin actually took a source away, and only when there was
 * a choice to make: a single-source item is unrestricted either way, and saying
 * so in one row keeps it matching if a second source ever appears.
 */
export function listEntryPayload({
  listType,
  item,
  npc,
  sources,
  excluded,
}: {
  listType: string;
  item: { id: number } | null;
  npc: { id: number } | null;
  sources: EventItemSourceNpc[] | null;
  excluded: number[];
}): PointListPayload {
  const body: PointListPayload = {
    list_type: listType,
    item_id: item?.id ?? null,
    // Item and NPC are alternatives in this editor; a standalone NPC only
    // travels when no item was picked, so the two can never be ANDed blindly.
    npc_id: item ? null : (npc?.id ?? null),
  };
  if (!item || !sources || sources.length < 2 || excluded.length === 0) return body;
  const kept = sources.filter((s) => !excluded.includes(s.npc_id));
  if (kept.length === 0 || kept.length === sources.length) return body;
  return { ...body, npc_ids: kept.flatMap(sourceNpcIds) };
}

/** A logical list entry and the rows behind it — more than one when an item was
 * restricted to several sources. */
export type ListGroup = {
  key: string;
  rows: PointListEntry[];
  itemId: number | null;
  itemName: string | null;
  npcId: number | null;
  npcName: string | null;
  /** The chosen sources; empty when the entry is unrestricted. */
  sources: { id: number; name: string | null }[];
};

/** Collapse source-restricted rows of the same item into one entry.
 *
 * An unrestricted row for that same item is deliberately NOT merged in: it
 * matches on its own regardless of the others, so folding it into their chip
 * list would misreport what the entry actually blocks. It stays a separate,
 * broader entry — which is also the honest way to show a group that has both.
 */
export function groupEntries(rows: PointListEntry[]): ListGroup[] {
  const out: ListGroup[] = [];
  const byItem = new Map<number, ListGroup>();
  for (const e of rows) {
    if (e.item_id != null && e.npc_id != null) {
      let group = byItem.get(e.item_id);
      if (!group) {
        group = {
          key: `item:${e.item_id}`,
          rows: [],
          itemId: e.item_id,
          itemName: e.item_name,
          npcId: null,
          npcName: null,
          sources: [],
        };
        byItem.set(e.item_id, group);
        out.push(group);
      }
      group.rows.push(e);
      group.sources.push({ id: e.npc_id, name: e.npc_name });
    } else {
      out.push({
        key: `row:${e.id}`,
        rows: [e],
        itemId: e.item_id,
        itemName: e.item_name,
        npcId: e.npc_id,
        npcName: e.npc_name,
        sources: [],
      });
    }
  }
  return out;
}
