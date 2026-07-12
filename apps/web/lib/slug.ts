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
 * Build the public path for an entity, preferring the pretty slug URL when a
 * name is available and slugifiable, else the id URL. The slug URL is the
 * canonical one; the rare colliding name routes through the disambiguation page
 * (see `lib/entity-ref.ts`). Callers that only have an id get a working id URL.
 */
export function entityPath(kind: EntityKind, id: number | string, name?: string | null): Route {
  const slug = slugify(name);
  return `/${kind}/${slug || String(id)}` as Route;
}
