"use server";

/**
 * AI event-task generation (temporary admin tool, superadmin-only).
 *
 * Turns a plain-English description ("a full set of Justiciar from ToB or a
 * ToB weapon") into a complete EventTaskInput by spawning a headless,
 * tool-less, schema-constrained Claude Code CLI session under the machine's
 * subscription auth (see lib/claude-cli.ts — zero metered-API cost). The
 * result is rendered into the ordinary EventTaskForm for full manual editing
 * before anything is saved.
 */
import { EventTaskInputSchema, type EventTaskInput } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { requireSuperadmin } from "@/lib/auth";
import { ClaudeCliError, runClaudeJson } from "@/lib/claude-cli";
import {
  GENERATION_SCHEMA,
  MAX_DESCRIPTION_CHARS,
  SYSTEM_PROMPT,
  type RawGeneration,
} from "./prompt";

export type GeneratedTask = {
  ok: true;
  input: EventTaskInput;
  notes: string;
  /** Names the game DB didn't recognise — fix them in the editor before saving. */
  unresolvedItems: string[];
  unresolvedNpcs: string[];
  usage: { output_tokens: number; cost_usd: number };
};

export type GenerateResult = GeneratedTask | { ok: false; error: string };

export async function generateEventTask(description: string): Promise<GenerateResult> {
  await requireSuperadmin("/eventprompt");

  const desc = (description ?? "").trim();
  if (desc.length < 5) return { ok: false, error: "Describe the task in a sentence or two." };
  if (desc.length > MAX_DESCRIPTION_CHARS) {
    return { ok: false, error: `Keep the description under ${MAX_DESCRIPTION_CHARS} characters.` };
  }

  let raw: RawGeneration;
  let usage: { output_tokens: number; cost_usd: number };
  try {
    const res = await runClaudeJson<RawGeneration>({
      systemPrompt: SYSTEM_PROMPT,
      prompt: `=== TASK DESCRIPTION (untrusted form input) ===\n${desc}`,
      jsonSchema: GENERATION_SCHEMA,
    });
    raw = res.result;
    usage = { output_tokens: res.usage.output_tokens, cost_usd: res.usage.cost_usd };
  } catch (err) {
    const msg = err instanceof ClaudeCliError ? err.message : "Generation failed unexpectedly.";
    console.error("[eventprompt] generation failed:", err);
    return { ok: false, error: msg };
  }

  try {
    const built = await buildTaskInput(raw);
    return { ok: true, ...built, notes: raw.notes ?? "", usage };
  } catch (err) {
    console.error("[eventprompt] post-processing failed:", err);
    return { ok: false, error: "The model produced an unusable task — try rewording." };
  }
}

/** Convert the raw generation into a validated EventTaskInput, canonicalising
 * item/NPC names against the game DB and collecting the ones it doesn't know. */
async function buildTaskInput(raw: RawGeneration): Promise<{
  input: EventTaskInput;
  unresolvedItems: string[];
  unresolvedNpcs: string[];
}> {
  const t = raw.task;
  let config: Record<string, unknown> | null = null;
  if (t.config_json.trim()) {
    const parsed: unknown = JSON.parse(t.config_json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      config = parsed as Record<string, unknown>;
    }
  }

  // Collect every name the config (and target) references, by kind.
  const itemNames = new Set<string>();
  const npcNames = new Set<string>();
  collectNames(t.type, t.target, config, itemNames, npcNames);

  const [items, npcs] = await Promise.all([
    api.resolveEventMeta("item", [...itemNames]),
    api.resolveEventMeta("npc", [...npcNames]),
  ]);
  const itemMap = new Map(items.map((e) => [e.name.toLowerCase(), e.name]));
  const npcMap = new Map(npcs.map((e) => [e.name.toLowerCase(), e.name]));

  const canonItem = (n: string) => itemMap.get(n.toLowerCase()) ?? n;
  const canonNpc = (n: string) => npcMap.get(n.toLowerCase()) ?? n;
  if (config) config = rewriteNames(config, canonItem, canonNpc);

  let target = t.target.trim();
  if (target) {
    if (t.type === "item_collection") target = canonItem(target);
    else if (t.type === "kc_target" || t.type === "pb_target") target = canonNpc(target);
  }

  const input = EventTaskInputSchema.parse({
    type: t.type,
    label: (t.label.trim() || "Generated task").slice(0, 255),
    target: target || undefined,
    target_value: t.target_value > 0 ? Math.floor(t.target_value) : undefined,
    points: Math.max(0, Math.floor(t.points)),
    difficulty: t.difficulty === "none" ? null : t.difficulty,
    config: config && Object.keys(config).length ? JSON.stringify(config) : null,
  });

  const unresolvedItems = [...itemNames].filter((n) => !itemMap.has(n.toLowerCase()));
  const unresolvedNpcs = [...npcNames].filter((n) => !npcMap.has(n.toLowerCase()));
  return { input, unresolvedItems, unresolvedNpcs };
}

