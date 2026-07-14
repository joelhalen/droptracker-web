/** Money helpers — API GP fields are `{value, value_formatted}` objects
 * (sometimes optional); these flatten either shape for math and display. */
import type { Money } from "@droptracker/api-types";
import { formatGp } from "@/lib/format";

export function gpAmount(m: Money | number | null | undefined): number {
  if (m == null) return 0;
  return typeof m === "number" ? m : m.value;
}

export function gpText(m: Money | number | null | undefined): string {
  if (m == null) return "0";
  return typeof m === "number" ? formatGp(m) : m.value_formatted;
}
