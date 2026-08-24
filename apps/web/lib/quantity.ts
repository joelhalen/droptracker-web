/**
 * Parsing rules for the app's numeric entry fields (`<QuantityInput>`).
 *
 * Lives here rather than inside the component so the contract these fields
 * exist to guarantee — **an empty box parses as "no value", never as 0** — is
 * unit-testable; there is no DOM test harness in this repo.
 *
 * The bug this guards against is the naive handler:
 *
 *     onChange={(e) => setQty(Number(e.target.value))}      // Number("") === 0
 *     onChange={(e) => setQty(parseInt(e.target.value) || 1)}
 *
 * Both make the field impossible to clear: the moment the last digit is
 * deleted the state snaps to 0 (or the `||` fallback) and React re-renders that
 * number straight back into the box, so a user editing "10" → "250" has to type
 * around a stray leading digit.
 */

export type QuantityBounds = {
  /** Lower bound, inclusive. `null` = unbounded (fields that accept negatives). */
  min?: number | null;
  /** Upper bound, inclusive. `null` = unbounded. */
  max?: number | null;
  /** false = decimals allowed (e.g. point-collection item weights). */
  integer?: boolean;
};

/**
 * `null` means "not something the field can commit yet" — empty, mid-edit
 * junk ("-", "1e"), a decimal in an integer field, or out of range. Callers
 * keep the typed text on screen and only fall back to the last good value when
 * the field is left in that state.
 */
export function parseQuantity(
  raw: string,
  { min = 1, max = null, integer = true }: QuantityBounds = {},
): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  if (integer && !Number.isInteger(n)) return null;
  if (min != null && n < min) return null;
  if (max != null && n > max) return null;
  return n;
}
