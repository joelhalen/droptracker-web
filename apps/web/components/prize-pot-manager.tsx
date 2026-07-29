"use client";

/**
 * Prize Pot admin tab (web52a). Configures the pot and drives the buy-in
 * ledger: the master toggle (with the confirm-on-disable guard), the
 * distribution/advertise config, the per-participant "Paid?" roster checklist
 * (the manual tick box with the person's name), and the donations sub-list.
 *
 * The tool tracks/advertises GP only — payouts are traded in-game by the clan
 * (like split-tracking); nothing here moves real GP.
 */
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type {
  EventBuyin,
  EventDetail,
  EventPrizeDistribution,
  EventPrizePot,
  EventSignup,
  EventTeam,
} from "@droptracker/api-types";

/** The writeable prize-config shape (raw GP numbers, vs. the read's Money). */
type PrizeConfigPatch = {
  default_buyin?: number;
  distribution?: EventPrizeDistribution;
  top_n?: number;
  splits?: number[];
  advertise?: boolean;
  show_contributors?: boolean;
  allow_leader_mark?: boolean;
};
import { Card, EmptyState, Badge } from "@/components/ui";
import { QuantityInput } from "@/components/quantity-input";
import { ProofAttach, type ProofUpload } from "@/components/proof-attach";
import {
  announceEventPot,
  bulkSeedEventBuyins,
  deleteEventBuyin,
  fetchEventPot,
  listEventSignups,
  recordEventBuyin,
  updateEventBuyin,
  updateEventPotConfig,
} from "@/app/(site)/(admin)/groups/[id]/events/actions";

type GroupId = number | null;

/** Toggle switch row (same styling as the Discord config toggles). */
function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="border-osrs-bronze/15 hover:border-osrs-gold/40 bg-osrs-surface-2/50 flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="text-osrs-parchment-dark/60 mt-0.5 block text-xs">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-osrs-gold" : "bg-osrs-stone/50"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 inline-block size-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </span>
    </button>
  );
}

const DISTRIBUTIONS: { key: EventPrizeDistribution; label: string }[] = [
  { key: "first_only", label: "Winner takes all" },
  { key: "top_n", label: "Top N teams" },
  { key: "custom_split", label: "Custom split" },
];

/** Live buy-in row for one participant (or null when they have none yet).
 * `teamId` is null for a pre-draft contributor — their row is recorded with no
 * team and follows them onto one when the draft lands (web71a). */
function findBuyin(
  rows: EventBuyin[],
  playerId: number,
  teamId: number | null,
): EventBuyin | undefined {
  return rows.find(
    (r) =>
      r.kind === "buyin" && r.player_id === playerId && (r.team_id ?? null) === teamId,
  );
}

/** One participant's line in a buy-in checklist: the expected amount, an
 * optional screenshot of the trade, and the "Paid" tick. Identical whether the
 * payer is on a team or still in the pool — only the `team_id` written with the
 * row differs. */
function BuyinLine({
  name,
  amount,
  paid,
  proofUrl,
  busy,
  onSetPaid,
  onCommitAmount,
  onSetProof,
}: {
  name: string;
  amount: number;
  paid: boolean;
  proofUrl: string | null;
  busy: boolean;
  onSetPaid: (next: boolean) => void;
  onCommitAmount: (value: number) => void;
  onSetProof: (key: string | null) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="min-w-0 truncate text-sm">{name}</span>
      <div className="flex items-center gap-3">
        <QuantityInput
          value={amount}
          min={0}
          emptyAs={0}
          disabled={busy}
          onChange={onCommitAmount}
          className="w-28"
        />
        <ProofAttach
          url={proofUrl}
          disabled={busy}
          title={`Attach proof of ${name}'s payment`}
          onUploaded={(u) => onSetProof(u.key)}
          onRemove={() => onSetProof(null)}
        />
        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={paid}
            disabled={busy}
            onChange={(e) => onSetPaid(e.target.checked)}
            className="accent-osrs-gold size-4"
          />
          Paid
        </label>
      </div>
    </li>
  );
}

/** "Add a pledged row for everyone here who hasn't got one" — per team, or for
 * the not-yet-drafted pool. */
function SeedButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="text-osrs-gold/70 hover:text-osrs-gold-bright text-xs disabled:opacity-50"
      title="Add a pledged buy-in row for each participant who doesn't have one"
    >
      + Seed pledges
    </button>
  );
}

