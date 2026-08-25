"use client";

/**
 * The editing behavior shared by the app's numeric entry fields —
 * `<QuantityInput>` (plain numbers) and `<GpInput>` (gp shorthand).
 *
 * What lives here is the part that is easy to get subtly wrong and expensive to
 * get wrong twice: the field holds TEXT while focused, so nothing snaps a
 * number back into the box mid-edit, and only commits values that parse. The
 * differences between the two fields — how a string becomes a number and how a
 * number is shown back — are the `parse`/`display` callbacks.
 *
 * `onChange` only ever fires with valid values, so callers keep plain numeric
 * state.
 */
import { useEffect, useRef, useState } from "react";

export type NumericFieldOptions = {
  value: number;
  onChange: (next: number) => void;
  /** Text → committable number, or `null` for empty/mid-edit/out-of-range. */
  parse: (raw: string) => number | null;
  /** Number → the text shown when the field is not being edited. */
  display: (value: number) => string;
  /** "Not set yet" sentinel: renders as an empty box, and clearing commits it
   * back instead of counting as invalid input. */
  emptyAs?: number;
  /** "change" (default) suits local state; "blur" is required when the handler
   * writes to the server — committing per keystroke means typing "500000"
   * saves 5, 50, 500, 5000, 50000 on the way, each a real write with no
   * guaranteed ordering. Shorthand makes this sharper still: every prefix of
   * "1.5m" is itself a valid, much smaller number. */
  commitOn?: "change" | "blur";
};

export type NumericField = {
  /** Current text. Bind straight to the input's `value`. */
  text: string;
  /** True for ~1.2s after input was rejected on blur — flash the border. */
  reverted: boolean;
  /** Live parse of `text`: what would be committed right now, or null. */
  parsed: number | null;
  /** Whether the box is currently empty (mid-edit or genuinely unset). */
  empty: boolean;
  onFocus: () => void;
  onTextChange: (raw: string) => void;
  onEnter: (event: { key: string; currentTarget: { blur: () => void } }) => void;
  onBlur: () => void;
};

export function useNumericField({
  value,
  onChange,
  parse,
  display,
  emptyAs,
  commitOn = "change",
}: NumericFieldOptions): NumericField {
  const show = (v: number) => (v === emptyAs ? "" : display(v));
  // Read through refs so the effect below can stay keyed on `value` alone;
  // both callbacks are redefined by the caller on every render.
  const latest = useRef({ show, parse, onChange });
  latest.current = { show, parse, onChange };

  const [text, setText] = useState(() => show(value));
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
    if (!focused) setText(latest.current.show(value));
  }, [value, focused]);
  useEffect(
    () => () => {
      if (revertTimer.current) clearTimeout(revertTimer.current);
    },
    [],
  );

  const flashReverted = () => {
    setReverted(true);
    if (revertTimer.current) clearTimeout(revertTimer.current);
    revertTimer.current = setTimeout(() => setReverted(false), 1200);
  };

  return {
    text,
    reverted,
    parsed: parse(text),
    empty: text.trim() === "",
    onFocus: () => setFocused(true),
    onTextChange: (raw) => {
      setText(raw);
      if (commitOn === "blur") return;
      const n = parse(raw);
      if (n != null && n !== value) onChange(n);
    },
    // Enter is how you say "done" without leaving the field; blur does the
    // actual commit so both routes share one code path.
    onEnter: (event) => {
      if (event.key === "Enter") event.currentTarget.blur();
    },
    onBlur: () => {
      setFocused(false);
      const n = parse(text);
      if (n != null) {
        // `display`, not `show`: a value typed out in full stays on screen as
        // typed, even when it happens to equal the "unset" sentinel.
        setText(display(n));
        if (n !== value) onChange(n);
      } else if (emptyAs != null && text.trim() === "") {
        // Cleared a field with an "unset" sentinel — back to unset.
        setText("");
        if (value !== emptyAs) onChange(emptyAs);
      } else {
        setText(show(value));
        flashReverted();
      }
    },
  };
}
