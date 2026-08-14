import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compose class names with clsx (conditionals/arrays) then resolve Tailwind
 * conflicts with tailwind-merge, so a caller's `className` reliably overrides a
 * primitive's defaults for standard utilities (spacing, radius, sizing, font…).
 *
 * Note: tailwind-merge doesn't know our custom `osrs-*` color scale, so two
 * conflicting `bg-osrs-*` classes won't be deduped — pick the right variant
 * rather than overriding a variant's fill via className.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
