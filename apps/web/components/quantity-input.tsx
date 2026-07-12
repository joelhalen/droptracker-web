"use client";

/**
 * Numeric field for the task builders. Two deliberate behaviors:
 *
 * - The spinner always steps by whole numbers (the picker's point-weight
 *   field used to tick by 0.1).
 * - The user can clear and retype freely — nothing snaps a 0/1 back into the
 *   box mid-edit. Invalid input (empty, non-numeric, out of range) reverts to
 *   the last good value on blur, with a brief red flash to say it didn't take.
 *
 * `onChange` only ever fires with valid values, so callers can keep plain
 * numeric state.
 */
import { useEffect, useRef, useState } from "react";

export function QuantityInput({
  value,
  onChange,
  min = 1,
  max,
  integer = true,
  emptyAs,
  className = "",
  ...rest
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** false = decimals allowed (e.g. point-collection item weights). */
  integer?: boolean;
  /** "Not set yet" sentinel (usually 0 on a min-1 goal field): renders as an
   * empty box showing the placeholder, and clearing the box commits it back
   * instead of counting as invalid input. */
  emptyAs?: number;
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

  // Follow outside changes while not editing.
  useEffect(() => {
    if (!focused) setText(display(value));
  }, [value, focused, emptyAs]);
  useEffect(
    () => () => {
      if (revertTimer.current) clearTimeout(revertTimer.current);
    },
    [],
  );

  const parse = (raw: string): number | null => {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n)) return null;
    if (integer && !Number.isInteger(n)) return null;
    if (n < min || (max != null && n > max)) return null;
    return n;
  };

  return (
    <input
      {...rest}
      type="number"
      step={1}
      min={min}
      max={max}
      value={text}
      aria-invalid={reverted || undefined}
      className={`${className} ${reverted ? "border-osrs-red ring-1 ring-osrs-red" : ""}`}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = parse(e.target.value);
        if (n != null && n !== value) onChange(n);
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
