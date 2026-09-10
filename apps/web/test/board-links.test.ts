import assert from "node:assert/strict";
import { test } from "node:test";
import { linkKind, relinkAfterDelete, suggestLinks, validateBoardLinks } from "../lib/board-links";
import type { LinkTile } from "../lib/board-links";

function track(n = 20, overrides: Record<number, Partial<LinkTile>> = {}): LinkTile[] {
  return Array.from({ length: n }, (_, i) => ({
    idx: i,
    tileKind: i === 0 ? "start" : i === n - 1 ? "finish" : "normal",
    jumpTo: null,
    jumpWhen: "land",
    hasTask: true,
    ...overrides[i],
  }));
}

test("linkKind: higher target is a ladder, lower is a chute", () => {
  assert.equal(linkKind(3, 9), "ladder");
  assert.equal(linkKind(9, 3), "chute");
});

test("a plain ladder and chute validate", () => {
  assert.deepEqual(validateBoardLinks(track(20, { 3: { jumpTo: 12 }, 15: { jumpTo: 4 } })), []);
});

test("self links, start/finish links and missing targets are problems", () => {
  assert.match(validateBoardLinks(track(20, { 3: { jumpTo: 3 } }))[0]!, /itself/);
  assert.match(validateBoardLinks(track(20, { 0: { jumpTo: 5 } }))[0]!, /start tile/);
  assert.match(validateBoardLinks(track(20, { 19: { jumpTo: 5 } }))[0]!, /finish tile/);
  assert.match(validateBoardLinks(track(20, { 3: { jumpTo: 99 } }))[0]!, /doesn't exist/);
});

test("links never chain", () => {
  const problems = validateBoardLinks(track(20, { 3: { jumpTo: 8 }, 8: { jumpTo: 15 } }));
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /can't chain/);
});

test("a ladder may not cross a required tile; a chute may", () => {
  const ladder = validateBoardLinks(
    track(20, { 3: { jumpTo: 12 }, 7: { tileKind: "required" } }),
  );
  assert.match(ladder[0]!, /past required tile 7/);
  assert.deepEqual(
    validateBoardLinks(track(20, { 12: { jumpTo: 3 }, 7: { tileKind: "required" } })),
    [],
  );
  // Ending ON the required tile is fine — the team still has to do it.
  assert.deepEqual(
    validateBoardLinks(track(20, { 3: { jumpTo: 7 }, 7: { tileKind: "required" } })),
    [],
  );
});

test("complete-trigger only on ladders that have a task", () => {
  assert.match(
    validateBoardLinks(track(20, { 12: { jumpTo: 3, jumpWhen: "complete" } }))[0]!,
    /only a ladder/,
  );
  assert.match(
    validateBoardLinks(track(20, { 3: { jumpTo: 12, jumpWhen: "complete", hasTask: false } }))[0]!,
    /needs a task/,
  );
  assert.deepEqual(validateBoardLinks(track(20, { 3: { jumpTo: 12, jumpWhen: "complete" } })), []);
});

test("suggestLinks places valid links under the rules", () => {
  let seed = 7;
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const tiles = track(100, { 50: { tileKind: "required" }, 10: { jumpTo: 30 } });
  const placed = suggestLinks(tiles, { ladders: 5, chutes: 5, minSpan: 8, random });
  assert.equal(placed.size, 10);
  const merged = tiles.map((t) => (placed.has(t.idx) ? { ...t, jumpTo: placed.get(t.idx)! } : t));
  assert.deepEqual(validateBoardLinks(merged), []);
  let ladders = 0;
  for (const [base, target] of placed) {
    assert.ok(Math.abs(target - base) >= 8, `span ${base}->${target}`);
    assert.notEqual(base, 10); // the existing link's base is left alone
    assert.notEqual(target, 30); // ...and its target is never re-used
    if (target > base) ladders += 1;
  }
  assert.equal(ladders, 5);
});

test("suggestLinks runs out gracefully on a tiny board", () => {
  const placed = suggestLinks(track(5), { ladders: 3, chutes: 3, minSpan: 8, random: () => 0.5 });
  assert.equal(placed.size, 0);
});

test("relinkAfterDelete shifts targets and drops dead links", () => {
  const tiles = [
    { jumpTo: 7 },
    { jumpTo: 5 },
    { jumpTo: null },
    { jumpTo: 2 },
  ];
  assert.deepEqual(relinkAfterDelete(tiles, 5), [
    { jumpTo: 6 },
    { jumpTo: null },
    { jumpTo: null },
    { jumpTo: 2 },
  ]);
});
