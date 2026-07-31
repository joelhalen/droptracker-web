import type { Money } from "@droptracker/api-types";

/** OSRS renders item-stack text green from 10M gp upward. */
export const HIGH_VALUE_GP = 10_000_000;

/**
 * A formatted GP amount that flips to OSRS's high-value green (#00FF80, plus
 * a faint glow) once it reaches 10M. Below that it renders bare and inherits
 * the surrounding text color, so existing styling is untouched.
 */
export function GpAmount({ money, suffix = "" }: { money: Money; suffix?: string }) {
  return money.value >= HIGH_VALUE_GP ? (
    <span className="text-osrs-gp-green gp-glow">
      {money.value_formatted}
      {suffix}
    </span>
  ) : (
    <>
      {money.value_formatted}
      {suffix}
    </>
  );
}
