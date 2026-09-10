"use client";

/**
 * Clan Points tab (web114a): what this event pays THIS clan's members in clan
 * points — placement (1st/2nd/3rd… per member) and participation priced from
 * EHE — plus the live preview of who that is right now and the award / re-sync
 * / revoke controls once the event is over.
 *
 * Scoped to the group the manager page is open under: on a clan-vs-clan event
 * each clan configures its own payout in its own points economy. The Web API
 * owns every rule (who's paid, ties, the EHE pricing guard); this tab edits the
 * config and renders the server's preview verbatim.
 */
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  EVENT_CLAN_POINTS_LIMITS,
  EventClanPointsConfigSchema,
  type EventClanPoints,
  type EventClanPointsConfig,
  type EventClanPointsRow,
  type EventDetail,
} from "@droptracker/api-types";
import { Alert, Button, Card, Checkbox, EmptyState, StatTile } from "@/components/ui";
import { QuantityInput } from "@/components/quantity-input";
import { LocalTime } from "@/components/local-time";
import {
  awardEventClanPoints,
  fetchEventClanPoints,
  revokeEventClanPoints,
  saveEventClanPoints,
} from "@/app/(site)/(admin)/groups/[id]/events/clan-points-actions";
import { isCompetitionKind } from "@/lib/competition";
import { ordinal, placeBadge, statusText, trimPlacement } from "@/lib/clan-points";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-2 text-sm outline-none";
const fmt = (n: number) => n.toLocaleString("en-US");
const ROW_PREVIEW = 25;

const SKIP_REASON: Record<string, string> = {
  not_member: "not a member of this clan",
  inactive: "on a placing team but took no part",
};

