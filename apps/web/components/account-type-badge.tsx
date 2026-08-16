import { accountTypeDisplay } from "@/lib/account-types";

/**
 * In-game chat badge for a player's OSRS game mode. Renders nothing for
 * regular accounts, missing data, or modes this build doesn't recognize.
 */
export function AccountTypeBadge({ type }: { type: string | null | undefined }) {
  const display = accountTypeDisplay(type);
  if (!display) return null;

  return (
    <img
      src={display.icon}
      alt={display.label}
      title={display.label}
      height={20}
      className="inline-block h-5 w-auto shrink-0 [image-rendering:pixelated]"
    />
  );
}
