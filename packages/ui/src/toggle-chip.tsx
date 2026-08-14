/**
 * ToggleChip — the selectable "pill" (rounded-full) and "tab" (rounded)
 * controls used for filters and segmented pickers. Distinct from Button: it
 * carries a selected state via `aria-pressed` and a gold-active treatment.
 *
 * Server-safe (no hooks). Render a row of these for a segmented control.
 */
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ToggleChipShape = "pill" | "tab";

const SHAPE: Record<ToggleChipShape, string> = {
  pill: "rounded-full px-2.5 py-1 text-xs",
  tab: "rounded px-3 py-1.5 text-sm",
};

export interface ToggleChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  shape?: ToggleChipShape;
}

export const ToggleChip = forwardRef<HTMLButtonElement, ToggleChipProps>(function ToggleChip(
  { active = false, shape = "pill", className, type = "button", children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={active}
      className={cn(
        "cursor-pointer border transition-colors",
        SHAPE[shape],
        active
          ? "border-osrs-gold bg-osrs-gold/15 text-osrs-gold-bright"
          : "border-osrs-bronze/40 text-osrs-parchment hover:border-osrs-gold/50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
