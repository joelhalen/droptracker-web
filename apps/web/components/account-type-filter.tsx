import type { Route } from "next";
import Link from "next/link";
import { ACCOUNT_TYPE_FILTERS, type AccountTypeFilter } from "@/lib/account-types";

/**
 * "All players · Regular · All irons · Ironman · …" pill row for player
 * boards. Not a client component, so it renders either way: a server page
 * passes `hrefFor` (each pill is a link, the URL holds the choice), a client
 * board passes `onSelect` (buttons, no navigation).
 *
 * `null` is "All players", always first and the default.
 */
export function AccountTypeFilterBar({
  active,
  hrefFor,
  onSelect,
  options = ACCOUNT_TYPE_FILTERS,
  size = "md",
  className = "",
}: {
  active: string | null;
  hrefFor?: (key: string | null) => string;
  onSelect?: (key: string | null) => void;
  /** Subset to offer, e.g. only the modes present in a loaded roster. */
  options?: readonly AccountTypeFilter[];
  size?: "sm" | "md";
  className?: string;
}) {
  const items: Array<{ key: string | null; label: string; icon?: string }> = [
    { key: null, label: "All players" },
    ...options,
  ];
  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  return (
    <div role="group" aria-label="Account type" className={`flex flex-wrap items-center gap-1 ${className}`}>
      {items.map((it) => {
        const on = it.key === active;
        const cls = `inline-flex items-center gap-1.5 rounded ${pad} transition-colors ${
          on
            ? "bg-osrs-bronze text-osrs-parchment"
            : "text-osrs-parchment-dark/80 hover:text-osrs-gold-bright"
        }`;
        const body = (
          <>
            {it.icon && (
              <img
                src={it.icon}
                alt=""
                aria-hidden
                className="h-3.5 w-auto shrink-0 [image-rendering:pixelated]"
              />
            )}
            {it.label}
          </>
        );
        return hrefFor ? (
          <Link
            key={it.key ?? "all"}
            href={hrefFor(it.key) as Route}
            aria-current={on ? "true" : undefined}
            className={cls}
            scroll={false}
          >
            {body}
          </Link>
        ) : (
          <button
            key={it.key ?? "all"}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect?.(it.key)}
            className={cls}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