function PreviewTable({
  rows,
  showHours,
}: {
  rows: EventClanPointsRow[];
  showHours: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-osrs-bronze/25 text-osrs-parchment-dark/60 border-b text-left text-xs uppercase">
            <th className="px-3 py-2">Player</th>
            <th className="px-3 py-2">Team</th>
            <th className="px-3 py-2 text-right">Placement</th>
            {showHours && <th className="px-3 py-2 text-right">EHE</th>}
            <th className="px-3 py-2 text-right">Participation</th>
            <th className="px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.player_id ?? r.player_name} className="border-osrs-bronze/15 border-b last:border-0">
              <td className="px-3 py-1.5">{r.player_name}</td>
              <td className="text-osrs-parchment-dark/70 px-3 py-1.5">{r.team_name ?? "—"}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {r.placement ? (
                  <>
                    {r.place ? <span className="mr-1">{placeBadge(r.place)}</span> : null}+{fmt(r.placement)}
                  </>
                ) : (
                  "—"
                )}
              </td>
              {showHours && (
                <td className="text-osrs-parchment-dark/70 px-3 py-1.5 text-right tabular-nums">
                  {r.hours != null ? `${r.hours}h` : "—"}
                </td>
              )}
              <td className="px-3 py-1.5 text-right tabular-nums">
                {r.participation ? `+${fmt(r.participation)}` : "—"}
              </td>
              <td className="text-osrs-gold-bright px-3 py-1.5 text-right font-semibold tabular-nums">
                +{fmt(r.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EventClanPointsManager({
  groupId,
  event,
}: {
  groupId: number;
  event: EventDetail;
}) {
  const [data, setData] = useState<EventClanPoints | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<EventClanPointsConfig>(() =>
    EventClanPointsConfigSchema.parse({}),
  );
  const [showAll, setShowAll] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const competition = isCompetitionKind(event.kind);
  const scope = data?.scopes.find((s) => s.group_id === groupId) ?? null;
  const preview = scope?.preview;

  const adopt = useCallback((next: EventClanPoints) => {
    setData(next);
    const own = next.scopes.find((s) => s.group_id === groupId);
    if (own) setDraft(own.config);
  }, [groupId]);

  // Reload on mount and whenever the event's lifecycle moves (an end makes
  // the payout awardable, and an auto award lands then).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchEventClanPoints(groupId, event.id);
      if (cancelled) return;
      if (res.ok) {
        adopt(res.data);
        setLoadError(null);
      } else {
        setLoadError(res.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, event.id, event.status, adopt]);

  const saved = scope?.config ?? null;
  const dirty = useMemo(
    () => saved == null || JSON.stringify(saved) !== JSON.stringify({ ...draft, placement: trimPlacement(draft.placement) }),
    [saved, draft],
  );

  const setPart = (key: keyof EventClanPointsConfig["participation"], value: number) =>
    setDraft((d) => ({ ...d, participation: { ...d.participation, [key]: value } }));
  const setPlace = (idx: number, value: number) =>
    setDraft((d) => {
      const placement = [...d.placement];
      placement[idx] = value;
      return { ...d, placement };
    });

  const run = (fn: () => Promise<{ ok: true; data: EventClanPoints } | { ok: false; message: string }>, done?: (d: EventClanPoints) => string | null) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.message);
        return;
      }
      adopt(res.data);
      setNotice(done ? done(res.data) : null);
    });
  };

  const onSave = () =>
    run(
      () =>
        saveEventClanPoints(groupId, event.id, {
          ...draft,
          placement: trimPlacement(draft.placement),
        }),
      () => "Saved.",
    );

  const onAward = () =>
    run(
      () => awardEventClanPoints(groupId, event.id),
      (d) => {
        const s = d.summary ?? {};
        const num = (k: string) => Number((s as Record<string, unknown>)[k] ?? 0);
        const changed = num("inserted") + num("updated") + num("removed");
        return changed
          ? `Done — ${fmt(num("total_points"))} points across ${fmt(num("players"))} members (${num("inserted")} new, ${num("updated")} changed, ${num("removed")} removed).`
          : "Already up to date — nothing changed.";
      },
    );

  const onRevoke = () => {
    setConfirmRevoke(false);
    run(
      () => revokeEventClanPoints(groupId, event.id),
      (d) => {
        const s = (d.summary ?? {}) as Record<string, unknown>;
        return `Revoked ${fmt(Number(s.removed_points ?? 0))} points.`;
      },
    );
  };

  if (loadError) return <Alert variant="error">{loadError}</Alert>;
  if (!data) return <p className="text-osrs-parchment-dark/60 text-sm">Loading clan points…</p>;
  if (!scope) {
    return (
      <EmptyState
        title="Clan points aren't available here"
        hint="Clan points are paid into a clan's own points, so they need an event run by (or taking part as) a clan."
      />
    );
  }

  const past = event.status === "past";
  const canEdit = scope.can_manage;
  const limits = EVENT_CLAN_POINTS_LIMITS;
  const rows = preview?.rows ?? [];
  const shown = showAll ? rows : rows.slice(0, ROW_PREVIEW);
  const awardLabel =
    scope.status === "awarded" ? "Re-sync awards" : scope.status === "revoked" ? "Award again" : "Award now";

  return (
    <div className="space-y-5">
      <p className="text-osrs-parchment-dark/70 max-w-2xl text-sm">
        Pay members of <strong>{scope.group_name ?? "this clan"}</strong> clan points for how the
        event went — a fixed amount per member for each finishing place, and participation priced
        from their EHE (Efficient Hours towards Event). Points land in the clan&apos;s normal points
        ledger, leaderboards and seasons, labelled with the event.
        {event.mode === "clan_vs_clan" &&
          " On a clan-vs-clan event each clan sets its own payout for its own members."}
      </p>

      {!scope.available && (
        <Alert variant="info">
          This clan&apos;s points system isn&apos;t active — clan points need the Clan Points
          feature on the group&apos;s subscription. You can set the payout up now; nothing is paid
          until it&apos;s active.
        </Alert>
      )}

      {/* ---- Config ------------------------------------------------------ */}
      <Card className="space-y-4">
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={draft.enabled}
            disabled={!canEdit}
            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Award clan points for this event</span>
            <span className="text-osrs-parchment-dark/50 block text-xs">
              Only current members of the clan are ever paid.
            </span>
          </span>
        </label>

        {draft.enabled && (
          <div className="space-y-5">
            <fieldset className="space-y-1.5">
              <legend className="text-osrs-parchment-dark/70 mb-1 text-xs font-semibold uppercase">
                When to award
              </legend>
              {(
                [
                  ["auto", "Automatically when the event ends", "The end announcement lists the payout. You can still re-sync or revoke afterwards."],
                  ["review", "After I review the results", "Nothing is paid until an admin checks the preview below and clicks Award."],
                ] as const
              ).map(([mode, label, hint]) => (
                <label key={mode} className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="clan-points-mode"
                    checked={draft.award_mode === mode}
                    disabled={!canEdit}
                    onChange={() => setDraft((d) => ({ ...d, award_mode: mode }))}
                    className="accent-osrs-gold mt-1"
                  />
                  <span>
                    {label}
                    <span className="text-osrs-parchment-dark/50 block text-xs">{hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-osrs-parchment-dark/70 mb-1 text-xs font-semibold uppercase">
                Placement
              </legend>
              <p className="text-osrs-parchment-dark/50 text-xs">
                {competition
                  ? "Points for the players finishing in each place."
                  : "Points each member of the team finishing in that place receives."}{" "}
                Ties share a place (two teams tied 1st both get 1st; the next is 3rd). Anyone who
                scored nothing isn&apos;t placed.
              </p>
              {draft.placement.map((amount, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-14 text-sm">
                    {i < 3 && <span className="mr-1">{placeBadge(i + 1)}</span>}
                    <span className="text-osrs-parchment-dark/60 text-xs">{ordinal(i + 1)}</span>
                  </span>
                  <QuantityInput
                    min={0}
                    max={limits.points}
                    value={amount}
                    disabled={!canEdit}
                    onChange={(v) => setPlace(i, v)}
                    className={`${field} w-32`}
                    aria-label={`${ordinal(i + 1)} place points`}
                  />
                  <span className="text-osrs-parchment-dark/50 text-xs">
                    {competition ? "points" : "points each"}
                  </span>
                  {canEdit && i === draft.placement.length - 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({ ...d, placement: d.placement.slice(0, -1) }))
                      }
                      className="text-osrs-parchment-dark/50 hover:text-osrs-red ml-1 text-xs"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {canEdit && draft.placement.length < limits.places && (
                <button
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      placement: [
                        ...d.placement,
                        // Default the next place to half the one above.
                        Math.max(Math.floor((d.placement[d.placement.length - 1] ?? 200) / 2), 1),
                      ],
                    }))
                  }
                  className="text-osrs-gold-bright text-sm hover:underline"
                >
                  + Add {ordinal(draft.placement.length + 1)} place
                </button>
              )}
              {!competition && (
                <label className="flex items-start gap-2 pt-1 text-sm">
                  <Checkbox
                    checked={draft.placement_active_only}
                    disabled={!canEdit}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, placement_active_only: e.target.checked }))
                    }
                    className="mt-0.5"
                  />
                  <span>
                    Only members who took part
                    <span className="text-osrs-parchment-dark/50 block text-xs">
                      A member needs some credited contribution or tracked effort — an AFK
                      sign-up on the winning team gets nothing.
                    </span>
                  </span>
                </label>
              )}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-osrs-parchment-dark/70 mb-1 text-xs font-semibold uppercase">
                Participation
              </legend>
              {competition ? (
                <p className="text-osrs-parchment-dark/50 text-xs">
                  EHE isn&apos;t tracked on Skill/Boss of the Week events — the race itself is the
                  effort — so participation is a flat amount for everyone who gained anything.
                </p>
              ) : (
                <p className="text-osrs-parchment-dark/50 text-xs">
                  Priced from each member&apos;s EHE: hours of kills at the bosses this
                  event&apos;s tasks care about, whether or not anything dropped.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {!competition && (
                  <label className="text-sm">
                    <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                      Points per EHE hour
                    </span>
                    <QuantityInput
                      min={0}
                      max={limits.perHour}
                      step={0.5}
                      integer={false}
                      value={draft.participation.per_hour}
                      disabled={!canEdit}
                      onChange={(v) => setPart("per_hour", v)}
                      className={`${field} w-32`}
                    />
                  </label>
                )}
                <label className="text-sm">
                  <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                    Flat points for taking part
                  </span>
                  <QuantityInput
                    min={0}
                    max={limits.points}
                    value={draft.participation.flat}
                    disabled={!canEdit}
                    onChange={(v) => setPart("flat", v)}
                    className={`${field} w-32`}
                  />
                </label>
                {!competition && (
                  <label className="text-sm">
                    <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                      Minimum EHE hours (0 = any)
                    </span>
                    <QuantityInput
                      min={0}
                      max={limits.minHours}
                      step={0.5}
                      integer={false}
                      value={draft.participation.min_hours}
                      disabled={!canEdit}
                      onChange={(v) => setPart("min_hours", v)}
                      className={`${field} w-32`}
                    />
                  </label>
                )}
                <label className="text-sm">
                  <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                    Cap per member (0 = none)
                  </span>
                  <QuantityInput
                    min={0}
                    max={limits.points}
                    value={draft.participation.max}
                    disabled={!canEdit}
                    onChange={(v) => setPart("max", v)}
                    className={`${field} w-32`}
                  />
                </label>
              </div>
            </fieldset>
          </div>
        )}

        {canEdit ? (
          <div className="flex items-center gap-3">
            <Button size="sm" disabled={pending || !dirty} onClick={onSave}>
              {pending ? "Saving…" : "Save clan points"}
            </Button>
            {dirty && <span className="text-osrs-gold text-xs">Unsaved changes</span>}
          </div>
        ) : (
          <p className="text-osrs-parchment-dark/50 text-xs">
            Only this clan&apos;s admins and event managers can change its clan points.
          </p>
        )}
      </Card>

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {/* ---- Preview / awards ------------------------------------------- */}
      {saved?.enabled && preview && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-osrs-gold font-semibold">
                {scope.status === "awarded" ? "Awarded" : past ? "Ready to award" : "If it ended now"}
              </h4>
              <p className="text-osrs-parchment-dark/60 text-xs">
                {statusText(scope, event.status)}
                {scope.status === "awarded" && scope.awarded_at != null && (
                  <>
                    {" · "}
                    <LocalTime unix={scope.awarded_at} />
                  </>
                )}
              </p>
            </div>
            {canEdit && past && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={
                    pending ||
                    dirty ||
                    Boolean(preview.blocker) ||
                    (scope.status === "awarded" && !preview.out_of_sync)
                  }
                  onClick={onAward}
                  title={dirty ? "Save your changes first" : preview.blocker ?? undefined}
                >
                  {awardLabel}
                </Button>
                {scope.status === "awarded" &&
                  (confirmRevoke ? (
                    <>
                      <Button size="sm" variant="danger" disabled={pending} onClick={onRevoke}>
                        Yes, take the points back
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(false)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmRevoke(true)}>
                      Revoke all
                    </Button>
                  ))}
              </div>
            )}
          </div>

          {scope.last_error && scope.status !== "awarded" && (
            <Alert variant="info">{scope.last_error}</Alert>
          )}
          {past && preview.blocker && !scope.last_error && (
            <Alert variant="info">{preview.blocker}</Alert>
          )}
          {!preview.rates_known && preview.ehe_supported && (
            <Alert variant="info">
              EHE can&apos;t be priced right now (the WiseOldMan rate table is unavailable), so the
              hours below read low. Awarding waits until it&apos;s back.
            </Alert>
          )}
          {scope.status === "awarded" && preview.out_of_sync && preview.changes && (
            <Alert variant="info">
              The standings or the payout changed since the award: re-syncing would add{" "}
              {preview.changes.insert}, change {preview.changes.update} and remove{" "}
              {preview.changes.remove} award{preview.changes.remove === 1 ? "" : "s"}.
            </Alert>
          )}
          {scope.status === "awarded" && (preview.changes?.reset ?? 0) > 0 && (
            <p className="text-osrs-parchment-dark/50 text-xs">
              {preview.changes!.reset} award{preview.changes!.reset === 1 ? " was" : "s were"} wiped
              by a points reset since — re-syncing leaves {preview.changes!.reset === 1 ? "it" : "them"} wiped.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-4">
            <StatTile label="Total points" value={fmt(preview.total_points)} />
            <StatTile label="Members paid" value={fmt(preview.players)} hint={`of ${fmt(preview.roster_size)} on the roster`} />
            <StatTile label="Placement" value={fmt(preview.placement_points)} />
            <StatTile label="Participation" value={fmt(preview.participation_points)} />
          </div>

          {preview.placements.length > 0 && (
            <ul className="space-y-1 text-sm">
              {preview.placements.map((p) => (
                <li key={`${p.place}-${p.team_id ?? p.player_id}`}>
                  {placeBadge(p.place)} <strong>{p.label}</strong>{" "}
                  <span className="text-osrs-gold-bright">+{fmt(p.amount)}</span>
                  {p.team ? " each" : ""}
                  <span className="text-osrs-parchment-dark/50 text-xs">
                    {" "}
                    · {p.players} paid
                  </span>
                </li>
              ))}
            </ul>
          )}

          {rows.length === 0 ? (
            <EmptyState
              title="Nobody would be paid yet"
              hint={
                past
                  ? "No member placed or met the participation rules."
                  : "Payouts appear here as teams score and members put in hours."
              }
            />
          ) : (
            <>
              <PreviewTable rows={shown} showHours={preview.ehe_supported} />
              {rows.length > ROW_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="text-osrs-gold-bright text-xs hover:underline"
                >
                  {showAll ? "Show fewer" : `Show all ${fmt(rows.length)}`}
                </button>
              )}
            </>
          )}

          {preview.skipped.length > 0 && (
            <details className="text-sm">
              <summary className="text-osrs-parchment-dark/60 cursor-pointer text-xs">
                {preview.skipped.length} roster player{preview.skipped.length === 1 ? "" : "s"} not
                paid
              </summary>
              <ul className="text-osrs-parchment-dark/70 mt-2 space-y-0.5 text-xs">
                {preview.skipped.map((sk) => (
                  <li key={sk.player_id}>
                    {sk.player_name ?? `Player ${sk.player_id}`} — {SKIP_REASON[sk.reason] ?? sk.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      )}
    </div>
  );
}
