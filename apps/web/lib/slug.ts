import type { Route } from "next";

/** URL path segment for each public entity type (plural, as routed). */
export type EntityKind = "groups" | "players" | "npcs" | "items";

/**
 * Turn a display name into a URL slug.
 *
 * MUST stay equivalent to the backend `slugify()` (web_api/common.py) — a slug
 * authored on one side has to resolve on the other: lowercase → every run of
 * non-alphanumeric characters becomes a single `-` → trim leading/trailing `-`.
 * A name with no alphanumerics slugifies to `""` (→ no pretty URL, fall to id).
 */
export function slugify(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** True when a URL segment is a bare numeric id (which we always treat as an id,
 *  never a slug — so an entity named only with digits can't get a pretty URL). */
export function isNumericId(segment: string): boolean {
  return /^\d+$/.test(segment);
}

/**
 * Read the id out of a legacy XenForo entity ref.
 *
 * The pre-2026 site addressed every entity as `{Title}.{id}` and hung the
 * action off the end — `/groups/PlayTheGame.176/view`, `/players/Zezima.5/drops`.
 * Those links are still in Discord history, old embeds and search results, and
 * the trailing id makes them unambiguous *without* a backend round-trip, so the
 * ref is resolved as a first-class URL form rather than 404'd.
 *
 * A modern slug can never be mistaken for one: `slugify()` turns every run of
 * non-alphanumerics — the `.` included — into `-`, so a `.` in a segment only
 * ever came from XF. Returns `null` for anything that isn't the ref shape.
 */
export function legacyRefId(segment: string): number | null {
  const m = /^.+\.(\d+)$/.exec(segment);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isSafeInteger(id) ? id : null;
}

/**
 * Build the public path for an entity, preferring the pretty slug URL when a
 * name is available and slugifiable, else the id URL. The slug URL is the
 * canonical one; the rare colliding name routes through the disambiguation page
 * (see `lib/entity-ref.ts`). Callers that only have an id get a working id URL.
 */
export function entityPath(kind: EntityKind, id: number | string, name?: string | null): Route {
  const slug = slugify(name);
  return `/${kind}/${slug || String(id)}` as Route;
}
