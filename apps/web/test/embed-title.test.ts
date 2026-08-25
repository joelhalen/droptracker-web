import assert from "node:assert/strict";
import { test } from "node:test";
import { flattenTitleMarkdown, sampleIconFor, tidyTitle } from "../lib/embeds";

// Parity suite for the backend's `strip_title_markdown` (disc repo
// `utils/format.py`, covered by tests/unit/test_format.py). The two must agree:
// the backend decides what Discord receives, this decides what the editor
// preview promises. Same cases, same expectations.

test("flattenTitleMarkdown unwraps masked links", () => {
  assert.equal(
    flattenTitleMarkdown("[Beast Owned](https://www.droptracker.io/players/1)"),
    "Beast Owned",
  );
  // {player_name} resolves to exactly this shape server-side — the reported bug.
  assert.equal(
    flattenTitleMarkdown("[Ron](https://www.droptracker.io/players/1) Planked!"),
    "Ron Planked!",
  );
});

test("flattenTitleMarkdown strips paired emphasis markers", () => {
  assert.equal(
    flattenTitleMarkdown("**Levels achieved:** {skills_text}"),
    "Levels achieved: {skills_text}",
  );
  assert.equal(flattenTitleMarkdown("New `Zulrah` Personal Best"), "New Zulrah Personal Best");
  assert.equal(flattenTitleMarkdown("*a* ~~b~~ ___c___"), "a b c");
});

test("flattenTitleMarkdown leaves a lone underscore in a name alone", () => {
  // OSRS display names carry underscores (the plugin submits `Beast_Owned`).
  assert.equal(flattenTitleMarkdown("Beast_Owned Planked!"), "Beast_Owned Planked!");
});

test("flattenTitleMarkdown leaves plain text untouched", () => {
  assert.equal(flattenTitleMarkdown(":tada: Zulrah :tada:"), ":tada: Zulrah :tada:");
  assert.equal(flattenTitleMarkdown(""), "");
});

// ── tidyTitle ────────────────────────────────────────────────────────────────
// Parity with the backend's `tidy_title` (disc `utils/format.py`, covered by
// tests/unit/test_format.py::TestTidyTitle). The shipped default drop title is
// `{item_emoji} {item_name}`, and only ~1000 of 29k items have an emoji — so
// the empty case is the common one and its leading space must not survive.

test("tidyTitle trims the space an empty placeholder leaves behind", () => {
  assert.equal(tidyTitle(" Bronze dagger"), "Bronze dagger");
  assert.equal(tidyTitle("Bronze dagger "), "Bronze dagger");
  assert.equal(tidyTitle("A  B"), "A B");
});

test("tidyTitle leaves an ordinary title untouched", () => {
  assert.equal(tidyTitle("Abyssal whip"), "Abyssal whip");
  assert.equal(tidyTitle(":tada: Theatre of Blood :tada:"), ":tada: Theatre of Blood :tada:");
  assert.equal(tidyTitle(""), "");
});

test("the title pipeline renders the emoji token as a token, not as markdown", () => {
  // PreviewTitle flattens then tidies before splitting on {tokens}; neither
  // step may damage the token the editor is about to draw an icon for.
  const out = tidyTitle(flattenTitleMarkdown("{item_emoji} {item_name}"));
  assert.equal(out, "{item_emoji} {item_name}");
});

// ── sample icons ─────────────────────────────────────────────────────────────

test("the emoji token has a preview icon and ordinary tokens do not", () => {
  // A string sample cannot express a Discord custom emoji: the message carries
  // `<:item_twisted_bow:1541…>`, which only Discord turns into a picture.
  assert.ok(sampleIconFor("{item_emoji}")?.startsWith("https://"));
  assert.equal(sampleIconFor("{item_name}"), undefined);
  assert.equal(sampleIconFor("{npc_name}"), undefined);
});
