"use client";

import { useEffect, useState } from "react";

/**
 * The value, updated only after it has stopped changing for `ms` (trailing-edge
 * debounce). For search inputs: keep the raw value bound to the `<input>` for a
 * responsive field, and drive the network query / expensive filter off the
 * debounced copy so a burst of keystrokes costs one update, not one per key.
 */
export function useDebouncedValue<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
