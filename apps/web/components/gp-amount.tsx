import type { Money } from "@droptracker/api-types";

/** OSRS renders item-stack text green from 10M gp upward. */
export const HIGH_VALUE_GP = 10_000_000;

/**
 * A formatted GP amount in the OSRS UI face, flipping to the game's
 * high-value green (#00FF80, plus a faint glow) once it reaches 10M. Below
 * that it inherits the surrounding text color, so existing styling holds.
 */
export function GpAmount({ money, suffix = "" }: { money: Money; suffix?: string }) {
  const high = money.value >= HIGH_VALUE_GP;
  return (
    <span className={high ? "font-osrs text-osrs-gp-green gp-glow" : "font-osrs"}>
      {money.value_formatted}
      {suffix}
    </span>
  );
}
