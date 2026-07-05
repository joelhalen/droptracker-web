import type { CompactBadge, PlayerBadge } from "@droptracker/api-types";

import { formatDate, formatGp } from "@/lib/format";
import { Badge } from "@/components/ui";

/* -------------------------------------------------------------------------- */
/* Player badges: labelled pill chips beside names (leaderboards) and the     */
/* detailed list on player profiles. Definitions/awards come from the badge   */
/* system (web_api/routes/badges.py); tones map onto the shared Badge         */
/* component so chips look identical to the ones on /admin/badges.            */
/* -------------------------------------------------------------------------- */

function formatKillTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const tenths = Math.floor((ms % 1000) / 100);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}.${tenths}`;
}

function formatDayToken(day: string): string {
  // "20260704" -> local date string
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(4, 6));
  const d = Number(day.slice(6, 8));
  if (!y || !m || !d) return day;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Short award-specific detail shown in parentheses on chips — the thing that
 * distinguishes "Daily Loot Champion (Jul 3, 2026)" from another player's.
 * Unknown keys/contexts return null and the chip stays generic. */
export function badgeDetail(
  key: string,
  context: Record<string, unknown> | null | undefined,
): string | null {
  const ctx = context ?? {};
  if (key === "daily_loot_champion" && typeof ctx.day === "string") {
    return formatDayToken(ctx.day);
  }
  if (key.startsWith("loot_streak") && typeof ctx.days === "number") {
    return `${ctx.days} days`;
  }
  if (key === "boss_record" && typeof ctx.npc_name === "string") {
    return typeof ctx.team_size === "string" ? `${ctx.npc_name}, ${ctx.team_size}` : ctx.npc_name;
  }
  return null;
}

function ChipIcon({ badge }: { badge: { icon_url?: string | null; emoji?: string | null } }) {
  if (badge.icon_url) {
    return <img src={badge.icon_url} alt="" className="size-3.5 shrink-0 object-contain" />;
  }
  return <span aria-hidden>{badge.emoji ?? "★"}</span>;
}

/** Labelled badge chips for a leaderboard row, matching the /admin/badges
 * pill style: icon + name + award specifics, with a "+N" overflow chip. */
export function PlayerBadgeIcons({ badges, max = 3 }: { badges: CompactBadge[]; max?: number }) {
  if (!badges.length) return null;
  const shown = badges.slice(0, max);
  const overflow = badges.length - shown.length;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map((b, i) => {
        const detail = badgeDetail(b.key, b.context);
        const count = b.count && b.count > 1 ? b.count : null;
        const title =
          `${b.label}${detail ? ` (${detail})` : ""}` +
          (count ? ` — earned ${count} times, latest shown` : "");
        return (
          <Badge key={`${b.key}-${i}`} tone={b.tone} title={title}>
            <ChipIcon badge={b} />
            {b.label}
            {detail && <span className="font-normal opacity-80">({detail})</span>}
            {count && <span>×{count}</span>}
          </Badge>
        );
      })}
      {overflow > 0 && (
        <Badge tone="neutral" title={`${overflow} more badge${overflow === 1 ? "" : "s"}`}>
          +{overflow}
        </Badge>
      )}
    </span>
  );
}

/** Human context line derived from the badge key + award context. Unknown
 * keys simply render no context line. */
function contextLine(b: PlayerBadge): string | null {
  const ctx = (b.context ?? {}) as Record<string, unknown>;
  if (b.key === "daily_loot_champion" && typeof ctx.day === "string") {
    const loot = typeof ctx.loot === "number" ? ` · ${formatGp(ctx.loot)} GP` : "";
    return `Top looter on ${formatDayToken(ctx.day)}${loot}`;
  }
  if (b.key.startsWith("loot_streak") && typeof ctx.days === "number") {
    const ending = typeof ctx.day === "string" ? `, ending ${formatDayToken(ctx.day)}` : "";
    return `${ctx.days} days in a row${ending}`;
  }
  if (b.key === "boss_record" && typeof ctx.npc_name === "string") {
    const team = typeof ctx.team_size === "string" ? ` (${ctx.team_size})` : "";
    const time = typeof ctx.pb_ms === "number" ? ` · ${formatKillTime(ctx.pb_ms)}` : "";
    return `${ctx.npc_name}${team}${time}`;
  }
  if (typeof ctx.note === "string" && ctx.note) {
    return ctx.note;
  }
  return null;
}

/** Detailed badge rows for the player profile. Lost held badges render dimmed
 * as history ("Held until ..."). */
export function PlayerBadgeList({ badges }: { badges: PlayerBadge[] }) {
  if (!badges.length) return null;
  return (
    <ul className="space-y-3">
      {badges.map((b) => {
        const lost = b.status === "lost";
        const line = contextLine(b);
        const detail = badgeDetail(b.key, b.context as Record<string, unknown> | null);
        return (
          <li key={b.id} className={`flex items-start gap-3 ${lost ? "opacity-50" : ""}`}>
            {b.icon_url ? (
              <img src={b.icon_url} alt="" className="mt-0.5 size-7 shrink-0 object-contain" />
            ) : (
              <Badge tone={b.tone} className="mt-0.5 shrink-0 px-1.5 text-sm">
                <span aria-hidden>{b.icon_emoji ?? "★"}</span>
              </Badge>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-osrs-parchment font-semibold">
                  {b.name}
                  {detail && (
                    <span className="text-osrs-parchment-dark/80 font-normal"> ({detail})</span>
                  )}
                </span>
                {b.semantic === "held" && !lost && (
                  <Badge tone="ember" title="Currently held record">
                    Held
                  </Badge>
                )}
                {lost && (
                  <Badge tone="neutral" title="A new record holder has taken this badge">
                    Held until {formatDate(b.lost_at_ts ?? null)}
                  </Badge>
                )}
              </div>
              <p className="text-osrs-parchment-dark/70 text-sm">{b.description}</p>
              <p className="text-osrs-parchment-dark/50 text-xs">
                {line ? `${line} · ` : ""}
                Earned {formatDate(b.awarded_at_ts)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
