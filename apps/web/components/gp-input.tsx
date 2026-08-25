"use client";

/**
 * The app's gp entry field. Anywhere a user types an amount of coins — a buy-in,
 * a donation, a notification threshold, a loot goal — should be one of these
 * rather than a bare `<input type="number">`.
 *
 * It accepts what players already type in game and in the Discord onboarding
 * modal ("1.5m", "100k", "2.5b", "50kk", "1,500,000") and, because a typed
 * shorthand is only useful if you can see what it became, spells the resolved
 * amount out underneath: `1,500,000 gp (1.50M)`. That line is the point of the
 * component — the failure it prevents is a threshold set to 25000000 when 250m
 * was meant, which no amount of squinting at a row of zeros reliably catches.
 *
 * The box is `type="text"`, not `type="number"`: browsers hand you an empty
 * string for "1.5m" in a number input, which would make the shorthand
 * unenterable. So there is no spinner — `<QuantityInput>` remains the right
 * field for counts, levels and points.
 *
 * `commitOn="blur"` is strongly preferred here and required when `onChange`
 * writes to the server: every prefix of "1.5m" — "1", "1.5" — parses as a
 * valid, far smaller amount, so committing per keystroke briefly makes 1 gp
 * the value of record.
 */
import { describeGp, formatGpShorthand, MAX_GP, parseGp } from "@/lib/gp";
import { useNumericField } from "@/lib/use-numeric-field";

export function GpInput({
  value,
  onChange,
  min = 0,
  max = MAX_GP,
  emptyAs,
  commitOn = "change",
  unit = "gp",
  hint,
  className = "",
  wrapperClassName = "",
  ...rest
}: {
  value: number;
  onChange: (next: number) => void;
  /** Inclusive lower bound; `null` allows negatives (a subtractive bonus). */
  min?: number | null;
  /** Inclusive upper bound. Defaults to the backend's ledger ceiling. */
  max?: number | null;
  /** "Not set yet" sentinel (usually 0): renders as an empty box showing the
   * placeholder, and clearing the box commits it back rather than reverting. */
  emptyAs?: number;
  /** "change" (default) suits local state; "blur" is required when the handler
   * writes to the server — see above. */
  commitOn?: "change" | "blur";
  /** Noun in the resolved-value line, for the fields holding xp rather than gp. */
  unit?: string;
  /** Replaces the resolved-value line while the box is empty — say what
   * leaving it blank will do ("Uses the GE price"). */
  hint?: string;
  className?: string;
  /** Layout classes for the box + preview wrapper (the control itself takes
   * `className`), for call sites that place the field in a flex row or grid. */
  wrapperClassName?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "min" | "max" | "type" | "step"
>) {
  const field = useNumericField({
    value,
    onChange,
    parse: (raw) => parseGp(raw, { min, max }),
    display: formatGpShorthand,
    emptyAs,
    commitOn,
  });

  // Three states, one line, so the field never changes height as you type.
  const preview = field.empty
    ? (hint ?? "")
    : field.parsed != null
      ? describeGp(field.parsed, unit)
      : `Try 1.5m, 100k or 2.5b`;

  return (
    <div className={`min-w-0 ${wrapperClassName}`}>
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
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
      <p
        aria-live="polite"
        className={`mt-1 min-h-4 text-xs tabular-nums ${
          field.empty || field.parsed != null
            ? "text-osrs-parchment-dark/60"
            : "text-osrs-red"
        }`}
      >
        {preview}
      </p>
    </div>
  );
}
