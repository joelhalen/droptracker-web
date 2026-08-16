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
