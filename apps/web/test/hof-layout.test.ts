import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GroupHofLayoutResponseSchema,
  HofLayoutInputSchema,
  HofLayoutMetaSchema,
  HofLayoutPreviewSchema,
} from "@droptracker/api-types";
import { mockGroupHofLayout, mockHofLayoutMeta } from "@/lib/mock-data";

/**
 * Contract for the Hall of Fame layout editor (backend web_api/routes/
 * hof_layouts.py). The block shapes mirror services/hof_layout.py, whose own
 * tests pin the renderer.
 */

test("mocks satisfy the Hall of Fame layout schemas", () => {
  assert.doesNotThrow(() => HofLayoutMetaSchema.parse(mockHofLayoutMeta()));
  assert.doesNotThrow(() => GroupHofLayoutResponseSchema.parse(mockGroupHofLayout()));
});

test("leaderboard blocks accept a null count (the group's PB setting)", () => {
  const parsed = HofLayoutInputSchema.parse({
    blocks: [
      { type: "leaderboard", board: "pb", count: null, each_mode: true },
      { type: "leaderboard", board: "loot_month", count: 3, line: "{medal} {player} {value}" },
    ],
    active: true,
  });
  assert.equal(parsed.blocks.length, 2);
});

test("leaderboard counts outside 1-10 and unknown boards are refused", () => {
  assert.throws(() =>
    HofLayoutInputSchema.parse({ blocks: [{ type: "leaderboard", board: "kc", count: 11 }] }),
  );
  assert.throws(() => HofLayoutInputSchema.parse({ blocks: [{ type: "leaderboard", board: "xp" }] }));
});

test("preview responses parse both the error and the rendered shape", () => {
  const errors = HofLayoutPreviewSchema.parse({ ok: false, errors: ["Block 1 needs some text."] });
  assert.equal(errors.ok, false);
  const rendered = HofLayoutPreviewSchema.parse({
    ok: true,
    boss: "Zulrah",
    bosses: ["Zulrah"],
    used_default: false,
    payload: {
      flags: 32768,
      components: [
        {
          type: 17,
          accent_color: 13150830,
          components: [
            {
              type: 9,
              components: [{ type: 10, content: "## Zulrah" }],
              accessory: { type: 11, media: { url: "https://www.droptracker.io/img/npcdb/2042.png" } },
            },
            { type: 14, divider: true, spacing: 1 },
            { type: 10, content: "-# 🥇 `0:36.0` - [Ron](https://www.droptracker.io/players/1)" },
          ],
        },
      ],
    },
  });
  assert.equal(rendered.ok, true);
});
