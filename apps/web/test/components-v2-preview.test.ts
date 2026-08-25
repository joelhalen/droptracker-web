import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EVENT_TOKEN_RE,
  NOTIFICATION_TOKEN_RE,
  isSendableUrl,
  renderNotificationPreview,
  resolveLines,
  sampleMap,
  type PreviewDraftBlock,
} from "@/lib/components-v2";
import {
  GroupNotificationLayoutsResponseSchema,
  NotificationLayoutInputSchema,
  NotificationLayoutMetaSchema,
} from "@droptracker/api-types";
import { mockGroupNotificationLayouts, mockNotificationLayoutMeta } from "@/lib/mock-data";

/**
 * The builder's preview is only worth having if it drops exactly what the
 * sender drops. These cases mirror disc tests/unit/test_component_layout.py —
 * when one side changes, the other should fail.
 */

function block(patch: Partial<PreviewDraftBlock>): PreviewDraftBlock {
  return {
    type: "text",
    content: "",
    thumbnail: "",
    divider: true,
    largeGap: false,
    urls: [],
    buttons: [],
    ...patch,
  };
}

const SAMPLES = sampleMap(
  [
    { token: "player_name", sample: "Ra ine", optional: false },
    { token: "npc_name", sample: "Vorkath", optional: false },
    { token: "personal_best", sample: "1:52.20", optional: false },
    { token: "image_url", sample: "https://example/kill.png", optional: true },
    { token: "gear_image_url", sample: "https://example/character.png", optional: true },
  ],
  false,
);

const SPARSE = sampleMap(
  [
    { token: "player_name", sample: "Ra ine", optional: false },
    { token: "npc_name", sample: "Vorkath", optional: false },
    { token: "personal_best", sample: "1:52.20", optional: false },
    { token: "image_url", sample: "https://example/kill.png", optional: true },
    { token: "gear_image_url", sample: "https://example/character.png", optional: true },
  ],
  true,
);

test("only the line holding an unresolved token is dropped", () => {
  const lines = resolveLines(
    "**Time** {personal_best}\nPrevious best: {previous_best}",
    SAMPLES,
    true,
    NOTIFICATION_TOKEN_RE,
  );
  assert.deepEqual(lines, ["**Time** 1:52.20"]);
});

test("a line whose only value is blank is dropped, label and all", () => {
  // Mirrors _line_values_are_all_blank: "**Location** {location}" with no
  // location must vanish rather than render a heading with nothing under it,
  // which is what an embed does with a field whose value resolves empty.
  const samples = new Map(SAMPLES);
  samples.set("{gear_image_url}", "");
  const lines = resolveLines(
    "**Time** {personal_best}\n**Character** {gear_image_url}",
    samples,
    true,
    NOTIFICATION_TOKEN_RE,
  );
  assert.deepEqual(lines, ["**Time** 1:52.20"]);
});

test("a line keeps its label while any one of its values resolves", () => {
  const samples = new Map(SAMPLES);
  samples.set("{gear_image_url}", "");
  const lines = resolveLines(
    "**Time** {personal_best} — {gear_image_url}",
    samples,
    true,
    NOTIFICATION_TOKEN_RE,
  );
  assert.deepEqual(lines, ["**Time** 1:52.20 — "]);
});

test("raw mode substitutes and drops nothing", () => {
  const lines = resolveLines("hi {player_name}\n{missing}", SAMPLES, false, NOTIFICATION_TOKEN_RE);
  assert.deepEqual(lines, ["hi {player_name}", "{missing}"]);
});

test("the event token pattern is the one the event renderer uses", () => {
  // The two backends differ: the notification renderer allows digits. Each
  // editor has to drop what its own sender drops, no more and no less.
  assert.equal(EVENT_TOKEN_RE.test("{team_2}"), false);
  assert.equal(NOTIFICATION_TOKEN_RE.test("{team_2}"), true);
});

test("a url still holding a token is not sendable", () => {
  assert.equal(isSendableUrl("https://example/kill.png"), true);
  assert.equal(isSendableUrl("attachment://shot.png"), true);
  assert.equal(isSendableUrl("{image_url}"), false);
  assert.equal(isSendableUrl("https://example/{item_id}.png"), false);
  assert.equal(isSendableUrl(""), false);
  assert.equal(isSendableUrl("example.com/kill.png"), false);
});

test("a section keeps its text when the thumbnail does not resolve", () => {
  const blocks = renderNotificationPreview(
    [block({ type: "section", content: "### {npc_name}", thumbnail: "{gear_image_url}" })],
    SPARSE,
    true,
  );
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.kind, "section");
  assert.equal(blocks[0]?.kind === "section" && blocks[0].thumbnail, null);
});

test("a media block with no usable image is left out entirely", () => {
  const blocks = renderNotificationPreview(
    [
      block({ type: "text", content: "**{player_name}** did a thing" }),
      block({ type: "media", urls: ["{image_url}"] }),
    ],
    SPARSE,
    true,
  );
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["text"],
  );
});

test("a media block keeps only the images that resolved", () => {
  const blocks = renderNotificationPreview(
    [block({ type: "media", urls: ["{image_url}", "{gear_image_url}", "{video_url}"] })],
    SAMPLES,
    true,
  );
  assert.equal(blocks[0]?.kind, "media");
  assert.deepEqual(blocks[0]?.kind === "media" && blocks[0].urls, [
    "https://example/kill.png",
    "https://example/character.png",
  ]);
});

test("a button whose link did not resolve is dropped with its row", () => {
  const blocks = renderNotificationPreview(
    [
      block({ type: "text", content: "hi {player_name}" }),
      block({ type: "buttons", buttons: [{ label: "Watch", url: "{video_url}" }] }),
    ],
    SAMPLES,
    true,
  );
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["text"],
  );
});

test("leading and trailing separators are trimmed", () => {
  const blocks = renderNotificationPreview(
    [
      block({ type: "separator" }),
      block({ type: "text", content: "body" }),
      block({ type: "separator" }),
    ],
    SAMPLES,
    true,
  );
  assert.deepEqual(
    blocks.map((b) => b.kind),
    ["text"],
  );
});

test("a layout that resolves to nothing renders nothing (the embed is sent)", () => {
  const blocks = renderNotificationPreview(
    [
      block({ type: "separator" }),
      block({ type: "media", urls: ["{image_url}"] }),
      block({ type: "text", content: "{gear_image_url}" }),
    ],
    SPARSE,
    true,
  );
  assert.deepEqual(blocks, []);
});

test("sparse mode blanks only the optional tokens", () => {
  assert.equal(SPARSE.get("{image_url}"), "");
  assert.equal(SPARSE.get("{player_name}"), "Ra ine");
});

test("the mocks satisfy the schemas the BFF parses with", () => {
  GroupNotificationLayoutsResponseSchema.parse(mockGroupNotificationLayouts());
  NotificationLayoutMetaSchema.parse(mockNotificationLayoutMeta());
});

test("a saved layout round-trips through the PUT schema", () => {
  const saved = mockGroupNotificationLayouts().layouts.find((l) => l.custom);
  assert.ok(saved?.custom);
  NotificationLayoutInputSchema.parse({ ...saved.custom, active: true });
});
