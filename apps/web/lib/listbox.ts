/**
 * Step a combobox's active-row index by `delta` (+1 ArrowDown, -1 ArrowUp),
 * cycling through length+1 states: -1 means no row is highlighted (focus
 * stays on the input), 0..length-1 are the rows. Wraps at both ends.
 */
export function cycleActive(prev: number, delta: number, length: number): number {
  const states = length + 1;
  return ((prev + 1 + delta + states) % states) - 1;
}
