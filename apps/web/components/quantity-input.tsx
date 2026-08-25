"use client";

/**
 * The app's numeric entry field. Every `<input type="number">` bound to
 * numeric state should be one of these — see `lib/quantity.ts` for the bug
 * that motivates it.
 *
 * The editing behavior — text held while focused, invalid input reverting with
 * a red flash on blur, `commitOn` — lives in `lib/use-numeric-field.ts`, shared
 * with `<GpInput>`. What is specific to this field:
 *
 * - The spinner steps by whole numbers by default (the picker's point-weight
 *   field used to tick by 0.1). Pass `step` for coarser fields.
 * - `min`/`max` accept `null` for "unbounded", which is how fields that take a
 *   negative value (a ± points adjustment, a subtractive recipe component) opt
 *   out of the default `min={1}`.
 *
 * For a field holding an amount of gp, reach for `<GpInput>` instead — it takes
 * "1.5m" and shows the resolved number back.
 */
import { parseQuantity } from "@/lib/quantity";
import { useNumericField } from "@/lib/use-numeric-field";

export function QuantityInput({
  value,
  onChange,
  min = 1,
  max,
  step = 1,
  integer = true,
  emptyAs,
  commitOn = "change",
  className = "",
  ...rest
}: {
  value: number;
  onChange: (next: number) => void;
  /** Inclusive lower bound; `null` allows negatives. */
  min?: number | null;
  /** Inclusive upper bound; `null`/omitted is unbounded. */
  max?: number | null;
  /** Spinner increment. Whole numbers by default. */
  step?: number;
  /** false = decimals allowed (e.g. point-collection item weights). */
  integer?: boolean;
  /** "Not set yet" sentinel (usually 0 on a min-1 goal field): renders as an
   * empty box showing the placeholder, and clearing the box commits it back
   * instead of counting as invalid input. */
  emptyAs?: number;
  /** When does `onChange` fire? "change" (default) is right for local state;
   * "blur" is required when the handler writes to the server — see above. */
  commitOn?: "change" | "blur";
  className?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "min" | "max" | "type" | "step"
>) {
  const field = useNumericField({
    value,
    onChange,
    parse: (raw) => parseQuantity(raw, { min, max, integer }),
    display: String,
    emptyAs,
    commitOn,
  });

  return (
    <input
      {...rest}
      type="number"
      step={step}
      min={min ?? undefined}
      max={max ?? undefined}
      value={field.text}
      aria-invalid={field.reverted || undefined}
      className={`${className} ${field.reverted ? "border-osrs-red ring-1 ring-osrs-red" : ""}`}
      onFocus={(e) => {
        field.onFocus();
        rest.onFocus?.(e);
      }}
      onChange={(e) => field.onTextChange(e.target.value)}
      onKeyDown={(e) => {
        field.onEnter(e);
        rest.onKeyDown?.(e);
      }}
      onBlur={(e) => {
        field.onBlur();
        rest.onBlur?.(e);
      }}
    />
  );
}
