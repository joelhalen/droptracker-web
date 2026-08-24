"use client";

/**
 * The app's numeric entry field. Every `<input type="number">` bound to
 * numeric state should be one of these — see `lib/quantity.ts` for the bug
 * that motivates it.
 *
 * Three deliberate behaviors:
 *
 * - The user can clear and retype freely — the box holds text while focused,
 *   so nothing snaps a 0/1 back into it mid-edit. Invalid input (empty,
 *   non-numeric, out of range) reverts to the last good value on blur, with a
 *   brief red flash to say it didn't take.
 * - The spinner steps by whole numbers by default (the picker's point-weight
 *   field used to tick by 0.1). Pass `step` for coarser fields.
 * - `min`/`max` accept `null` for "unbounded", which is how fields that take a
 *   negative value (a ± points adjustment, a subtractive recipe component) opt
 *   out of the default `min={1}`.
 *
 * `onChange` only ever fires with valid values, so callers can keep plain
 * numeric state.
 *
 * `commitOn="blur"` is for fields whose onChange PERSISTS (a server write, not
 * local state). Committing per keystroke means typing "500000" saves 5, 50,
 * 500, 5000, 50000 on the way — each a real write, each briefly the value of
 * record, with no guaranteed ordering between the in-flight requests.
 */
import { useEffect, useRef, useState } from "react";
import { parseQuantity } from "@/lib/quantity";

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
  const display = (v: number) => (v === emptyAs ? "" : String(v));
  const [text, setText] = useState(display(value));
  const [focused, setFocused] = useState(false);
  const [reverted, setReverted] = useState(false);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow outside changes (a server echo, an SSE update) while not editing.
  // Keyed on `value` actually changing, NOT on the focus→blur transition: a
  // `commitOn="blur"` field commits to an async server write, so re-syncing on
  // blur would repaint the old number over the one just typed for as long as
  // the request is in flight. `onBlur` already sets the text itself.
  const seen = useRef(value);
  useEffect(() => {
    if (value === seen.current) return;
    seen.current = value;
    if (!focused) setText(display(value));
  }, [value, focused, emptyAs]);
  useEffect(
    () => () => {
      if (revertTimer.current) clearTimeout(revertTimer.current);
    },
    [],
  );

  const parse = (raw: string) => parseQuantity(raw, { min, max, integer });

  return (
    <input
      {...rest}
      type="number"
      step={step}
      min={min ?? undefined}
      max={max ?? undefined}
      value={text}
      aria-invalid={reverted || undefined}
      className={`${className} ${reverted ? "border-osrs-red ring-1 ring-osrs-red" : ""}`}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onChange={(e) => {
        setText(e.target.value);
        if (commitOn === "blur") return;
        const n = parse(e.target.value);
        if (n != null && n !== value) onChange(n);
      }}
      onKeyDown={(e) => {
        // Enter is how you say "done" without leaving the field; blur does
        // the actual commit so both routes share one code path.
        if (e.key === "Enter") e.currentTarget.blur();
        rest.onKeyDown?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        const n = parse(text);
        if (n == null) {
          if (emptyAs != null && text.trim() === "") {
            // Cleared a field with an "unset" sentinel — back to unset.
            setText("");
            if (value !== emptyAs) onChange(emptyAs);
          } else {
            setText(display(value));
            setReverted(true);
            if (revertTimer.current) clearTimeout(revertTimer.current);
            revertTimer.current = setTimeout(() => setReverted(false), 1200);
          }
        } else {
          setText(String(n));
          if (n !== value) onChange(n);
        }
        rest.onBlur?.(e);
      }}
    />
  );
}
