/**
 * Small, presentational UI primitives shared across pages: cards, empty
 * states, loading skeletons, and inline alerts. Kept server-safe (no client
 * hooks) so they render in both Server and Client Components.
 */
import type { ReactNode } from "react";

/**
 * Standard resting-state panel (design system refresh). Wraps the `.card`
 * utility (globals.css) so call sites don't hand-roll
 * `border-osrs-bronze/20 rounded border p-4` — the pattern that had drifted
 * slightly differently across ~15 files before this existed.
 */
export function Card({
  children,
  className = "",
  padding = "p-5",
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  return <div className={`card ${padding} ${className}`}>{children}</div>;
}

/** A single stat tile — big number, small label. Used in stat-tile grids (hero, dashboards). */
export function StatTile({
  label,
  value,
  hint,
  className = "",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`bg-osrs-surface-2/70 rounded-lg px-4 py-3 ${className}`}>
      <div className="text-osrs-parchment-dark/60 text-xs tracking-wide uppercase">{label}</div>
      <div className="text-osrs-gold-bright mt-0.5 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="text-osrs-parchment-dark/50 mt-0.5 text-xs">{hint}</div>}
    </div>
  );
}

/** Friendly empty state for lists/sections that have no data yet. */
export function EmptyState({
  title,
  hint,
  icon = "◇",
  action,
  className = "",
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-osrs-bronze/20 text-osrs-parchment-dark/70 flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center text-sm ${className}`}
    >
      <span className="text-osrs-bronze text-2xl" aria-hidden>
        {icon}
      </span>
      <span className="text-osrs-parchment/90 font-medium">{title}</span>
      {hint && <span className="max-w-sm text-xs">{hint}</span>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** A single shimmer block. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-osrs-bronze/20 animate-pulse rounded ${className}`}
      aria-hidden
    />
  );
}

/** A stack of skeleton rows for list/table placeholders. */
export function SkeletonRows({ rows = 6, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

/** Inline alert used to surface action errors/notices near the control. */
export function Alert({
  children,
  variant = "error",
  className = "",
}: {
  children: ReactNode;
  variant?: "error" | "info" | "success";
  className?: string;
}) {
  const styles = {
    error: "border-osrs-red/40 bg-osrs-red/10 text-osrs-red",
    info: "border-osrs-bronze/40 bg-osrs-brown-dark/40 text-osrs-parchment-dark/80",
    success: "border-osrs-green/40 bg-osrs-green/10 text-osrs-green",
  }[variant];
  return (
    <p role={variant === "error" ? "alert" : "status"} className={`rounded border px-3 py-2 text-sm ${styles} ${className}`}>
      {children}
    </p>
  );
}
