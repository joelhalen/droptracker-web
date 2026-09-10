/**
 * Clan-point awards (web114a) — the public card: what an event offers in clan
 * points, and once paid, who got what. Shared by the event page and the
 * Discord Activity, so it holds no links, hooks or server actions — a native
 * <details> carries the "show everyone" expansion, which works in both.
 *
 * On an event that keeps EHE to its organisers the API already withholds
 * per-player participation (it is the hours with a multiplier on it); this
 * renders whatever it is given.
 */
import type {
  EventClanPoints,
  EventClanPointsRow,
  EventClanPointsScope,
} from "@droptracker/api-types";
import { Card } from "@/components/ui";
import { LocalTime } from "@/components/local-time";
import {
  isPublicScope,
  participationSummary,
  placeBadge,
  placementSummary,
} from "@/lib/clan-points";

const ROW_PREVIEW = 8;
const fmt = (n: number) => n.toLocaleString("en-US");

function RecipientRows({ rows }: { rows: EventClanPointsRow[] }) {
  return (
    <ul className="divide-osrs-bronze/15 divide-y text-sm">
      {rows.map((r, i) => (
        <li key={`${r.player_id ?? "h"}-${i}`} className="flex items-center justify-between gap-3 py-1.5">
          <span className="min-w-0 truncate">
            {r.place ? (
              <span className="mr-1.5" aria-label={`place ${r.place}`}>
                {placeBadge(r.place)}
              </span>
            ) : null}
            <span className="text-osrs-parchment">{r.player_name ?? "Unknown"}</span>
            {r.team_name && (
              <span className="text-osrs-parchment-dark/50 ml-1.5 text-xs">{r.team_name}</span>
            )}
          </span>
          <span className="text-osrs-gold-bright shrink-0 font-semibold tabular-nums">
            +{fmt(r.total)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ScopeBlock({
  scope,
  competition,
  eventStatus,
  showClan,
}: {
  scope: EventClanPointsScope;
  competition: boolean;
  eventStatus: string;
  showClan: boolean;
}) {
  const offerPlacement = placementSummary(scope.config);
  const offerParticipation = participationSummary(scope.config, { ehe: !competition });
  const awarded = scope.status === "awarded" ? scope.awarded : null;
  const clan = scope.group_name ?? "the clan";

  return (
    <Card className="space-y-3">
      {showClan && (
        <p className="text-osrs-parchment-dark/60 text-xs font-semibold uppercase tracking-wide">
          {clan}
        </p>
      )}
      {awarded ? (
        <>
          <div>
            <p className="text-osrs-gold-bright text-lg font-bold tabular-nums">
              {fmt(awarded.total_points)} clan points
            </p>
            <p className="text-osrs-parchment-dark/60 text-xs">
              paid to {fmt(awarded.players)} {awarded.players === 1 ? "member" : "members"} of{" "}
              {clan}
              {scope.awarded_at != null && (
                <>
                  {" · "}
                  <LocalTime unix={scope.awarded_at} mode="date" />
                </>
              )}
            </p>
          </div>
          {awarded.participation_points > 0 && (
            <p className="text-osrs-parchment-dark/80 text-sm">
              Participation: <span className="text-osrs-gold">+{fmt(awarded.participation_points)}</span>{" "}
              across {fmt(awarded.participation_players)}{" "}
              {awarded.participation_players === 1 ? "member" : "members"}
            </p>
          )}
          {awarded.rows.length > 0 && (
            <>
              <RecipientRows rows={awarded.rows.slice(0, ROW_PREVIEW)} />
              {awarded.rows.length > ROW_PREVIEW && (
                <details>
                  <summary className="text-osrs-gold-bright cursor-pointer text-xs hover:underline">
                    Show all {fmt(awarded.rows.length)}
                  </summary>
                  <RecipientRows rows={awarded.rows.slice(ROW_PREVIEW)} />
                </details>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <p className="text-osrs-parchment-dark/60 text-xs font-semibold uppercase tracking-wide">
            Up for grabs
          </p>
          {offerPlacement && (
            <div className="flex flex-wrap gap-1.5">
              {scope.config.placement.map((amount, i) =>
                amount > 0 ? (
                  <span
                    key={i}
                    className="bg-osrs-surface-2/70 rounded-full px-2.5 py-1 text-sm tabular-nums"
                  >
                    {placeBadge(i + 1)} <span className="text-osrs-gold-bright font-semibold">+{fmt(amount)}</span>
                    {competition ? "" : " each"}
                  </span>
                ) : null,
              )}
            </div>
          )}
          {offerParticipation && (
            <p className="text-osrs-parchment-dark/80 text-sm">
              Participation: <span className="text-osrs-gold">{offerParticipation}</span>
            </p>
          )}
          <p className="text-osrs-parchment-dark/50 text-xs">
            Paid in {clan}&apos;s clan points to members who take part
            {eventStatus === "past"
              ? " — the organisers are finalising the results."
              : scope.config.award_mode === "review"
                ? ", once the organisers confirm the results."
                : ", as soon as the event ends."}
          </p>
        </>
      )}
    </Card>
  );
}

/** Renders nothing when no clan offers or has paid anything. */
export function EventClanPointsCard({
  data,
  competition = false,
  heading = true,
}: {
  data: EventClanPoints | null | undefined;
  competition?: boolean;
  heading?: boolean;
}) {
  const scopes = (data?.scopes ?? []).filter(isPublicScope);
  if (!data || scopes.length === 0) return null;
  return (
    <div>
      {heading && (
        <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
          {"\u{1FA99}"} Clan points
        </h2>
      )}
      <div className="space-y-3">
        {scopes.map((scope) => (
          <ScopeBlock
            key={scope.group_id}
            scope={scope}
            competition={competition}
            eventStatus={data.status}
            showClan={scopes.length > 1}
          />
        ))}
      </div>
    </div>
  );
}
