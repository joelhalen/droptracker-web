/**
 * Pure shaping for the search typeahead, shared by both front-ends.
 *
 * The site and the Discord Activity present suggestions very differently — one
 * pushes a URL, the other pushes a view onto a nav stack — but *which* hits are
 * shown, in what order, capped how, and described by what subtitle is the same
 * question on both. Keeping that here is what stops the two surfaces drifting
 * the moment one of them gains a new entity kind.
 *
 * Navigation deliberately stays out: a suggestion carries `kind` + `id`, and
 * each surface turns that into whatever "go there" means for it.
 */
import type { SearchResults } from "@droptracker/api-types";

export type SearchKind = "players" | "groups" | "npcs" | "items";

export const ALL_SEARCH_KINDS: SearchKind[] = ["players", "groups", "npcs", "items"];

/** Singular noun for a hit's kind badge. */
export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  players: "Player",
  groups: "Clan",
  npcs: "Boss",
  items: "Item",
};

/** Per-kind caps when several kinds share one list. */
const COMBINED_CAPS: Record<SearchKind, number> = {
  players: 5,
  groups: 4,
  npcs: 3,
  items: 3,
};

/** Scoped to a single kind the list is all signal, so it can be longer. */
const SCOPED_CAP = 8;

export type Suggestion = {
  /** Stable list key — ids repeat across kinds, so the kind has to be in it. */
  key: string;
  kind: SearchKind;
  id: number;
  name: string;
  /** Secondary line, when the hit has something worth saying. */
  detail: string | null;
  /** Catalog icon, for the kinds that have one. */
  iconUrl: string | null;
};

function pluralMembers(n: number): string {
  return `${n.toLocaleString()} member${n === 1 ? "" : "s"}`;
}

/**
 * Flatten a search payload into the rows a typeahead shows, in the order they
 * should appear, capped per kind.
 *
 * `kinds` scopes the result to what the calling surface is about — a clan
 * search on a groups page has no business offering items.
 */
export function toSuggestions(
  results: SearchResults,
  kinds: readonly SearchKind[] = ALL_SEARCH_KINDS,
): Suggestion[] {
  const cap = (kind: SearchKind) => (kinds.length === 1 ? SCOPED_CAP : COMBINED_CAPS[kind]);
  const out: Suggestion[] = [];

  if (kinds.includes("players")) {
    for (const p of (results.players ?? []).slice(0, cap("players"))) {
      out.push({
        key: `players-${p.id}`,
        kind: "players",
        id: p.id,
        name: p.name,
        detail: p.global_rank != null ? `Global rank #${p.global_rank.toLocaleString()}` : null,
        iconUrl: null,
      });
    }
  }
  if (kinds.includes("groups")) {
    for (const g of (results.groups ?? []).slice(0, cap("groups"))) {
      out.push({
        key: `groups-${g.id}`,
        kind: "groups",
        id: g.id,
        name: g.name,
        detail: g.member_count != null ? pluralMembers(g.member_count) : null,
        iconUrl: null,
      });
    }
  }
  if (kinds.includes("npcs")) {
    for (const n of (results.npcs ?? []).slice(0, cap("npcs"))) {
      out.push({
        key: `npcs-${n.id}`,
        kind: "npcs",
        id: n.id,
        name: n.name,
        detail: null,
        iconUrl: n.icon_url,
      });
    }
  }
  if (kinds.includes("items")) {
    for (const i of (results.items ?? []).slice(0, cap("items"))) {
      out.push({
        key: `items-${i.id}`,
        kind: "items",
        id: i.id,
        name: i.name,
        detail: null,
        iconUrl: i.icon_url,
      });
    }
  }
  return out;
}

/** Shortest query worth sending upstream — one letter matches far too much. */
export const MIN_SEARCH_LENGTH = 2;

/** How long to sit on a keystroke before asking the BFF. */
export const SEARCH_DEBOUNCE_MS = 250;
