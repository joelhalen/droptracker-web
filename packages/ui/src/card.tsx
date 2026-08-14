/**
 * Card primitive. Wraps the `.card` surface utility (theme.css) so call sites
 * stop hand-rolling `border-osrs-bronze/20 rounded border p-4`.
 *
 * Backward compatible: `<Card padding className id>` renders exactly as before.
 * New, opt-in capability absorbs the shapes that were hand-rolled elsewhere:
 *   - `elevated`     → floating `.card-pop` surface (modals, popovers)
 *   - `interactive`  → hover accent + transition (clickable cards)
 *   - `as` / rest    → render as a `<button>`, `<Link>`, `<a>` … (polymorphic)
 *   - `header`/`footer`/`divided` → bordered sections around the body
 *
 * Server-safe (no hooks). Framework-agnostic: pass `as={Link}` for Next.
 */
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "./cn";

type CardOwnProps<E extends ElementType> = {
  as?: E;
  /** Body padding utility (default `p-5`). Applied to the body section. */
  padding?: string;
  /** Use the floating `.card-pop` surface instead of the resting `.card`. */
  elevated?: boolean;
  /** Hover accent + transition; pair with `as="button"`/`as={Link}`. */
  interactive?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  /** Divide direct body children with hairlines (list cards). */
  divided?: boolean;
  className?: string;
  children?: ReactNode;
};

export type CardProps<E extends ElementType = "div"> = CardOwnProps<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof CardOwnProps<E>>;

export function Card<E extends ElementType = "div">({
  as,
  padding = "p-5",
  elevated = false,
  interactive = false,
  header,
  footer,
  divided = false,
  className,
  children,
  ...rest
}: CardProps<E>) {
  const Comp: ElementType = as ?? "div";
  const surface = elevated ? "card-pop" : "card";
  const interactiveCls = interactive
    ? "hover:border-osrs-gold/50 cursor-pointer text-left transition-colors"
    : undefined;

  // Simple mode: no sections — identical to the original Card.
  if (!header && !footer && !divided) {
    return (
      <Comp className={cn(surface, padding, interactiveCls, className)} {...rest}>
        {children}
      </Comp>
    );
  }

  // Structured mode: bordered header/footer around a padded (optionally
  // divided) body. `overflow-hidden` keeps section edges inside the radius.
  return (
    <Comp className={cn(surface, "overflow-hidden", interactiveCls, className)} {...rest}>
      {header && (
        <div className="border-osrs-bronze/20 border-b px-4 py-3">{header}</div>
      )}
      <div className={cn(padding, divided && "divide-osrs-bronze/20 divide-y")}>{children}</div>
      {footer && (
        <div className="border-osrs-bronze/20 border-t px-4 py-3">{footer}</div>
      )}
    </Comp>
  );
}