export function PrizePotManager({
  groupId,
  event,
  teams,
  onEventUpdated,
}: {
  groupId: GroupId;
  event: EventDetail;
  teams: EventTeam[];
  onEventUpdated?: (e: EventDetail) => void;
}) {
  const eventId = event.id;
  // Sign-up pool: the only formation mode where a participant can exist with
  // no team (self-join / auto-assign place immediately). Its roster is what
  // the pre-draft checklist ticks against.
  const isPool = event.formation_mode === "signup_pool";
  const [pot, setPot] = useState<EventPrizePot | null>(null);
  const [pool, setPool] = useState<EventSignup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // Disable-with-records confirmation: {count,total} while pending, else null.
  const [confirmDisable, setConfirmDisable] = useState<{ count: number; total: number } | null>(
    null,
  );

  const reloadPool = useCallback(async () => {
    if (!isPool) return;
    setPool(await listEventSignups(groupId, eventId));
  }, [groupId, eventId, isPool]);

  const reload = useCallback(async () => {
    const [next] = await Promise.all([fetchEventPot(groupId, eventId), reloadPool()]);
    setPot(next);
    return next;
  }, [groupId, eventId, reloadPool]);

  useEffect(() => {
    let alive = true;
    fetchEventPot(groupId, eventId)
      .then((p) => alive && setPot(p))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load the pot."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [groupId, eventId]);

  // The sign-up pool drives the pre-draft checklist (web71a). Loaded separately
  // from the pot so a pool failure can't take the whole tab down — the worst
  // case is the checklist falling back to whoever already has a buy-in row.
  useEffect(() => {
    if (!isPool) return;
    let alive = true;
    listEventSignups(groupId, eventId)
      .then((p) => alive && setPool(p))
      .catch(() => {
        /* leave the checklist to the ledger-derived fallback below */
      });
    return () => {
      alive = false;
    };
  }, [groupId, eventId, isPool]);

  /** Everyone who should appear on the pre-draft checklist: the sign-up pool's
   * unplaced players, plus anyone already holding a team-less buy-in (a hand-
   * recorded contributor, or someone who has since withdrawn — their GP is
   * still in the pot, so they must stay tickable). */
  const unassignedRoster = useMemo(() => {
    const byId = new Map<number, string>();
    for (const p of pool ?? []) {
      if (p.team_id == null) byId.set(p.player_id, p.player_name);
    }
    for (const r of pot?.contributors ?? []) {
      if (r.kind !== "buyin" || r.team_id != null || r.player_id == null) continue;
      if (!byId.has(r.player_id)) byId.set(r.player_id, r.rsn ?? `Player ${r.player_id}`);
    }
    return [...byId].map(([player_id, player_name]) => ({ player_id, player_name }));
  }, [pool, pot]);

  const withBusy = useCallback(
    (key: string, fn: () => Promise<void>) => {
      setError(null);
      setNotice(null);
      setBusy((s) => new Set(s).add(key));
      startTransition(async () => {
        try {
          await fn();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
          setBusy((s) => {
            const n = new Set(s);
            n.delete(key);
            return n;
          });
        }
      });
    },
    [startTransition],
  );

  if (loading) {
    return <p className="text-osrs-parchment-dark/60 text-sm">Loading prize pot…</p>;
  }
  if (!pot) {
    return <EmptyState title="Prize pot unavailable" hint={error ?? undefined} />;
  }

  const enabled = pot.enabled;
  const config = pot.config;
  const rows = pot.contributors ?? [];
  const donations = rows.filter((r) => r.kind === "donation");

  /** One checklist section. `teamId` is the team the rows credit — `null` for
   * the not-yet-drafted list, which is the whole point of web71a: the row is
   * written with no team and the backend re-points it when the player is
   * placed. Deliberately a function, not a component: inlining the elements
   * keeps the amount inputs mounted (and focused) across re-renders. */
  const checklist = (
    members: { player_id: number; player_name: string }[],
    teamId: number | null,
  ) => (
    <ul className="divide-osrs-bronze/10 divide-y">
      {members.map((m) => {
        const row = findBuyin(rows, m.player_id, teamId);
        const rowKey = `buyin:${teamId ?? "pool"}:${m.player_id}`;
        const amount = row?.amount.value ?? config.default_buyin.value;
        const record = (
          value: number,
          status: "pledged" | "paid",
          proofKey?: string | null,
        ) =>
          recordEventBuyin(groupId, eventId, {
            player_id: m.player_id,
            team_id: teamId,
            kind: "buyin",
            amount: value,
            status,
            ...(proofKey ? { proof_key: proofKey } : {}),
          });
        return (
          <BuyinLine
            key={m.player_id}
            name={m.player_name}
            amount={amount}
            paid={row?.status === "paid"}
            proofUrl={row?.proof_url ?? null}
            busy={busy.has(rowKey)}
            onSetProof={(key) =>
              withBusy(rowKey, async () => {
                // No ledger row yet (nobody has ticked or edited this person):
                // the screenshot creates the pledged row it belongs to, rather
                // than being dropped on the floor.
                const res = row
                  ? await updateEventBuyin(groupId, eventId, row.id, { proof_key: key })
                  : key
                    ? await record(amount, "pledged", key)
                    : { ok: true as const };
                if (!res.ok) setError(res.message);
                await reload();
              })
            }
            onSetPaid={(next) =>
              withBusy(rowKey, async () => {
                const res = next
                  ? row
                    ? await updateEventBuyin(groupId, eventId, row.id, { status: "paid" })
                    : await record(amount, "paid")
                  : row
                    ? await updateEventBuyin(groupId, eventId, row.id, { status: "pledged" })
                    : { ok: true as const };
                if (!res.ok) setError(res.message);
                await reload();
              })
            }
            onCommitAmount={(v) =>
              withBusy(rowKey, async () => {
                const res = row
                  ? await updateEventBuyin(groupId, eventId, row.id, { amount: v })
                  : v > 0
                    ? await record(v, "pledged")
                    : { ok: true as const };
                if (!res.ok) setError(res.message);
                await reload();
              })
            }
          />
        );
      })}
    </ul>
  );

  // --- Master toggle + confirm-on-disable ---------------------------------
  const applyToggle = (next: boolean, confirm = false) =>
    withBusy("toggle", async () => {
      const res = await updateEventPotConfig(groupId, eventId, {
        buyins_enabled: next,
        ...(confirm ? { confirm_disable_buyins: true } : {}),
      });
      if (res.ok) {
        onEventUpdated?.(res.event);
        setConfirmDisable(null);
        await reload();
      } else if ("needsConfirm" in res && res.needsConfirm) {
        setConfirmDisable({ count: res.count, total: res.total });
      } else if ("message" in res) {
        setError(res.message);
      }
    });

  const saveConfig = (patch: PrizeConfigPatch) =>
    withBusy("config", async () => {
      const res = await updateEventPotConfig(groupId, eventId, { prize_config: patch });
      if (res.ok) {
        onEventUpdated?.(res.event);
        await reload();
      } else if ("message" in res) {
        setError(res.message);
      }
    });

  return (
    <div className="space-y-6">
      {error && (
        <p className="border-osrs-red/40 bg-osrs-red/10 text-osrs-red rounded border px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {/* Master toggle */}
      <ToggleRow
        label="Enable prize pot"
        hint="Track GP buy-ins & donations and advertise a running pot. Payouts are still traded in-game."
        checked={enabled}
        disabled={busy.has("toggle")}
        onChange={(v) => applyToggle(v)}
      />

      {confirmDisable && (
        <Card className="border-osrs-red/40">
          <p className="text-sm">
            This event has <strong>{confirmDisable.count}</strong> recorded buy-ins/donations
            totalling <strong>{confirmDisable.total.toLocaleString()} GP</strong>. Disabling hides
            the pot but keeps the records — re-enabling restores it. Continue?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy.has("toggle")}
              onClick={() => applyToggle(false, true)}
              className="border-osrs-red/50 text-osrs-red hover:bg-osrs-red/10 rounded border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Disable anyway
            </button>
            <button
              type="button"
              onClick={() => setConfirmDisable(null)}
              className="border-osrs-bronze/30 hover:border-osrs-gold/40 rounded border px-3 py-1.5 text-sm"
            >
              Keep enabled
            </button>
          </div>
        </Card>
      )}

      {enabled && (
        <>
          {/* Headline totals */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="bg-osrs-surface-2/70 rounded-lg px-4 py-3">
              <div className="text-osrs-parchment-dark/60 text-xs uppercase">Prize pot</div>
              <div className="text-osrs-gold-bright mt-0.5 text-2xl font-bold tabular-nums">
                {pot.total.value_formatted}
              </div>
            </div>
            <div className="bg-osrs-surface-2/70 rounded-lg px-4 py-3">
              <div className="text-osrs-parchment-dark/60 text-xs uppercase">Buy-ins</div>
              <div className="mt-0.5 text-lg tabular-nums">{pot.buyin_total.value_formatted}</div>
            </div>
            <div className="bg-osrs-surface-2/70 rounded-lg px-4 py-3">
              <div className="text-osrs-parchment-dark/60 text-xs uppercase">Donations</div>
              <div className="mt-0.5 text-lg tabular-nums">
                {pot.donation_total.value_formatted}
              </div>
            </div>
          </div>

          {/* Manual announce — post the pot to Discord now (needs the event's
              announcements channel configured under the Discord tab). */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy.has("announce")}
              onClick={() =>
                withBusy("announce", async () => {
                  const res = await announceEventPot(groupId, eventId);
                  if (!res.ok) setError(res.message);
                  else setNotice("Posted the pot to Discord.");
                })
              }
              className="border-osrs-gold/50 text-osrs-gold-bright hover:bg-osrs-gold/10 rounded border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              📣 Announce pot on Discord
            </button>
            {notice && <span className="text-osrs-green text-xs">{notice}</span>}
          </div>

          {/* Config */}
          <Card>
            <h4 className="text-osrs-gold mb-3 text-sm font-semibold">Configuration</h4>
            <div className="space-y-4">
              <label className="block">
                <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                  Default buy-in (GP)
                </span>
                <QuantityInput
                  value={config.default_buyin.value}
                  min={0}
                  emptyAs={0}
                  onChange={(v) => saveConfig({ default_buyin: v })}
                  className="w-40"
                />
              </label>

              <div>
                <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">
                  Who wins the pot
                </span>
                <div className="flex flex-wrap gap-2">
                  {DISTRIBUTIONS.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      disabled={busy.has("config")}
                      onClick={() => saveConfig({ distribution: d.key })}
                      className={`rounded border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
                        config.distribution === d.key
                          ? "border-osrs-gold bg-osrs-gold/10 text-osrs-gold-bright"
                          : "border-osrs-bronze/30 hover:border-osrs-gold/40"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                {config.distribution === "top_n" && (
                  <label className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-osrs-parchment-dark/70">Number of winning teams</span>
                    <QuantityInput
                      value={config.top_n}
                      min={1}
                      max={Math.max(1, teams.length)}
                      onChange={(v) => saveConfig({ top_n: v })}
                      className="w-20"
                    />
                  </label>
                )}
                {config.distribution === "custom_split" && (
                  <CustomSplitEditor
                    splits={config.splits}
                    busy={busy.has("config")}
                    onSave={(splits) => saveConfig({ splits })}
                  />
                )}
              </div>

              <div className="space-y-2">
                <ToggleRow
                  label="Advertise the pot on Discord"
                  hint="Show a running pot total on the standings board and start/end announcements."
                  checked={config.advertise}
                  disabled={busy.has("config")}
                  onChange={(v) => saveConfig({ advertise: v })}
                />
                <ToggleRow
                  label="Show contributors publicly"
                  hint="List each RSN and amount on the event page, vs. showing only the total."
                  checked={config.show_contributors}
                  disabled={busy.has("config")}
                  onChange={(v) => saveConfig({ show_contributors: v })}
                />
                <ToggleRow
                  label="Let team leaders tick their own team"
                  hint="Team leaders may mark their own team's buy-ins paid."
                  checked={config.allow_leader_mark}
                  disabled={busy.has("config")}
                  onChange={(v) => saveConfig({ allow_leader_mark: v })}
                />
              </div>
            </div>
          </Card>

          {/* Roster checklist */}
          <Card>
            <h4 className="text-osrs-gold mb-1 text-sm font-semibold">Buy-ins</h4>
            <p className="text-osrs-parchment-dark/60 mb-3 text-xs">
              Tick each participant once they&apos;ve paid in. Only paid buy-ins count toward the
              pot.
            </p>
            {teams.length === 0 && unassignedRoster.length === 0 ? (
              <EmptyState
                title={isPool ? "No sign-ups yet" : "No teams yet"}
                hint={
                  isPool
                    ? "Buy-ins can be recorded as soon as players sign up — no team needed."
                    : "Add teams and members first."
                }
              />
            ) : (
              <div className="space-y-4">
                {/* Pre-draft (web71a): players who have signed up but aren't on
                    a team yet. Their buy-in is recorded with no team and moves
                    onto whichever team the draft gives them — nothing has to be
                    re-entered, and no placeholder team is needed. */}
                {unassignedRoster.length > 0 && (
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-osrs-parchment-dark/70 text-xs font-medium uppercase">
                        Not yet drafted
                      </span>
                      <SeedButton
                        busy={busy.has("seed:pool")}
                        onClick={() =>
                          withBusy("seed:pool", async () => {
                            const res = await bulkSeedEventBuyins(groupId, eventId, null);
                            if (!res.ok) setError(res.message);
                            else setNotice(`Seeded ${res.created} buy-in(s).`);
                            await reload();
                          })
                        }
                      />
                    </div>
                    <p className="text-osrs-parchment-dark/50 mb-1 text-xs">
                      Recorded now, carried onto their team when the draft happens.
                      {pot.unassigned && pot.unassigned.paid_count > 0 && (
                        <>
                          {" "}
                          <span className="text-osrs-gold/80">
                            {pot.unassigned.paid_count} paid ·{" "}
                            {pot.unassigned.total.value_formatted}
                          </span>
                        </>
                      )}
                    </p>
                    {checklist(unassignedRoster, null)}
                  </div>
                )}

                {teams.map((team) => (
                  <div key={team.id}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-osrs-parchment-dark/70 text-xs font-medium uppercase">
                        {team.name}
                      </span>
                      <SeedButton
                        busy={busy.has(`seed:${team.id}`)}
                        onClick={() =>
                          withBusy(`seed:${team.id}`, async () => {
                            const res = await bulkSeedEventBuyins(groupId, eventId, team.id);
                            if (!res.ok) setError(res.message);
                            else setNotice(`Seeded ${res.created} buy-in(s) for ${team.name}.`);
                            await reload();
                          })
                        }
                      />
                    </div>
                    {(team.members ?? []).length === 0 ? (
                      <p className="text-osrs-parchment-dark/40 text-xs">No members.</p>
                    ) : (
                      checklist(team.members ?? [], team.id)
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Donations */}
          <Card>
            <h4 className="text-osrs-gold mb-3 text-sm font-semibold">Donations</h4>
            <DonationAdd
              onAdd={(rsn, amount, proofKey) =>
                withBusy("donate", async () => {
                  const res = await recordEventBuyin(groupId, eventId, {
                    rsn,
                    kind: "donation",
                    amount,
                    status: "paid",
                    ...(proofKey ? { proof_key: proofKey } : {}),
                  });
                  if (!res.ok) setError(res.message);
                  await reload();
                })
              }
              busy={busy.has("donate")}
            />
            {donations.length === 0 ? (
              <p className="text-osrs-parchment-dark/40 mt-3 text-xs">No donations yet.</p>
            ) : (
              <ul className="divide-osrs-bronze/10 mt-3 divide-y">
                {donations.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-bold">{d.rsn ?? "Anonymous"}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-osrs-gold-bright font-bold tabular-nums">
                        {d.amount.value_formatted}
                      </span>
                      <ProofAttach
                        url={d.proof_url ?? null}
                        disabled={busy.has(`proof:${d.id}`)}
                        title={`Attach proof of ${d.rsn ?? "this"} donation`}
                        onUploaded={(u) =>
                          withBusy(`proof:${d.id}`, async () => {
                            const res = await updateEventBuyin(groupId, eventId, d.id, {
                              proof_key: u.key,
                            });
                            if (!res.ok) setError(res.message);
                            await reload();
                          })
                        }
                        onRemove={() =>
                          withBusy(`proof:${d.id}`, async () => {
                            const res = await updateEventBuyin(groupId, eventId, d.id, {
                              proof_key: null,
                            });
                            if (!res.ok) setError(res.message);
                            await reload();
                          })
                        }
                      />
                      <button
                        type="button"
                        disabled={busy.has(`del:${d.id}`)}
                        onClick={() =>
                          withBusy(`del:${d.id}`, async () => {
                            await deleteEventBuyin(groupId, eventId, d.id);
                            await reload();
                          })
                        }
                        className="text-osrs-parchment-dark/50 hover:text-osrs-red text-xs disabled:opacity-50"
                        aria-label="Remove donation"
                      >
                        Remove
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {!pot.can_manage && (
            <Badge>Read-only — you don&apos;t administer this event.</Badge>
          )}
        </>
      )}
    </div>
  );
}

/** Percentage-by-place editor for the custom_split distribution. The pot is
 * advisory (payouts are traded in-game), so this just records the intended
 * split — the backend requires the percentages to sum to exactly 100. */
function CustomSplitEditor({
  splits,
  onSave,
  busy,
}: {
  splits: number[];
  onSave: (splits: number[]) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<number[]>(splits.length ? splits : [100]);
  const sum = draft.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const valid = sum === 100 && draft.every((n) => Number.isInteger(n) && n > 0);
  const setAt = (i: number, v: number) =>
    setDraft((d) => d.map((n, idx) => (idx === i ? v : n)));
  return (
    <div className="mt-2 space-y-2">
      <span className="text-osrs-parchment-dark/70 block text-xs">Split by place (%)</span>
      <div className="flex flex-wrap items-center gap-2">
        {draft.map((n, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-osrs-parchment-dark/50 text-[11px]">{i + 1}.</span>
            <QuantityInput
              value={n}
              min={0}
              emptyAs={0}
              onChange={(v) => setAt(i, v)}
              className="w-16"
            />
            {draft.length > 1 && (
              <button
                type="button"
                onClick={() => setDraft((d) => d.filter((_, idx) => idx !== i))}
                className="text-osrs-parchment-dark/40 hover:text-osrs-red text-xs"
                aria-label={`Remove place ${i + 1}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setDraft((d) => [...d, 0])}
          className="border-osrs-bronze/30 hover:border-osrs-gold/40 rounded border px-2 py-1 text-xs"
        >
          + place
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className={sum === 100 ? "text-osrs-green" : "text-osrs-red"}>
          Total: {sum}%{sum === 100 ? "" : " (must be 100)"}
        </span>
        <button
          type="button"
          disabled={!valid || busy}
          onClick={() => onSave(draft)}
          className="border-osrs-gold/50 text-osrs-gold-bright hover:bg-osrs-gold/10 rounded border px-3 py-1 disabled:opacity-50"
        >
          Save split
        </button>
      </div>
    </div>
  );
}

/** Free-text donor + amount (+ optional screenshot) → a paid donation
 * (external sponsors welcome). The image is uploaded as it's picked and held
 * as a pending key until the donation is actually recorded. */
function DonationAdd({
  onAdd,
  busy,
}: {
  onAdd: (rsn: string, amount: number, proofKey: string | null) => void;
  busy: boolean;
}) {
  const [rsn, setRsn] = useState("");
  const [amount, setAmount] = useState(0);
  const [proof, setProof] = useState<ProofUpload | null>(null);
  const canSubmit = rsn.trim().length > 0 && amount > 0 && !busy;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Donor (RSN or name)</span>
        <input
          type="text"
          value={rsn}
          maxLength={24}
          onChange={(e) => setRsn(e.target.value)}
          placeholder="Zezima"
          className="border-osrs-bronze/30 bg-osrs-surface-2/50 focus:border-osrs-gold/60 w-44 rounded border px-2 py-1.5 text-sm outline-none"
        />
      </label>
      <label className="block">
        <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Amount (GP)</span>
        <QuantityInput value={amount} min={0} emptyAs={0} onChange={setAmount} className="w-32" />
      </label>
      <label className="block">
        <span className="text-osrs-parchment-dark/70 mb-1 block text-xs">Proof</span>
        <ProofAttach
          url={proof?.public_url ?? null}
          size="md"
          disabled={busy}
          title="Attach a screenshot of the donation"
          onUploaded={setProof}
          onRemove={() => setProof(null)}
        />
      </label>
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => {
          onAdd(rsn.trim(), amount, proof?.key ?? null);
          setRsn("");
          setAmount(0);
          setProof(null);
        }}
        className="border-osrs-gold/50 text-osrs-gold-bright hover:bg-osrs-gold/10 rounded border px-3 py-1.5 text-sm disabled:opacity-50"
      >
        Add donation
      </button>
    </div>
  );
}
