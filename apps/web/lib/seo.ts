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
 * Social-card metadata for a group-scoped page. The group's uploaded icon
 * becomes the link-preview image; square icons read best as a compact
 * "summary" twitter card, while the default 1200×630 art suits the large one.
 */
export function groupSocialMetadata(
  group: GroupProfile,
  { title, description }: { title: string; description?: string },
): Metadata {
  const desc =
    description ??
    group.description ??
    `${group.name} — ${group.member_count} members tracking their Old School RuneScape loot on DropTracker.`;
  const image = group.icon_url ?? "/og-default.png";
  return {
    title,
    description: desc,
    openGraph: {
      title: `${title} · DropTracker`,
      description: desc,
      type: "website",
      images: [image],
    },
    twitter: {
      card: group.icon_url ? "summary" : "summary_large_image",
      images: [image],
    },
  };
}
