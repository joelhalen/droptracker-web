/**
 * Page model for the group settings page (`/groups/[id]/settings`).
 *
 * The shared registry (`@droptracker/api-types` group-config) says which
 * fields exist and which category each belongs to; that part is mirrored by
 * the backend and rendered by the Discord config panel too. Everything here is
 * web-only presentation layered on top: the order sections appear on the page,
 * the sidebar grouping, the one-line blurb under each section title, the two
 * list editors (blacklist, always-announce) that are sections without being
 * registry fields, the inserts that render inside a registry section (the
 * icon uploader, the custom-timeframe board), how a section's fields split into
 * blocks, and the filter box that narrows all of it.
 *
 * Pure and unit-tested — keep DOM and React out of here.
 */
import {
  CONFIG_CATEGORIES,
  GROUP_CONFIG_FIELDS,
  type ConfigCategory,
  type ConfigField,
} from "@droptracker/api-types";

/* --- Sections ------------------------------------------------------------- */

/** Sidebar headings, in page order. */
export type SettingsNav =
  | "Group"
  | "Notifications"
  | "Boards & reports"
  | "Integrations"
  | "Seasonal worlds";

export type SettingsPanelId = "blacklist" | "always";
export type SettingsSectionId = ConfigCategory | SettingsPanelId | "seasonal";

export interface SettingsSection {
  id: SettingsSectionId;
  /** `category`: registry fields. `panel`: a self-contained editor passed in by
   * the page. `seasonal`: the seasonal mirrors of every `seasonalMirror` field. */
  kind: "category" | "panel" | "seasonal";
  label: string;
  nav: SettingsNav;
  /** One line under the title saying what the section is for. */
  blurb: string;
  /** Extra words the filter box matches for sections that have no fields to
   * match on. Registry sections match on their fields instead. */
  keywords?: string[];
}

const CATEGORY_META: Record<ConfigCategory, { nav: SettingsNav; blurb: string }> = {
  profile: {
    nav: "Group",
    blurb: "How your group appears on its public page, in Discord embeds and in search.",
  },
  channels: {
    nav: "Notifications",
    blurb:
      "Where each kind of notification is posted. Anything left unset falls back to the drops channel. Features with a channel of their own — deaths, Hall of Fame, recaps, Clan Log, the lootboard — set it in their own section.",
  },
  drops: {
    nav: "Notifications",
    blurb: "What has to be true for a drop to be announced, and how manual submissions count.",
  },
  achievements: {
    nav: "Notifications",
    blurb: "Collection log slots, pets, combat achievements, quests and diaries.",
  },
  deaths: {
    nav: "Notifications",
    blurb:
      "Announce members' deaths, with your own randomized messages if you like — or let members write their own.",
  },
  levels: {
    nav: "Notifications",
    blurb: "Level-ups, total-level milestones and post-99 XP milestones.",
  },
  milestones: {
    nav: "Notifications",
    blurb: "Boss kill-count milestones and hiscores-rank milestones.",
  },
  pbs: {
    nav: "Notifications",
    blurb: "Personal-best notifications, and the Hall of Fame leaderboards the bot keeps updated.",
  },
  board: {
    nav: "Boards & reports",
    blurb:
      "The lootboard image the bot keeps updated in Discord, plus one-off boards for any date range.",
  },
  recaps: {
    nav: "Boards & reports",
    blurb: "A recap card for the month just ended, posted on the 1st.",
  },
  clan_log: {
    nav: "Boards & reports",
    blurb: "A standing Discord message tracking how far through every boss's uniques your clan is.",
  },
  clan_chat: {
    nav: "Integrations",
    blurb:
      "Your in-game clan chat: track broadcasts for members who don't run the plugin, and bridge chat to a Discord channel.",
  },
  voice: {
    nav: "Integrations",
    blurb: "Voice channels the bot renames every 10 minutes to show live totals.",
  },
  integration: {
    nav: "Integrations",
    blurb: "WiseOldMan syncing and the keys other tools use to read your group's data.",
  },
};

function category(id: ConfigCategory): SettingsSection {
  const cat = CONFIG_CATEGORIES.find((c) => c.id === id);
  if (!cat) throw new Error(`unknown config category ${id}`);
  return { id, kind: "category", label: cat.label, ...CATEGORY_META[id] };
}

