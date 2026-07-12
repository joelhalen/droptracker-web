import { notFound, redirect } from "next/navigation";
import type { ResolveCandidate } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { isNumericId, type EntityKind } from "@/lib/slug";

/** Singular kind used by the `/resolve` API (vs. the plural URL path segment). */
export type ResolveKind = "group" | "player" | "npc" | "item";

/** Resolution of an id-or-slug URL segment: a concrete entity, or (group/player
 *  name collisions) a set of candidates for the disambiguation page. */
export type EntityRef =
  | { ambiguous: false; id: number; name?: string }
  | { ambiguous: true; candidates: ResolveCandidate[] };

/**
 * Turn an id-or-slug URL segment into an entity reference.
 *
 * - A numeric segment is an id (existing behaviour, no backend round-trip).
 * - A slug is resolved via `api.resolve`: a single match yields its id; several
 *   matches yield `ambiguous` + candidates; no match calls `notFound()`.
 */
export async function resolveRef(kind: ResolveKind, segment: string): Promise<EntityRef> {
  const decoded = decodeURIComponent(segment);
  if (isNumericId(decoded)) return { ambiguous: false, id: Number(decoded) };

  const result = await api.resolve(kind, decoded);
  if (result.match) return { ambiguous: false, id: result.match.id, name: result.match.name };
  if (result.candidates.length > 0) return { ambiguous: true, candidates: result.candidates };
  notFound();
}

/**
 * For entity SUB-pages (e.g. `/groups/awesome-clan/lootboard`) that have no
 * disambiguation UI of their own: resolve the segment to a concrete id, or —
 * when the slug is ambiguous — redirect to the parent chooser at
 * `/{plural}/{segment}`. Always returns an id (redirect/notFound throw).
 */
export async function resolveIdOrRedirect(
  kind: ResolveKind,
  plural: EntityKind,
  segment: string,
): Promise<number> {
  const ref = await resolveRef(kind, segment);
  if (!ref.ambiguous) return ref.id;
  redirect(`/${plural}/${segment}`);
}

export type { ResolveCandidate };
