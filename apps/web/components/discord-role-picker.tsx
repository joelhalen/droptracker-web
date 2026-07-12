"use client";

/**
 * Toggle-chip Discord role picker (same visual language as the announcement
 * composer's ping picker). Purely presentational — the parent owns fetching
 * (group home guild via `fetchDiscordRoles`, or any event-targetable guild
 * via `listEventDiscordRoles`) and the selected-id state.
 */
import type { DiscordRole } from "@droptracker/api-types";

export function DiscordRolePicker({
  roles,
  selected,
  onToggle,
  emptyHint = "No roles found — the bot may still be syncing this server (try again shortly).",
}: {
  /** `null` while loading. */
  roles: DiscordRole[] | null;
  selected: string[];
  onToggle: (roleId: string) => void;
  emptyHint?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(roles ?? []).map((r) => {
        const on = selected.includes(r.id);
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onToggle(r.id)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              on
                ? "border-osrs-gold bg-osrs-gold/15 text-osrs-gold-bright"
                : "border-osrs-bronze/40 hover:border-osrs-gold"
            }`}
            aria-pressed={on}
          >
            @{r.name}
          </button>
        );
      })}
      {roles === null && <span className="text-osrs-parchment-dark/50 text-xs">Loading roles…</span>}
      {roles !== null && roles.length === 0 && (
        <span className="text-osrs-parchment-dark/50 text-xs">{emptyHint}</span>
      )}
    </div>
  );
}
