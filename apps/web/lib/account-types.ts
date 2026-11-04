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
  // Own-property check, not a bare index: DISPLAY is an object literal, so
  // `DISPLAY["constructor"]` (or "toString", …) would otherwise return an
  // Object.prototype member — truthy, and rendered as <img src={undefined}>.
  if (!Object.prototype.hasOwnProperty.call(DISPLAY, type)) return null;
  return DISPLAY[type] ?? null;
}

// Source art is 13px tall; lg (26px) is the only integer scale, sm/md trade a
// little crispness for fit alongside the pill badges' sm/md/lg steps.
const ICON_PX: Record<BadgeSize, number> = { sm: 16, md: 20, lg: 26 };

export function accountTypeIconPx(size: BadgeSize | undefined): number {
  return ICON_PX[size ?? "md"];
}

/**
 * Player-board filter options, in display order. `key` is the backend's
 * `?account_type=` value (utils/account_types.ACCOUNT_TYPE_FILTERS): an exact
 * mode, or a family. "All players" is the absence of a key.
 */
export type AccountTypeFilter = {
  key: string;
  label: string;
  /** Badge art for the pill; families and regular accounts have none. */
  icon?: string;
  /** Modes the key covers, for filtering an already-loaded list. */
  modes: readonly string[];
};

const IRON_MODES = [
  "ironman",
  "hardcore_ironman",
  "ultimate_ironman",
  "group_ironman",
  "hardcore_group_ironman",
  "unranked_group_ironman",
] as const;

export const ACCOUNT_TYPE_FILTERS: readonly AccountTypeFilter[] = [
  { key: "normal", label: "Regular", modes: ["normal"] },
  { key: "any_ironman", label: "All irons", modes: IRON_MODES },
  { key: "ironman", label: "Ironman", icon: DISPLAY.ironman!.icon, modes: ["ironman"] },
  { key: "hardcore_ironman", label: "Hardcore", icon: DISPLAY.hardcore_ironman!.icon, modes: ["hardcore_ironman"] },
  { key: "ultimate_ironman", label: "Ultimate", icon: DISPLAY.ultimate_ironman!.icon, modes: ["ultimate_ironman"] },
  {
    key: "any_group_ironman",
    label: "Group",
    icon: DISPLAY.group_ironman!.icon,
    modes: ["group_ironman", "hardcore_group_ironman", "unranked_group_ironman"],
  },
];

/** The filter for a URL/search value, or null for "All players". */
export function accountTypeFilter(key: string | null | undefined): AccountTypeFilter | null {
  if (!key) return null;
  return ACCOUNT_TYPE_FILTERS.find((f) => f.key === key) ?? null;
}
