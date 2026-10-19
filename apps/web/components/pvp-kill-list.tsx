/**
 * Recent PvP kills: who killed whom, what they took and when. Server-safe.
 *
 * Each row leads with the kill's most valuable item and lists a few more as
 * icons; the full loot is in the row's title tooltip so the list stays one
 * line per kill on a phone.
 */
import Link from "next/link";
import type { PvpKill } from "@droptracker/api-types";
import { entityPath } from "@/lib/slug";
import { formatRelativeTime, lootValueClass } from "@/lib/format";
import { EmptyState } from "@/components/ui";

const ICONS_SHOWN = 4;

export function PvpKillList({
  kills,
  emptyHint = "Kills show up here once a member running the plugin takes loot from another player.",
  showKiller = true,
}: {
  kills: PvpKill[];
  emptyHint?: string;
  /** False on a player's own page, where every kill is theirs. */
  showKiller?: boolean;
}) {
  if (!kills.length) {
    return <EmptyState title="No PvP kills yet" hint={emptyHint} icon="⚔" />;
  }
  return (
    <ul className="divide-osrs-bronze/20 divide-y">
      {kills.map((kill) => {
        const top = kill.items[0];
        const more = kill.items.slice(1, ICONS_SHOWN + 1);
        const tooltip = kill.items
          .map((i) => `${i.quantity > 1 ? `${i.quantity.toLocaleString()} x ` : ""}${i.name ?? `Item ${i.item_id}`} (${i.value.value_formatted})`)
          .join("\n");
        return (
          <li key={kill.id} className="flex items-center gap-3 py-2.5" title={tooltip}>
            <div
              className={`flex size-11 shrink-0 items-center justify-center rounded-lg border ${lootValueClass(kill.value.value)}`}
            >
              {top ? (
                <img src={top.icon_url} alt={top.name ?? ""} width={32} height={32} className="[image-rendering:pixelated]" />
              ) : (
                <span aria-hidden>⚔</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">
                {showKiller && (
                  <>
                    <Link
                      href={entityPath("players", kill.player.id, kill.player.name)}
                      className="text-osrs-parchment font-medium hover:text-osrs-gold-bright"
                    >
                      {kill.player.name}
                    </Link>{" "}
                    <span className="text-osrs-parchment-dark/70">killed</span>{" "}
                  </>
                )}
                {!showKiller && <span className="text-osrs-parchment-dark/70">Killed </span>}
                {kill.victim.id != null ? (
                  <Link
                    href={entityPath("players", kill.victim.id, kill.victim.name)}
                    className="text-osrs-parchment font-medium hover:text-osrs-gold-bright"
                  >
                    {kill.victim.name}
                  </Link>
                ) : (
                  <span className="text-osrs-parchment font-medium">{kill.victim.name}</span>
                )}
                {kill.victim.combat_level != null && (
                  <span className="text-osrs-parchment-dark/60"> (level {kill.victim.combat_level})</span>
                )}
              </div>
              <div className="text-osrs-parchment-dark/60 flex flex-wrap items-center gap-x-2 text-xs">
                <span>{formatRelativeTime(kill.date)}</span>
                {kill.wilderness_level != null && <span>Wilderness level {kill.wilderness_level}</span>}
                {kill.world != null && <span>World {kill.world}</span>}
                {more.length > 0 && (
                  <span className="flex items-center gap-0.5" aria-hidden>
                    {more.map((i) => (
                      <img key={i.item_id} src={i.icon_url} alt="" width={18} height={18} className="[image-rendering:pixelated]" />
                    ))}
                    {kill.items.length > ICONS_SHOWN + 1 && (
                      <span>+{kill.items.length - ICONS_SHOWN - 1}</span>
                    )}
                  </span>
                )}
              </div>
            </div>
            <div className="text-osrs-gold-bright shrink-0 text-right text-sm font-semibold tabular-nums">
              {kill.value.value_formatted}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
