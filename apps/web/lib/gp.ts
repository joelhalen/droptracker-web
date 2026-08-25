/**
 * OSRS gold shorthand for the app's GP entry fields (`<GpInput>`).
 *
 * Lives here rather than inside the component, like `lib/quantity.ts`, so the
 * contract can be unit-tested — there is no DOM test harness in this repo.
 *
 * A GP field asks for numbers with six to nine zeros in them. Typed as digits
 * those are both tedious and genuinely error-prone: "25000000" and "250000000"
 * differ by one keystroke and a factor of ten, and nothing on screen tells you
 * which one you got. So these fields accept the shorthand players already use
 * in-game — `1.5m`, `100k`, `2.5b`, `50kk` — and show the resolved number back.
 *
 * The parser mirrors the backend's `parse_gp`
 * (`disc/services/group_onboarding_panel.py`), which has accepted this
 * shorthand in the Discord onboarding modal since it shipped; the website was
 * the surface still demanding raw digits. Two deliberate differences: this one
 * rejects exponent notation ("1e6") as mid-edit junk rather than accepting it,
 * and it scales by shifting the decimal point through the digit string instead
 * of multiplying floats — `2.3 * 1e6` is `2299999.9999999995` in both
 * languages, and truncating that to 2299999 would quietly eat a gp.
 */

import { formatGp } from "./format";

export type GpBounds = {
  /** Inclusive lower bound. `null` = unbounded. GP fields default to 0. */
  min?: number | null;
  /** Inclusive upper bound. `null`/omitted is unbounded. */
  max?: number | null;
};

/** Decimal places each suffix shifts by. `kk` is the in-game "two k's" million. */
const SUFFIX_EXPONENT: Record<string, number> = { k: 3, kk: 6, m: 6, b: 9 };

/** `10 ** 15 - 1`, the backend's `MAX_BUYIN_AMOUNT` ceiling (`services/event_prizes.py`). */
export const MAX_GP = 999_999_999_999_999;

/**
 * Scale a decimal digit string by a power of ten, exactly, truncating toward
 * zero — the float-free half of the parse. `("2.3", 6) => 2300000`.
 */
function shiftDecimal(digits: string, exponent: number): number | null {
  const dot = digits.indexOf(".");
  const whole = dot === -1 ? digits : digits.slice(0, dot) + digits.slice(dot + 1);
  const shift = exponent - (dot === -1 ? 0 : digits.length - dot - 1);
  const scaled = shift >= 0 ? whole + "0".repeat(shift) : whole.slice(0, shift);
  const n = Number(scaled || "0");
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * `null` means "not something the field can commit yet" — empty, mid-edit junk
 * ("1.", "-", "5x"), or out of range. Callers keep the typed text on screen and
 * only fall back to the last good value when the field is left in that state.
 *
 * Fractions below the resolved unit truncate toward zero, so `"1.9999k"` is
 * 1999 gp rather than 2000: a GP field stores whole coins, and rounding up
 * would hand someone a value they did not type.
 */
export function parseGp(raw: string, { min = 0, max = null }: GpBounds = {}): number | null {
  const cleaned = raw
    .toLowerCase()
    .replace(/[\s,_]/g, "")
    .replace(/gp$/, "");
  if (!cleaned) return null;

  const match = /^(-?)(\d+\.?\d*|\.\d+)(kk|k|m|b)?$/.exec(cleaned);
  if (!match) return null;
  const [, sign = "", digits = "", suffix] = match;

  const scaled = shiftDecimal(digits, suffix ? (SUFFIX_EXPONENT[suffix] ?? 0) : 0);
  if (scaled == null) return null;

  const value = sign === "-" ? -scaled : scaled;
  if (min != null && value < min) return null;
  if (max != null && value > max) return null;
  return value;
}

/**
 * The compact form for a value already in the box — the reverse of `parseGp`,
 * used so a saved 2500000 reads back as "2.5m" instead of making the admin
 * count zeros to check it.
 *
 * Only ever returns shorthand that parses back to exactly this number, and
 * only above 10k: "2.5k" is no easier to read than "2500", and shortening
 * small values would make a field that mostly holds them look erratic.
 */
export function formatGpShorthand(value: number): string {
  if (!Number.isSafeInteger(value) || Math.abs(value) < 10_000) return String(value);
  for (const [suffix, unit] of [
    ["b", 1_000_000_000],
    ["m", 1_000_000],
    ["k", 1_000],
  ] as const) {
    if (Math.abs(value) < unit) continue;
    // Two decimals is where shorthand stops being shorter than the digits.
    const scaled = value / unit;
    const text = `${Number(scaled.toFixed(2))}${suffix}`;
    return parseGp(text, { min: null }) === value ? text : String(value);
  }
  return String(value);
}

/**
 * The resolved value spelled out under the field: grouped digits, plus the
 * abbreviation the site and Discord render elsewhere when it adds anything.
 * `1500000 => "1,500,000 gp (1.50M)"`.
 */
export function describeGp(value: number, unit = "gp"): string {
  const exact = value.toLocaleString();
  const abbreviated = formatGp(value);
  return abbreviated === exact ? `${exact} ${unit}` : `${exact} ${unit} (${abbreviated})`;
}
