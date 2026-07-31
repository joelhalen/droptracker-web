import type { Money } from "@droptracker/api-types";

/** OSRS renders item-stack text green from 10M gp upward. */
export const HIGH_VALUE_GP = 10_000_000;

/** The 10,000+ coins stack — the biggest coin pile the game draws. */
export const COINS_ICON = "/img/itemdb/1004.png";

/**
 * A formatted GP amount in the OSRS UI face with the coins icon on the left,
 * flipping to the game's high-value green (#00FF80, plus a faint glow) once
 * it reaches 10M. Below that it inherits the surrounding text color, so
 * existing styling holds. The icon scales with the local font size.
 */
export function GpAmount({ money, suffix = "" }: { money: Money; suffix?: string }) {
  const high = money.value >= HIGH_VALUE_GP;
  return (
    <span className={high ? "font-osrs text-osrs-gp-green gp-glow" : "font-osrs"}>
      <img
        src={COINS_ICON}
        alt=""
        aria-hidden
        className="mr-1 inline-block h-[1.1em] w-auto align-[-0.18em]"
      />
      {money.value_formatted}
      {suffix}
    </span>
  );
}
