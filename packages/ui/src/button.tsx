/**
 * Button primitive — the design system's answer to the ~500 hand-styled raw
 * `<button>` elements (the gold-primary style alone was duplicated ~108×).
 *
 * Server-safe (no hooks): renders fine in Server Components; an `onClick`
 * simply requires the *parent* to be a Client Component, as with any button.
 *
 * `buttonVariants()` is exported separately so a link styled as a button
 * (e.g. the Discord sign-in `<Link>`, hero CTAs) can reuse the exact classes:
 *   <Link className={buttonVariants({ variant: "primary", size: "lg" })} />
 */
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "success"
  | "gold-subtle"
  | "link";

export type ButtonSize = "lg" | "md" | "sm" | "xs" | "icon";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-osrs-gold/40";

const VARIANTS: Record<ButtonVariant, string> = {
  // Solid gold CTA — the dominant primary. Dark text at rest for legibility.
  primary: "bg-osrs-gold text-osrs-brown-dark font-semibold hover:bg-osrs-gold-bright",
  // Bronze that warms to gold on hover — the form-submit / sign-in CTA.
  secondary:
    "bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark",
  // Bordered, transparent — cancel / secondary actions.
  ghost: "border border-osrs-bronze/50 text-osrs-parchment hover:bg-osrs-bronze/30",
  // Solid red — destructive confirms.
  danger: "bg-osrs-red text-osrs-parchment hover:bg-osrs-red/80",
  // Subtle green — low-emphasis affirmative (start/enable).
  success: "bg-osrs-green/20 text-osrs-green hover:bg-osrs-green/30",
  // Tinted gold — low-emphasis affirmative alternative.
  "gold-subtle": "bg-osrs-gold/20 text-osrs-gold hover:bg-osrs-gold/30",
  // Text-only — inline cancel / preview / close.
  link: "text-osrs-parchment-dark/70 hover:text-osrs-gold-bright",
};

const SIZES: Record<ButtonSize, string> = {
  lg: "px-5 py-2.5 text-sm",
  md: "px-4 py-2 text-sm",
  sm: "px-3 py-1.5 text-sm",
  xs: "px-2.5 py-1 text-xs",
  icon: "p-1.5",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Show a busy state and disable the button. Pair with `loadingLabel`. */
  loading?: boolean;
  /** Label shown while `loading` (defaults to "…"). Ignored for icon size. */
  loadingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    loadingLabel = "…",
    className,
    disabled,
    children,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonVariants({ variant, size, className })}
      {...props}
    >
      {loading && size !== "icon" ? loadingLabel : children}
    </button>
  );
});
