import assert from "node:assert/strict";
import { test } from "node:test";
import { PageBlockSchema, PageLayoutSchema } from "@droptracker/api-types";
import {
  BLOCK_DEFS,
  GROUP_TEMPLATES,
  PLAYER_TEMPLATES,
  defaultGroupLayout,
  defaultPlayerLayout,
  defsForScope,
  makeBlock,
} from "../lib/page-layout/catalog";

function assertLayout(name: string, layout: unknown, kind: "group" | "player") {
  const parsed = PageLayoutSchema.parse(layout);
  const ids = new Set<string>();
  for (const raw of parsed.blocks) {
    const block = PageBlockSchema.safeParse(raw);
    assert.ok(block.success, `${name}: block ${JSON.stringify(raw)} does not parse`);
    const def = BLOCK_DEFS.find((d) => d.type === block.data.type);
    assert.ok(def, `${name}: ${block.data.type} has no library entry`);
    assert.ok(def.scope === "both" || def.scope === kind, `${name}: ${def.type} is not a ${kind} block`);
    assert.ok(!ids.has(block.data.id), `${name}: duplicate id ${block.data.id}`);
    ids.add(block.data.id);
  }
}

test("the standard layouts are valid and stable", () => {
  assertLayout("group standard", defaultGroupLayout(), "group");
  assertLayout("player standard", defaultPlayerLayout(), "player");
  // Fixed ids, so two renders of the standard page key the same.
  assert.deepEqual(
    defaultGroupLayout().blocks.map((b) => b.id),
    defaultGroupLayout().blocks.map((b) => b.id),
  );
});

test("every template builds a valid layout", () => {
  for (const t of GROUP_TEMPLATES) assertLayout(`group template ${t.key}`, t.build(), "group");
  for (const t of PLAYER_TEMPLATES) assertLayout(`player template ${t.key}`, t.build(), "player");
});

test("every library block starts out valid", () => {
  for (const def of BLOCK_DEFS) {
    const parsed = PageBlockSchema.safeParse(makeBlock(def.type));
    assert.ok(parsed.success, `${def.type} fresh from the library does not parse`);
    assert.equal(parsed.data.surface, def.surface);
  }
});

test("scopes keep their own blocks", () => {
  const group = new Set(defsForScope("group").map((d) => d.type));
  const member = new Set(defsForScope("member_default").map((d) => d.type));
  const player = new Set(defsForScope("player").map((d) => d.type));
  assert.ok(group.has("support_card") && !player.has("support_card"));
  assert.ok(player.has("player_showcase") && !group.has("player_showcase"));
  assert.deepEqual([...member].sort(), [...player].sort());
  for (const shared of ["markdown", "image", "buttons", "divider"] as const) {
    assert.ok(group.has(shared) && player.has(shared));
  }
});

test("new block ids are unique and backend-safe", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const id = makeBlock("divider").id as string;
    assert.match(id, /^[A-Za-z0-9_-]{1,32}$/);
    assert.ok(!seen.has(id));
    seen.add(id);
  }
});

test("unknown or broken blocks are skipped, not fatal", () => {
  assert.equal(PageBlockSchema.safeParse({ id: "x", type: "from_the_future" }).success, false);
  const lenient = PageBlockSchema.safeParse({ id: "x", type: "records", limit: "lots", width: "huge" });
  assert.ok(lenient.success);
  assert.equal(lenient.data.width, "full");
});