/** Every section on the page, top to bottom. */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  category("profile"),
  category("channels"),
  category("drops"),
  {
    id: "blacklist",
    kind: "panel",
    label: "Notification blacklist",
    nav: "Notifications",
    blurb:
      "Items, NPCs and places your Discord channels never hear about. Blacklisted submissions are still recorded, scored and counted — on your lootboard, leaderboards, points and events. Only the Discord message is withheld.",
    keywords: ["mute", "ignore", "hide", "silence", "item", "npc", "boss", "region", "place", "area"],
  },
  {
    id: "always",
    kind: "panel",
    label: "Always announce",
    nav: "Notifications",
    blurb:
      "Items and NPCs your Discord channels always hear about: a drop of a listed item, or from a listed NPC, is announced even below your minimum notification value. Made for notable valueless drops like ornament kits and dyes. A screenshot requirement still applies, and the blacklist wins if a name is on both lists.",
    keywords: ["whitelist", "minimum value", "notable", "kit", "dye", "item", "npc", "boss"],
  },
  category("achievements"),
  category("deaths"),
  category("levels"),
  category("milestones"),
  category("pbs"),
  category("board"),
  category("recaps"),
  category("clan_log"),
  category("clan_chat"),
  category("voice"),
  category("integration"),
  {
    id: "seasonal",
    kind: "seasonal",
    label: "Seasonal (Leagues)",
    nav: "Seasonal worlds",
    blurb:
      "Separate settings applied only to submissions from seasonal worlds (Leagues, Deadman). Your main-world settings are unaffected.",
    keywords: ["leagues", "deadman", "dmm", "seasonal"],
  },
];

/** Anchor id of a section's card — the sidebar links to it and scroll-spy reads it back. */
export const sectionAnchor = (id: SettingsSectionId) => `cfg-${id}`;

/* --- Inserts -------------------------------------------------------------- */

/** Editors that are not registry fields but belong inside a registry section. */
export type SettingsInsertId = "groupIcon" | "timeframeBoard" | "memberDeathMessages";

export interface SettingsInsert {
  id: SettingsInsertId;
  section: ConfigCategory;
  /** Above the section's fields, or below them. */
  position: "top" | "bottom";
  label: string;
  keywords: string[];
}

export const SETTINGS_INSERTS: readonly SettingsInsert[] = [
  {
    id: "groupIcon",
    section: "profile",
    position: "top",
    label: "Group icon",
    keywords: ["icon", "logo", "image", "avatar", "picture", "upload"],
  },
  {
    id: "timeframeBoard",
    section: "board",
    position: "bottom",
    label: "Custom timeframe lootboard",
    keywords: ["timeframe", "date range", "custom board", "generate", "png", "image", "event", "competition"],
  },
  {
    id: "memberDeathMessages",
    section: "deaths",
    position: "bottom",
    label: "Members' death messages",
    keywords: ["member", "own message", "custom message", "block", "moderation", "review"],
  },
];

/* --- Fields --------------------------------------------------------------- */

export const SEASONAL_PREFIX = "seasonal_";
export const seasonalKey = (key: string) => `${SEASONAL_PREFIX}${key}`;

/** Fields with a `seasonal_`-prefixed mirror, edited in the Seasonal section. */
export const SEASONAL_FIELDS: readonly ConfigField[] = GROUP_CONFIG_FIELDS.filter(
  (f) => f.seasonalMirror,
);

export function fieldsForCategory(id: ConfigCategory): ConfigField[] {
  return GROUP_CONFIG_FIELDS.filter((f) => f.category === id);
}

