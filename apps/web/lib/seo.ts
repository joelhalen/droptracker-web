import type { Metadata } from "next";
import type { GroupProfile } from "@droptracker/api-types";

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
