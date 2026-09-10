/**
 * Chutes & ladders — the pure rules the board designer applies before it
 * autosaves, mirroring the backend validator (web_api/routes/event_board.py
 * `_validate_tile_links`) so a coordinator sees the problem next to the
 * tile instead of a failed save:
 *
 *  - a link points at a real tile that is not itself;
 *  - start and finish tiles carry no link;
 *  - links never chain (the landing tile of a link is never itself a link —
 *    a piece moves at most once per landing);
 *  - a ladder may not carry a team past a required tile (chutes may cross
 *    one going down — the team already cleared it);
 *  - only a ladder can wait for the tile's task ("complete"), and then the
 *    tile needs a task to complete.
 *
 * `suggestLinks` places a random set under the same rules for the
 * "Add ladders & chutes" tool.
 */

export type LinkKind = "ladder" | "chute";

export type LinkTile = {
  idx: number;
  tileKind: "start" | "normal" | "required" | "finish";
  jumpTo: number | null;
  jumpWhen?: "land" | "complete" | null;
  /** Whether landing here draws or pins a task (difficulty or pinned task). */
  hasTask: boolean;
};

export function linkKind(idx: number, target: number): LinkKind {
  return target > idx ? "ladder" : "chute";
}

/** Human-readable problems, in tile order. Empty = the layout will save. */
export function validateBoardLinks(tiles: LinkTile[]): string[] {
  const problems: string[] = [];
  const byIdx = new Map(tiles.map((t) => [t.idx, t]));
  const linked = new Set(tiles.filter((t) => t.jumpTo != null).map((t) => t.idx));
  const required = tiles.filter((t) => t.tileKind === "required").map((t) => t.idx);
  for (const t of tiles) {
    if (t.jumpTo == null) continue;
    const target = t.jumpTo;
    if (target === t.idx) {
      problems.push(`Tile ${t.idx} links to itself.`);
      continue;
    }
    if (t.tileKind === "start" || t.tileKind === "finish") {
      problems.push(`Tile ${t.idx} is the ${t.tileKind} tile — it can't carry a chute or ladder.`);
      continue;
    }
    if (!byIdx.has(target)) {
      problems.push(`Tile ${t.idx} links to tile ${target}, which doesn't exist.`);
      continue;
    }
    if (linked.has(target)) {
      problems.push(
        `Tile ${t.idx} links to tile ${target}, which is itself a chute or ladder — links can't chain.`,
      );
    }
    if (target > t.idx) {
      const crossed = required.filter((r) => r > t.idx && r < target).sort((a, b) => a - b);
      if (crossed.length > 0) {
        problems.push(
          `The ladder on tile ${t.idx} would carry teams past required tile ${crossed[0]} — end it at or before that tile.`,
        );
      }
    }
    if (t.jumpWhen === "complete") {
      if (target < t.idx) {
        problems.push(`Tile ${t.idx}: only a ladder can wait for the task to be completed.`);
      } else if (!t.hasTask) {
        problems.push(
          `Tile ${t.idx}: a ladder that climbs on completion needs a task — give the tile a difficulty or pin a task.`,
        );
      }
    }
  }
  return problems;
}

export type SuggestOptions = {
  ladders: number;
  chutes: number;
  /** Minimum tiles a link spans (default 8 — a ladder from 3 to 6 is a dud). */
  minSpan?: number;
  /** Injectable RNG (0 ≤ r < 1) so tests are exact. */
  random?: () => number;
};

/**
 * Pick random bases and targets for `ladders` ladders and `chutes` chutes that
 * satisfy every rule above alongside the links the board already has. Returns
 * base idx → target idx for the NEW links only; places as many as the board
 * allows when it runs out of room.
 */
export function suggestLinks(tiles: LinkTile[], opts: SuggestOptions): Map<number, number> {
  const random = opts.random ?? Math.random;
  const minSpan = Math.max(1, opts.minSpan ?? 8);
  const byIdx = new Map(tiles.map((t) => [t.idx, t]));
  const maxIdx = Math.max(...tiles.map((t) => t.idx));
  const required = new Set(tiles.filter((t) => t.tileKind === "required").map((t) => t.idx));
  // Tiles already spoken for: link sources and link targets (no chains).
  const sources = new Set(tiles.filter((t) => t.jumpTo != null).map((t) => t.idx));
  const targets = new Set(
    tiles.filter((t) => t.jumpTo != null).map((t) => t.jumpTo as number),
  );
  const placed = new Map<number, number>();

  const free = (idx: number) => {
    const t = byIdx.get(idx);
    return (
      !!t &&
      t.tileKind === "normal" &&
      !sources.has(idx) &&
      !targets.has(idx) &&
      !placed.has(idx) &&
      ![...placed.values()].includes(idx)
    );
  };
  const pick = (candidates: number[]): number | null =>
    candidates.length === 0 ? null : candidates[Math.floor(random() * candidates.length)]!;

  const place = (kind: LinkKind, count: number) => {
    let attempts = 0;
    let done = 0;
    while (done < count && attempts < count * 40) {
      attempts += 1;
      const bases = [...byIdx.keys()].filter((idx) => free(idx) && !required.has(idx));
      const base = pick(bases);
      if (base == null) return;
      let candidates: number[];
      if (kind === "ladder") {
        candidates = [...byIdx.keys()].filter(
          (idx) =>
            idx >= base + minSpan &&
            idx < maxIdx &&
            free(idx) &&
            ![...required].some((r) => r > base && r < idx),
        );
      } else {
        candidates = [...byIdx.keys()].filter((idx) => idx <= base - minSpan && idx > 0 && free(idx));
      }
      const target = pick(candidates);
      if (target == null) continue;
      placed.set(base, target);
      done += 1;
    }
  };

  place("ladder", Math.max(0, opts.ladders));
  place("chute", Math.max(0, opts.chutes));
  return placed;
}

/** After a tile is deleted, re-point every link across the re-indexed track
 * (targets above the removed idx shift down; links at the removed tile die). */
export function relinkAfterDelete<T extends { jumpTo: number | null }>(tiles: T[], removed: number): T[] {
  return tiles.map((t) => {
    if (t.jumpTo == null) return t;
    if (t.jumpTo === removed) return { ...t, jumpTo: null };
    if (t.jumpTo > removed) return { ...t, jumpTo: t.jumpTo - 1 };
    return t;
  });
}
