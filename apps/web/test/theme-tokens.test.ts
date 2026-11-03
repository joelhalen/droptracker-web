/**
 * Every `osrs-*` colour or shadow utility must name a token the theme defines.
 *
 * Why this exists: the clan stats member drawer shipped with `bg-osrs-surface`,
 * but the theme only defines `osrs-surface-0` to `-3`. Tailwind emits nothing
 * for an unknown colour, so the panel rendered fully transparent over the page
 * and nothing failed. This scan turns that silent miss into a test failure.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const WEB = join(import.meta.dirname, "..");
const UI = join(WEB, "..", "..", "packages", "ui", "src");

const SKIP_DIRS = new Set(["node_modules", ".next", ".next-blue", ".next-green", "test"]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const theme = readFileSync(join(UI, "theme.css"), "utf8");
const colors = new Set([...theme.matchAll(/--color-osrs-([a-z0-9-]+):/g)].map((m) => m[1]));
const shadows = new Set([...theme.matchAll(/--shadow-osrs-([a-z0-9-]+):/g)].map((m) => m[1]));

const UTILITY =
  /(?<![\w-])(bg|text|border(?:-[trblxyse])?|from|via|to|ring|ring-offset|fill|stroke|outline|divide|placeholder|decoration|accent|caret|shadow)-osrs-([a-z0-9]+(?:-[a-z0-9]+)*)/g;

test("the theme defines the tokens this scan checks against", () => {
  assert.ok(colors.has("gold") && colors.has("surface-1"), "colour tokens parsed");
  assert.ok(shadows.has("pop"), "shadow tokens parsed");
});

test("every osrs-* colour and shadow utility names a defined token", () => {
  const roots = ["app", "components", "lib"].map((d) => join(WEB, d)).concat(UI);
  const missing: string[] = [];
  for (const file of roots.flatMap((r) => sourceFiles(r))) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        for (const [cls, kind, name] of line.matchAll(UTILITY)) {
          const known = kind === "shadow" ? shadows : colors;
          if (!known.has(name)) missing.push(`${file.slice(WEB.length - 8)}:${i + 1} ${cls}`);
        }
      });
  }
  assert.deepEqual(missing, [], `undefined theme tokens (Tailwind emits no CSS for these):\n${missing.join("\n")}`);
});
