/**
 * Provider-agnostic core of AI event-task generation.
 *
 * Shared by the superadmin /eventprompt tool and the group-facing "try
 * describing a task instead" panel in the task builder, so both get the same
 * grounding, name-canonicalisation and self-correction behaviour. This module
 * enforces NO permissions and NO quota — every caller must do that first.
 */
import { EventTaskInputSchema, type EventTaskInput } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { ClaudeCliError, runClaudeJson } from "@/lib/claude-cli";
import {
  GENERATION_SCHEMA,
  MAX_DESCRIPTION_CHARS,
  NPC_EXTRACT_SCHEMA,
  NPC_EXTRACT_SYSTEM,
  SYSTEM_PROMPT,
  buildCorrectionSection,
  buildGroundingSection,
  type RawGeneration,
} from "@/app/(site)/(admin)/eventprompt/prompt";

/** Grounding caps: keep the prompt bounded however wild the description. */
const MAX_GROUNDING_NPCS = 4;
const MAX_DROP_TABLE_ITEMS = 80;
const MAX_CORRECTED_NAMES = 8;

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

/** Validate a description without spending anything. */
export function validateDescription(description: string): { ok: true; desc: string } | { ok: false; error: string } {
  const desc = (description ?? "").trim();
  if (desc.length < 5) return { ok: false, error: "Describe the task in a sentence or two." };
  if (desc.length > MAX_DESCRIPTION_CHARS) {
    return { ok: false, error: `Keep the description under ${MAX_DESCRIPTION_CHARS} characters.` };
  }
  return { ok: true, desc };
}

/** Run the full generation pipeline for an already-validated description. */
export async function generateFromDescription(desc: string): Promise<GenerateResult> {
  const usage = { output_tokens: 0, cost_usd: 0 };
  const track = (u: { output_tokens: number; cost_usd: number }) => {
    usage.output_tokens += u.output_tokens;
    usage.cost_usd += u.cost_usd;
  };

  // Pass 0 — ground the generation in real data: find which bosses/raids the
  // description references and pull their actual drop tables from the game DB,
  // so item names are copied from data instead of recalled from memory.
  let grounding = "";
  try {
    const ext = await runClaudeJson<{ npcs: string[] }>({
      systemPrompt: NPC_EXTRACT_SYSTEM,
      prompt: desc,
      jsonSchema: NPC_EXTRACT_SCHEMA,
    });
    track(ext.usage);
    grounding = buildGroundingSection(await fetchDropTables(ext.result.npcs));
  } catch (err) {
    console.error("[eventprompt] NPC grounding failed (continuing without):", err);
  }

  const descSection = `=== TASK DESCRIPTION (untrusted form input) ===\n${desc}`;

  // Pass 1 — generate the task.
  let raw: RawGeneration;
  try {
    const res = await runClaudeJson<RawGeneration>({
      systemPrompt: SYSTEM_PROMPT,
      prompt: grounding + descSection,
      jsonSchema: GENERATION_SCHEMA,
    });
    track(res.usage);
    raw = res.result;
  } catch (err) {
    const msg = err instanceof ClaudeCliError ? err.message : "Generation failed unexpectedly.";
    console.error("[eventprompt] generation failed:", err);
    return { ok: false, error: msg };
  }

  try {
    let built = await buildTaskInput(raw);

    // Pass 2 (only when needed) — the model used names the item DB doesn't
    // know: hand back its attempt with fuzzy-search suggestions and make it
    // correct itself once. Anything still unresolved surfaces as a warning.
    if (built.unresolvedItems.length) {
      const suggestions = await Promise.all(
        built.unresolvedItems.slice(0, MAX_CORRECTED_NAMES).map(async (name) => ({
          name,
          suggestions: (await api.searchEventItems(name)).slice(0, 5).map((e) => e.name),
        })),
      );
      const res = await runClaudeJson<RawGeneration>({
        systemPrompt: SYSTEM_PROMPT,
        prompt: grounding + buildCorrectionSection(raw, suggestions) + descSection,
        jsonSchema: GENERATION_SCHEMA,
      });
      track(res.usage);
      raw = res.result;
      built = await buildTaskInput(raw);
    }

    return { ok: true, ...built, notes: raw.notes ?? "", usage };
  } catch (err) {
    console.error("[eventprompt] post-processing failed:", err);
    return { ok: false, error: "The model produced an unusable task — try rewording." };
  }
}

/** Resolve extracted NPC names (exact match, then search fallback) and fetch
 * their drop tables for the grounding section. */
async function fetchDropTables(names: string[]): Promise<{ npc: string; items: string[] }[]> {
  const wanted = [...new Set(names.map((n) => n.trim()).filter(Boolean))].slice(
    0,
    MAX_GROUNDING_NPCS,
  );
  if (!wanted.length) return [];

  const exact = await api.resolveEventMeta("npc", wanted);
  const byLower = new Map(exact.map((e) => [e.name.toLowerCase(), e]));
  const resolved = await Promise.all(
    wanted.map(async (name) => {
      const hit = byLower.get(name.toLowerCase());
      if (hit) return hit;
      // Fuzzy fallback: first search result whose name contains the query.
      const found = await api.searchEventNpcs(name);
      return found[0] ?? null;
    }),
  );

  const seen = new Set<number>();
  const tables: { npc: string; items: string[] }[] = [];
  for (const npc of resolved) {
    if (!npc || seen.has(npc.id)) continue;
    seen.add(npc.id);
    const items = await api.eventNpcDropItems(npc.id);
    tables.push({ npc: npc.name, items: items.slice(0, MAX_DROP_TABLE_ITEMS).map((e) => e.name) });
  }
  return tables;
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
  if (config.item_npcs && typeof config.item_npcs === "object") {
    for (const [itemName, npcList] of Object.entries(config.item_npcs)) {
      if (itemName.trim()) items.add(itemName.trim());
      addNpcs(npcList);
    }
  }
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
  if (out.item_npcs && typeof out.item_npcs === "object") {
    out.item_npcs = Object.fromEntries(
      Object.entries(out.item_npcs).map(([k, v]) => [item(k), mapNpcs(v)]),
    );
  }
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
