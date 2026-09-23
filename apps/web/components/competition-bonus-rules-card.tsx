/** "How points work" card for a SOTW/BOTW event page (web105a): the ranking
 * rule in one line, then every bonus rule exactly as Discord words it —
 * scoring must never be a surprise. Server component (pure props). */

import type { EventCompetitionBoard } from "@droptracker/api-types";
import {
  bonusRuleIcon,
  bonusRuleSentence,
  isTeamRace,
  metricSummary,
  rateSentence,
} from "@/lib/competition";

export function CompetitionBonusRulesCard({
  board,
  openLink,
  wide = false,
}: {
  board: EventCompetitionBoard;
  /** Site event page: the card spans a wide column, so the rules flow in
   * two columns instead of one tall list. */
  wide?: boolean;
  /** Discord Activity: opens WiseOldMan through the SDK (a `target="_blank"`
   * link does nothing inside the iframe). Site: unset. */
  openLink?: (url: string) => void;
}) {
  const { competition, totals } = board;
  const metricKind = competition.metric.kind;
  const summary = metricSummary(competition);
  const pointsMode = competition.ranking.mode === "points";
  const teams = isTeamRace(competition);
  const unit = metricKind === "skill" ? "XP" : "KC";

  return (
    <div className="border-osrs-bronze/30 bg-osrs-brown-dark/30 space-y-2.5 rounded border p-3 text-sm">
      <h3 className="text-osrs-gold font-semibold">How the race is scored</h3>
      {summary && <p className="text-osrs-parchment">{summary}</p>}
      {teams && (
        <p className="text-osrs-parchment-dark/70 text-xs">
          {competition.team_scoring === "average"
            ? `A team scores its members' total divided by everyone who has been on the team.`
            : `A team scores everything its members gain.`}{" "}
          Players still rank individually below the teams.
        </p>
      )}
      <p className="text-osrs-parchment-dark/70 text-xs">
        {pointsMode
          ? `${rateSentence(competition.ranking.gained_per_point, metricKind)}; bonus points stack on top for one combined ranking.`
          : `Ranked by raw ${unit} gained${
              competition.bonus_rules.length
                ? ". Bonus points show in their own column and never change the order."
                : "."
            }`}
      </p>
      {competition.bonus_rules.length > 0 && (
        <ul className={wide ? "grid gap-x-6 gap-y-1.5 sm:grid-cols-2" : "space-y-1.5"}>
          {competition.bonus_rules.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-xs">
              <span aria-hidden className="mt-px">
                {bonusRuleIcon(r.type)}
              </span>
              <span className="text-osrs-parchment-dark/85">
                {bonusRuleSentence(r)}
                {/* What "the listed drops" actually are. A player shouldn't
                    have to guess what they're racing for. */}
                {r.items_preview?.length ? (
                  <span className="text-osrs-parchment-dark/55 block">
                    {r.items_preview.join(", ")}
                    {r.item_count && r.item_count > r.items_preview.length
                      ? ` (+${r.item_count - r.items_preview.length} more)`
                      : ""}
                  </span>
                ) : null}
                {r.task_kind === "ca_target" && r.item_count ? (
                  <span className="text-osrs-parchment-dark/55 block">
                    {r.item_count} qualifying achievement{r.item_count === 1 ? "" : "s"}
                    {r.tiers?.length ? ` · ${r.tiers.join(", ")} tier` : ""}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      {competition.bonus_rules.length > 0 && totals.bonus_points > 0 && (
        <p className="text-osrs-parchment-dark/50 text-xs">
          {totals.bonus_points.toLocaleString("en-US")} bonus points awarded so far.
        </p>
      )}
      {competition.wom && (
        <p className="text-osrs-parchment-dark/50 text-xs">
          {competition.source_mode === "created" ? "Also live on " : "Mirrors "}
          {openLink ? (
            <button
              type="button"
              onClick={() => openLink(competition.wom!.url)}
              className="text-osrs-gold-bright hover:underline"
            >
              WiseOldMan ↗
            </button>
          ) : (
            <a
              href={competition.wom.url}
              target="_blank"
              rel="noreferrer"
              className="text-osrs-gold-bright hover:underline"
            >
              WiseOldMan ↗
            </a>
          )}
          {competition.wom.sync_error
            ? `. Sync problem: ${competition.wom.sync_error}`
            : competition.wom.synced_at
              ? `. Synced ${new Date(competition.wom.synced_at * 1000).toLocaleTimeString()}`
              : ""}
        </p>
      )}
    </div>
  );
}
