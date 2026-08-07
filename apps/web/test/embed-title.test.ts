import assert from "node:assert/strict";
import { test } from "node:test";
import { flattenTitleMarkdown } from "../lib/embeds";

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
