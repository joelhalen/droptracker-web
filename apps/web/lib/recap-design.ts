/**
 * Pure edits for the recap designer (components/recap-designer.tsx). Every
 * operation returns a new design, so the component's undo-free "discard"
 * is just the saved copy. Unit-tested in test/recap-design.test.ts.
 */
import {
  RECAP_COUNTS,
  RECAP_MAX_HERO_STATS,
  RECAP_MAX_STANDOUTS,
  RECAP_SECTIONS,
  type Recap,
  type RecapColumn,
  type RecapCountKey,
  type RecapDesign,
} from "@droptracker/api-types";

type Section = RecapDesign["sections"][number];

const SECTION_DEFAULTS = new Map<string, (typeof RECAP_SECTIONS)[number]>(RECAP_SECTIONS.map((s) => [s.key, s]));

export function sectionMeta(key: string) {
  return SECTION_DEFAULTS.get(key);
}

/** The body panels a column holds, in order ("drop" has no column). */
export function columnSections(design: RecapDesign, column: RecapColumn): Section[] {
  return design.sections.filter((s) => s.key !== "drop" && (s.column ?? "main") === column);
}

/** All body panels in order, for the single-column layout. */
export function bodySections(design: RecapDesign): Section[] {
  return design.sections.filter((s) => s.key !== "drop");
}

function withSections(design: RecapDesign, sections: Section[]): RecapDesign {
  return { ...design, sections };
}

export function toggleSection(design: RecapDesign, key: string, enabled?: boolean): RecapDesign {
  return withSections(
    design,
    design.sections.map((s) => (s.key === key ? { ...s, enabled: enabled ?? !s.enabled } : s)),
  );
}

export function isEnabled(design: RecapDesign, key: string): boolean {
  return design.sections.find((s) => s.key === key)?.enabled ?? false;
}

/**
 * Move a panel one step up (-1) or down (+1) among its neighbours: the panels
 * of the same column in two-column mode, every body panel in single-column
 * mode. Order is kept in the one `sections` array, so both views stay
 * consistent with each other.
 */
export function moveSection(design: RecapDesign, key: string, dir: -1 | 1, scope: "column" | "all"): RecapDesign {
  const sections = [...design.sections];
  const index = sections.findIndex((s) => s.key === key);
  if (index < 0) return design;
  const column = sections[index]!.column ?? "main";
  const peers = sections
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.key !== "drop" && (scope === "all" || (s.column ?? "main") === column));
  const pos = peers.findIndex(({ i }) => i === index);
  const target = peers[pos + dir];
  if (!target) return design;
  [sections[index], sections[target.i]] = [sections[target.i]!, sections[index]!];
  return withSections(design, sections);
}

/** Put `key` immediately before `beforeKey` (drag and drop), taking its column. */
export function placeSection(design: RecapDesign, key: string, beforeKey: string | null, column: RecapColumn): RecapDesign {
  if (key === beforeKey) return design;
  const moving = design.sections.find((s) => s.key === key);
  if (!moving || moving.key === "drop") return design;
  const rest = design.sections.filter((s) => s.key !== key);
  const updated = { ...moving, column };
  let at = beforeKey ? rest.findIndex((s) => s.key === beforeKey) : -1;
  if (at < 0) {
    // End of that column: after its last panel, else at the end of the body.
    const lastInColumn = rest.map((s, i) => ({ s, i })).filter(({ s }) => s.key !== "drop" && (s.column ?? "main") === column).pop();
    at = lastInColumn ? lastInColumn.i + 1 : rest.findIndex((s) => s.key === "drop");
    if (at < 0) at = rest.length;
  }
  rest.splice(at, 0, updated);
  return withSections(design, rest);
}

export function setColumn(design: RecapDesign, key: string, column: RecapColumn): RecapDesign {
  return placeSection(design, key, null, column);
}

export function toggleStandout(design: RecapDesign, key: string): RecapDesign {
  if (design.standouts.includes(key)) {
    return { ...design, standouts: design.standouts.filter((k) => k !== key) };
  }
  if (design.standouts.length >= RECAP_MAX_STANDOUTS) return design;
  return { ...design, standouts: [...design.standouts, key] };
}

export function moveStandout(design: RecapDesign, key: string, dir: -1 | 1): RecapDesign {
  const list = [...design.standouts];
  const i = list.indexOf(key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return design;
  [list[i], list[j]] = [list[j]!, list[i]!];
  return { ...design, standouts: list };
}

export function toggleHeroStat(design: RecapDesign, key: string): RecapDesign {
  if (design.hero_stats.includes(key)) {
    return { ...design, hero_stats: design.hero_stats.filter((k) => k !== key) };
  }
  if (design.hero_stats.length >= RECAP_MAX_HERO_STATS) return design;
  return { ...design, hero_stats: [...design.hero_stats, key] };
}

export function setCount(design: RecapDesign, key: RecapCountKey, value: number): RecapDesign {
  const [lo, hi] = RECAP_COUNTS[key];
  return { ...design, counts: { ...design.counts, [key]: Math.max(lo, Math.min(hi, Math.round(value))) } };
}

export function countValue(design: RecapDesign, key: RecapCountKey): number {
  return design.counts[key] ?? RECAP_COUNTS[key][2];
}

export function toggleHidden(design: RecapDesign, playerId: number): RecapDesign {
  const hidden = design.hidden_players.includes(playerId)
    ? design.hidden_players.filter((p) => p !== playerId)
    : [...design.hidden_players, playerId];
  return { ...design, hidden_players: hidden };
}

/** Typing a message switches its panel on, so the note can't silently vanish. */
export function setNote(design: RecapDesign, note: { title?: string; body?: string }): RecapDesign {
  const next = { ...design, note: { ...design.note, ...note } };
  return next.note.body.trim() && !design.note.body.trim() ? toggleSection(next, "note", true) : next;
}

export function designsEqual(a: RecapDesign, b: RecapDesign): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * What a card actually has data for, so the designer can say "nothing to show
 * this month" next to a panel or standout instead of leaving a switched-on
 * panel mysteriously absent from the preview.
 */
export function cardAvailability(recap: Recap | null): {
  sections: Record<string, boolean>;
  standouts: Set<string>;
} {
  const standouts = new Set<string>();
  for (const c of recap?.standouts?.categories ?? []) if (c.entries.length) standouts.add(c.key);
  if (!recap?.standouts) {
    const legacy: Record<string, string> = {
      most_pbs: "pbs", most_clog_slots: "clog_slots", most_cas: "cas", most_pets: "pets", most_deaths: "deaths",
    };
    for (const [k, v] of Object.entries(recap?.superlatives ?? {})) if (v && v.count > 0 && legacy[k]) standouts.add(legacy[k]!);
  }
  const ach = Object.values(recap?.achievements ?? {}).some((n) => n > 0);
  return {
    standouts,
    sections: {
      gallery: (recap?.top_items.length ?? 0) > 0,
      sources: recap?.npc_data_available !== false && (recap?.top_npcs.length ?? 0) > 0,
      skills: (recap?.standouts?.skills.length ?? 0) > 0,
      bosses: (recap?.standouts?.bosses.length ?? 0) > 0,
      note: true,
      members: (recap?.top_members?.length ?? 0) > 0,
      standouts: standouts.size > 0,
      milestones: ach,
      pets: (recap?.new_pets?.length ?? 0) > 0,
      drop: Boolean(recap?.biggest_drop),
    },
  };
}
