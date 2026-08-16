import type { BadgeSize } from "@droptracker/ui";

// OSRS game-mode display mapping. Backend values arrive via the optional
// `account_type` field on player payloads; anything unrecognized (including
// modes added backend-side after this build shipped) must render as nothing.

export type AccountTypeDisplay = {
  label: string;
  /** In-game chat badge (10×13 / 13×13 pixel art), self-hosted in public/. */
  icon: string;
};

const DISPLAY: Record<string, AccountTypeDisplay> = {
  ironman: { label: "Ironman", icon: "/account-types/ironman.png" },
  hardcore_ironman: { label: "Hardcore Ironman", icon: "/account-types/hardcore-ironman.png" },
  ultimate_ironman: { label: "Ultimate Ironman", icon: "/account-types/ultimate-ironman.png" },
  group_ironman: { label: "Group Ironman", icon: "/account-types/group-ironman.png" },
  hardcore_group_ironman: {
    label: "Hardcore Group Ironman",
    icon: "/account-types/hardcore-group-ironman.png",
  },
  unranked_group_ironman: {
    label: "Unranked Group Ironman",
    icon: "/account-types/unranked-group-ironman.png",
  },
};

export function accountTypeDisplay(type: string | null | undefined): AccountTypeDisplay | null {
  if (!type) return null;
  return DISPLAY[type] ?? null;
}

// Source art is 13px tall; lg (26px) is the only integer scale, sm/md trade a
// little crispness for fit alongside the pill badges' sm/md/lg steps.
const ICON_PX: Record<BadgeSize, number> = { sm: 16, md: 20, lg: 26 };

export function accountTypeIconPx(size: BadgeSize | undefined): number {
  return ICON_PX[size ?? "md"];
}