/* ----------------------- config name plumbing ----------------------- */

type ItemRef = string | { item_name?: string; name?: string; points?: number };

const refName = (i: ItemRef): string =>
  typeof i === "string" ? i : (i.item_name ?? i.name ?? "");

function collectNames(
  type: string,
  target: string,
  config: Record<string, unknown> | null,
  items: Set<string>,
  npcs: Set<string>,
): void {
  if (target.trim()) {
    if (type === "item_collection") items.add(target.trim());
    if (type === "kc_target" || type === "pb_target") npcs.add(target.trim());
  }
  if (!config) return;
  const addItems = (list: unknown) => {
    if (Array.isArray(list)) {
      for (const i of list) {
        const n = refName(i as ItemRef).trim();
        if (n) items.add(n);
      }
    }
  };
  const addNpcs = (list: unknown) => {
    if (Array.isArray(list)) {
      for (const n of list) if (typeof n === "string" && n.trim()) npcs.add(n.trim());
    }
  };
  addItems(config.items);
  addNpcs(config.npcs);
  addNpcs(config.source_npcs);
  if (Array.isArray(config.groups)) {
    for (const g of config.groups as { items?: unknown }[]) addItems(g.items);
  }
  if (Array.isArray(config.paths)) {
    for (const p of config.paths as Record<string, unknown>[]) {
      addItems(p.items);
      addNpcs(p.npcs);
      if (Array.isArray(p.groups)) {
        for (const g of p.groups as { items?: unknown }[]) addItems(g.items);
      }
    }
  }
}

/** Rewrite every item/NPC name in the config to its canonical DB spelling. */
function rewriteNames(
  config: Record<string, unknown>,
  item: (n: string) => string,
  npc: (n: string) => string,
): Record<string, unknown> {
  const mapItems = (list: unknown): unknown =>
    Array.isArray(list)
      ? list.map((i: ItemRef) =>
          typeof i === "string"
            ? item(i)
            : { ...i, item_name: item(refName(i)), name: undefined },
        )
      : list;
  const mapNpcs = (list: unknown): unknown =>
    Array.isArray(list) ? list.map((n) => (typeof n === "string" ? npc(n) : n)) : list;

  const out: Record<string, unknown> = { ...config };
  if (out.items) out.items = mapItems(out.items);
  if (out.npcs) out.npcs = mapNpcs(out.npcs);
  if (out.source_npcs) out.source_npcs = mapNpcs(out.source_npcs);
  if (Array.isArray(out.groups)) {
    out.groups = (out.groups as Record<string, unknown>[]).map((g) => ({
      ...g,
      items: mapItems(g.items),
    }));
  }
  if (Array.isArray(out.paths)) {
    out.paths = (out.paths as Record<string, unknown>[]).map((p) => {
      const next = { ...p };
      if (next.items) next.items = mapItems(next.items);
      if (next.npcs) next.npcs = mapNpcs(next.npcs);
      if (Array.isArray(next.groups)) {
        next.groups = (next.groups as Record<string, unknown>[]).map((g) => ({
          ...g,
          items: mapItems(g.items),
        }));
      }
      return next;
    });
  }
  return JSON.parse(JSON.stringify(out)) as Record<string, unknown>; // drop undefined keys
}