export function categoryLabel(id: ConfigCategory): string {
  return CONFIG_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** The seasonal mirrors, grouped under their base field's category so the
 * Seasonal section reads like a condensed copy of the main page. */
export function seasonalFieldsGrouped(fields: readonly ConfigField[] = SEASONAL_FIELDS): ConfigField[] {
  return fields.map((f) => ({ ...f, group: categoryLabel(f.category) }));
}

/** One rendered block of a section: an optional sub-heading and its fields. */
export interface FieldBlock {
  group: string | null;
  fields: ConfigField[];
}

/** Split a section's fields into blocks by `group`, in first-appearance order.
 * Ungrouped fields always form the opening block, whatever their position. */
export function fieldBlocks(fields: readonly ConfigField[]): FieldBlock[] {
  const ungrouped: ConfigField[] = [];
  const groups = new Map<string, ConfigField[]>();
  for (const f of fields) {
    if (!f.group) {
      ungrouped.push(f);
      continue;
    }
    const list = groups.get(f.group);
    if (list) list.push(f);
    else groups.set(f.group, [f]);
  }
  const out: FieldBlock[] = [];
  if (ungrouped.length) out.push({ group: null, fields: ungrouped });
  for (const [group, list] of groups) out.push({ group, fields: list });
  return out;
}

/** Field types that take a full row rather than a grid cell. */
export const WIDE_TYPES: ReadonlySet<ConfigField["type"]> = new Set([
  "text",
  "csv",
  "bosslist",
  "multiselect",
  "messagelist",
]);

export interface BlockLayout {
  /** True when the block's first field is a toggle: its switches (usually a
   * master "Notify X" switch) render above its inputs instead of below. */
  leadWithToggles: boolean;
  toggles: ConfigField[];
  /** Inputs that sit two to a row. */
  compact: ConfigField[];
  /** Inputs that take the full row. */
  wide: ConfigField[];
}

export function blockLayout(fields: readonly ConfigField[]): BlockLayout {
  return {
    leadWithToggles: fields[0]?.type === "boolean",
    toggles: fields.filter((f) => f.type === "boolean"),
    compact: fields.filter((f) => f.type !== "boolean" && !WIDE_TYPES.has(f.type)),
    wide: fields.filter((f) => WIDE_TYPES.has(f.type)),
  };
}

/* --- Filter --------------------------------------------------------------- */

export function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function textMatches(texts: readonly (string | undefined)[], q: string): boolean {
  return texts.some((t) => t != null && t.toLowerCase().includes(q));
}

/** Matches on what an admin can see (label, help, sub-heading) and on the
 * key with its underscores spaced out, so "clog" and "manual review" both hit. */
export function fieldMatches(field: ConfigField, q: string): boolean {
  if (!q) return true;
  return textMatches([field.label, field.help, field.group, field.key.replace(/_/g, " ")], q);
}

export function sectionMatches(section: SettingsSection, q: string): boolean {
  if (!q) return true;
  return textMatches([section.label, section.blurb, section.nav, ...(section.keywords ?? [])], q);
}

export function insertMatches(insert: SettingsInsert, q: string): boolean {
  if (!q) return true;
  return textMatches([insert.label, ...insert.keywords], q);
}

/** A section as the page should render it under the current filter. */
export interface VisibleSection {
  section: SettingsSection;
  /** Registry fields to render (base fields; the Seasonal section prefixes
   * their keys itself). Empty for panel sections. */
  fields: ConfigField[];
  inserts: SettingsInsert[];
}

/**
 * Resolve the filter box against the whole page. With no query every section
 * renders in full. With one, a section whose own title/blurb matches renders
 * in full; otherwise it renders only its matching fields and inserts, and
 * disappears when nothing in it matches.
 */
export function visibleSections(query: string): VisibleSection[] {
  const q = normalizeQuery(query);
  const out: VisibleSection[] = [];
  for (const section of SETTINGS_SECTIONS) {
    const whole = sectionMatches(section, q);
    const allFields =
      section.kind === "category"
        ? fieldsForCategory(section.id as ConfigCategory)
        : section.kind === "seasonal"
          ? seasonalFieldsGrouped()
          : [];
    const allInserts =
      section.kind === "category"
        ? SETTINGS_INSERTS.filter((i) => i.section === section.id)
        : [];
    const fields = whole ? allFields : allFields.filter((f) => fieldMatches(f, q));
    const inserts = whole ? allInserts : allInserts.filter((i) => insertMatches(i, q));
    if (!q || whole || fields.length > 0 || inserts.length > 0) {
      out.push({ section, fields, inserts });
    }
  }
  return out;
}

/** Sidebar groups: consecutive visible sections sharing a `nav` heading. */
export function navGroups(sections: readonly VisibleSection[]): { nav: SettingsNav; sections: VisibleSection[] }[] {
  const out: { nav: SettingsNav; sections: VisibleSection[] }[] = [];
  for (const s of sections) {
    const last = out[out.length - 1];
    if (last && last.nav === s.section.nav) last.sections.push(s);
    else out.push({ nav: s.section.nav, sections: [s] });
  }
  return out;
}

/** The sidebar/section id a changed config key counts toward. */
export function sectionForKey(key: string, field: ConfigField): SettingsSectionId {
  // A key that resolved via prefix-stripping is a seasonal mirror.
  return key !== field.key ? "seasonal" : field.category;
}
