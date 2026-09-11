/**
 * Account-progress empty states must name "Use API".
 *
 * Why this exists: every one of these empty states used to name only the
 * panel's own plugin setting ("Sync account progress", "Send character model &
 * gear"). Those are on by default. The setting that was actually off, "Use API",
 * was never mentioned, so the third of active players without it were told to
 * switch on something they already had.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SyncSettings } from "../components/sync-settings";
import { PLUGIN_SETTINGS } from "../lib/plugin-features";

const ROOT = join(import.meta.dirname, "..");

// tsx compiles the repo's JSX with the classic runtime.
(globalThis as { React?: typeof React }).React = React;

test("the settings list leads with Use API, then the panel's own setting", () => {
  const html = renderToStaticMarkup(
    React.createElement(SyncSettings, { setting: PLUGIN_SETTINGS.syncProgress }),
  );

  const useApi = html.indexOf(PLUGIN_SETTINGS.useApi);
  const own = html.indexOf(PLUGIN_SETTINGS.syncProgress);
  assert.ok(useApi >= 0, "names Use API");
  assert.ok(own >= 0, "names the panel's own setting");
  assert.ok(useApi < own, "Use API is the one to act on, so it comes first");
  assert.match(html, /off by default/);
  assert.match(html, /Advanced/);
});

/** Every .tsx under a directory, recursively. */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

const count = (source: string, needle: string) => source.split(needle).length - 1;

test("every account-progress empty state renders the settings list", () => {
  const files = [...tsxFiles(join(ROOT, "app")), ...tsxFiles(join(ROOT, "components"))];
  const callers = files.filter((file) => readFileSync(file, "utf8").includes("stateSyncEmpty("));

  // The guard is only worth having if it is looking at something.
  assert.ok(callers.length >= 3, `expected the known callers, found ${callers.length}`);

  const missing = callers.filter((file) => {
    const source = readFileSync(file, "utf8");
    return count(source, "<SyncSettings") < count(source, "stateSyncEmpty(");
  });
  assert.deepEqual(
    missing.map((file) => file.slice(ROOT.length + 1)),
    [],
    "Pass action={<SyncSettings setting={…} />} to each stateSyncEmpty() empty state, " +
      "so it names Use API as well as the panel's own setting.",
  );
});
