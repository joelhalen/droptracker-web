/**
 * Guards the server/client boundary for the homepage route group.
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
 *
 * The shaping itself is covered in ./home-data.test.ts.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const DIR = join(import.meta.dirname, "..", "app", "(site)", "(home)");

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
      `"use client" (home-data.ts is the shared home):\n  ${violations.join("\n  ")}`,
  );
});

test("clientModules/valueImportsFrom actually detect what they claim", () => {
  // The guard above is only worth having if it can fail — pin its parsing.
  const clients = clientModules();
  for (const file of ["hero.tsx", "live-board.tsx", "showcase.tsx", "live-hooks.ts"]) {
    assert.ok(clients.has(file), `${file} is a client module`);
  }
  // The page, the shared shaping and the canvas engine must all stay loadable
  // on the server: the page imports the first two, and the engine is plain
  // DOM code that only a client component ever reaches.
  for (const file of ["page.tsx", "home-data.ts", "rain-engine.ts"]) {
    assert.ok(!clients.has(file), `${file} must not carry "use client"`);
  }

  const sample = `import { DiscordPreview, type LootboardChoice } from "./showcase";`;
  assert.deepEqual(valueImportsFrom(sample, "./showcase"), ["DiscordPreview"]);
  assert.deepEqual(valueImportsFrom(`import { type A } from "./showcase";`, "./showcase"), []);
  // A lower-case binding is exactly what the guard exists to flag.
  assert.deepEqual(valueImportsFrom(`import { useNow } from "./live-hooks";`, "./live-hooks"), [
    "useNow",
  ]);
});
