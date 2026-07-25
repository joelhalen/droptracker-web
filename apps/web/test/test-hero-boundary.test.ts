/**
 * Guards the server/client boundary for the /test-hero route, and the feed
 * shaping that crosses it.
 *
 * Why this exists: a pure helper was twice defined inside a `"use client"`
 * module and called from the server page. That throws
 *
 *   Attempted to call toNotableDrop() from the server but toNotableDrop is on
 *   the client.
 *
 * only when the input array is NON-EMPTY — and the mock feed is empty, so the
 * page rendered perfectly in every local check and failed in production. A
 * static check is the only thing that reliably catches it.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { NOTABLE_GP, toNotableDrop, toRow } from "../app/(site)/test-hero/feed-rows";

const DIR = join(import.meta.dirname, "..", "app", "(site)", "test-hero");

/** Modules that opt into the client bundle. */
function clientModules(): Set<string> {
  return new Set(
    readdirSync(DIR)
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) => /^\s*["']use client["']/.test(readFileSync(join(DIR, f), "utf8"))),
  );
}

/** `import { a, type B } from "./x"` → the non-type bindings only. */
function valueImportsFrom(source: string, spec: string): string[] {
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${spec}["']`, "g");
  const names: string[] = [];
  for (const match of source.matchAll(re)) {
    for (const raw of match[1]!.split(",")) {
      const name = raw.trim();
      if (name && !name.startsWith("type ")) names.push(name.split(/\s+as\s+/)[0]!.trim());
    }
  }
  return names;
}

test("server modules never import callable helpers from a 'use client' module", () => {
  const clients = clientModules();
  // Anything without the directive can end up executing on the server.
  const servers = readdirSync(DIR)
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => !clients.has(f));

  const violations: string[] = [];
  for (const file of servers) {
    const source = readFileSync(join(DIR, file), "utf8");
    for (const client of clients) {
      const spec = `./${client.replace(/\.tsx?$/, "")}`;
      for (const name of valueImportsFrom(source, spec)) {
        // A PascalCase export is a component: rendering one from a server
        // component is the normal pattern and is fine. Anything else is a
        // function or constant, and every export of a "use client" module is a
        // client-reference proxy on the server — calling it throws, and reading
        // it gives a proxy rather than the value.
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
          violations.push(`${file} imports \`${name}\` from client module ${client}`);
        }
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Server→client boundary violation. Move the helper into a module without ` +
      `"use client" (feed-rows.ts is the shared home):\n  ${violations.join("\n  ")}`,
  );
});

test("clientModules/valueImportsFrom actually detect what they claim", () => {
  // The guard above is only worth having if it can fail — pin its parsing.
  assert.ok(clientModules().has("hero.tsx"), "hero.tsx is a client module");
  assert.ok(!clientModules().has("feed-rows.ts"), "feed-rows.ts must stay server-safe");

  const sample = `import { LatestDrop, type NotableDrop } from "./latest-drop";`;
  assert.deepEqual(valueImportsFrom(sample, "./latest-drop"), ["LatestDrop"]);
  assert.deepEqual(valueImportsFrom(`import { type A } from "./latest-drop";`, "./latest-drop"), []);
});

test("toNotableDrop shapes a real feed envelope and honours the bar", () => {
  const envelope = {
    icon_url: "https://www.droptracker.io/img/itemdb/28281.png",
    item_id: 28281,
    item_name: "Magus vestige",
    npc_name: "Duke Sucellus",
    player_name: "God and Dog",
    ts: 1784981884,
    value: 25_044_018,
  };

  const drop = toNotableDrop("drop", envelope, 0);
  assert.deepEqual(drop, {
    itemId: 28281,
    itemName: "Magus vestige",
    npcName: "Duke Sucellus",
    playerName: "God and Dog",
    value: 25_044_018,
    ts: 1784981884,
  });

  assert.equal(toNotableDrop("pet", envelope, 0), null, "only drops are notable");
  assert.equal(
    toNotableDrop("drop", { ...envelope, value: NOTABLE_GP - 1 }, 0),
    null,
    "below the bar is not notable",
  );
  assert.equal(
    toNotableDrop("drop", { ...envelope, item_id: 0 }, 0),
    null,
    "an unresolvable item is not renderable",
  );
});

test("toRow shapes the feed types the live panel renders", () => {
  const drop = toRow(
    "drop",
    { player_name: "Zezima", item_name: "Twisted bow", npc_name: "Chambers of Xeric", value: 1e9 },
    "k",
    false,
  );
  assert.equal(drop?.who, "Zezima");
  assert.equal(drop?.value, 1e9);

  const pb = toRow(
    "personal_best",
    { player_name: "Woox", npc_name: "Zulrah", time_display: "0:58.2", team_size: "Solo" },
    "k",
    true,
  );
  assert.equal(pb?.what, "0:58.2");
  assert.equal(pb?.detail, "Zulrah · Solo");

  assert.equal(toRow("unknown_type", {}, "k", false), null);
});
