/**
 * A player's PvP record on their profile: this month and all time, their
 * latest kills and the players who killed them. Server-safe.
 *
 * The profile only renders it once there is something to show, so a player
 * who has never been in a PvP fight sees no empty PvP section.
 */
import type { PlayerPvp, PvpStatLine } from "@droptracker/api-types";
import { formatRelativeTime } from "@/lib/format";
import { Card, StatTile } from "@/components/ui";
import { PvpKillList } from "@/components/pvp-kill-list";

export function hasPvpHistory(pvp: PlayerPvp | null): pvp is PlayerPvp {
  return !!pvp && (pvp.all_time.kills > 0 || pvp.all_time.deaths > 0);
}

function kd(line: PvpStatLine): string {
  return line.kd == null ? "-" : line.kd.toFixed(2);
}

export function PlayerPvpCard({ pvp }: { pvp: PlayerPvp }) {
  const month = pvp.stats;
  const all = pvp.all_time;
  return (
    <section className="rise-in space-y-3">
      <h2 className="heading-rule text-osrs-gold pb-1 text-lg font-semibold">PvP</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Loot taken"
          value={month.loot.value_formatted}
          hint={`${all.loot.value_formatted} all time`}
        />
        <StatTile label="Kills" value={month.kills.toLocaleString()} hint={`${all.kills.toLocaleString()} all time`} />
        <StatTile label="Deaths" value={month.deaths.toLocaleString()} hint={`${all.deaths.toLocaleString()} all time`} />
        <StatTile
          label="K/D"
          value={kd(month)}
          hint={month.rank ? `#${month.rank.toLocaleString()} for PvP loot this month` : `${kd(all)} all time`}
        />
      </div>
      <div className="grid min-w-0 gap-6 md:grid-cols-2">
        <div className="min-w-0">
          <h3 className="text-osrs-parchment mb-2 text-sm font-semibold">Recent kills</h3>
          <Card padding="px-4 py-1">
            <PvpKillList
              kills={pvp.recent_kills}
              showKiller={false}
              emptyHint="No kills that counted yet."
            />
          </Card>
        </div>
        <div className="min-w-0">
          <h3 className="text-osrs-parchment mb-2 text-sm font-semibold">Killed by</h3>
          <Card padding="px-4 py-1">
            {pvp.recent_deaths.length ? (
              <ul className="divide-osrs-bronze/20 divide-y text-sm">
                {pvp.recent_deaths.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-osrs-parchment truncate font-medium">{d.killer ?? "Another player"}</div>
                      <div className="text-osrs-parchment-dark/60 truncate text-xs">
                        {formatRelativeTime(d.date)}
                        {d.location ? ` in ${d.location}` : ""}
                      </div>
                    </div>
                    {d.value_lost && (
                      <span className="text-osrs-parchment-dark/80 shrink-0 tabular-nums">
                        -{d.value_lost.value_formatted}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-osrs-parchment-dark/60 py-3 text-sm">No PvP deaths recorded.</p>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}
