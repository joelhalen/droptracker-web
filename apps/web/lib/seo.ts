import type { Metadata } from "next";
import type { GroupProfile } from "@droptracker/api-types";
import type { EntityKind } from "./slug";

/**
 * `alternates.canonical` for an entity page. The pretty slug URL is canonical
 * when the backend confirms the name is unique (`canonical_slug`); a colliding
 * name has no unique pretty URL and keeps its id URL. Relative paths resolve
 * against `metadataBase` (set in app/layout.tsx).
 */
export function entityCanonical(
  kind: EntityKind,
  id: number,
  canonicalSlug?: string | null,
): { canonical: string } {
  return { canonical: canonicalSlug ? `/${kind}/${canonicalSlug}` : `/${kind}/${id}` };
}

/**
 * Social-card metadata for an entity page: the generated 1200×630 card at
 * `/api/og/{kind}/{id}.png` (app/api/og, layout in lib/og/card.tsx), which
 * shows the entity's picture and headline stats. Keyed by numeric id so slug
 * and id URLs of the same entity share one cached image.
 */
export function entitySocialMetadata(
  kind: EntityKind,
  id: number,
  { title, description, alt }: { title: string; description: string; alt?: string },
): Metadata {
  const image = {
    url: `/api/og/${kind}/${id}.png`,
    width: 1200,
    height: 630,
    alt: alt ?? `${title} on DropTracker`,
  };
  return {
    title,
    description,
    openGraph: {
      title: `${title} · DropTracker`,
      description,
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · DropTracker`,
      description,
      images: [image],
    },
  };
}

/**
 * Social-card metadata for a group-scoped page (profile, lootboard, points).
 * The card carries the group's icon, or its lootboard when it has none.
 */
export function groupSocialMetadata(
  group: GroupProfile,
  { title, description }: { title: string; description?: string },
): Metadata {
  // The backend fills an unset description with a generic line; a card
  // saying "An Old School RuneScape group." tells nobody anything.
  const own =
    group.description && group.description !== "An Old School RuneScape group."
      ? group.description
      : null;
  const desc =
    description ??
    own ??
    `${group.name}: ${group.member_count.toLocaleString("en-US")} members tracking their Old School RuneScape loot on DropTracker.`;
  return entitySocialMetadata("groups", group.id, { title, description: desc, alt: group.name });
}
