import type { BadgeSize } from "@droptracker/ui";
import { accountTypeDisplay, accountTypeIconPx } from "@/lib/account-types";

/**
 * In-game chat badge for a player's OSRS game mode. Renders nothing for
 * regular accounts, missing data, or modes this build doesn't recognize.
 */
export function AccountTypeBadge({
  type,
  size = "md",
}: {
  type: string | null | undefined;
  size?: BadgeSize;
}) {
  const display = accountTypeDisplay(type);
  if (!display) return null;

  const px = accountTypeIconPx(size);
  return (
    <img
      src={display.icon}
      alt={display.label}
      title={display.label}
      height={px}
      style={{ height: px }}
      className="inline-block w-auto shrink-0 [image-rendering:pixelated]"
    />
  );
}
