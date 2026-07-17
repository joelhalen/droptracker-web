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
import { useCallback, useEffect, useState, useTransition } from "react";
import type {
  EventBuyin,
  EventDetail,
  EventPrizeDistribution,
  EventPrizePot,
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
import {
  announceEventPot,
  bulkSeedEventBuyins,
  deleteEventBuyin,
  fetchEventPot,
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

/** Live buy-in row for one participant (or null when they have none yet). */
function findBuyin(rows: EventBuyin[], playerId: number, teamId: number): EventBuyin | undefined {
  return rows.find(
    (r) => r.kind === "buyin" && r.player_id === playerId && r.team_id === teamId,
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
  const [pot, setPot] = useState<EventPrizePot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // Disable-with-records confirmation: {count,total} while pending, else null.
  const [confirmDisable, setConfirmDisable] = useState<{ count: number; total: number } | null>(
    null,
  );

  const reload = useCallback(async () => {
    const next = await fetchEventPot(groupId, eventId);
    setPot(next);
    return next;
  }, [groupId, eventId]);

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
            {teams.length === 0 ? (
              <EmptyState title="No teams yet" hint="Add teams and members first." />
            ) : (
              <div className="space-y-4">
                {teams.map((team) => (
                  <div key={team.id}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-osrs-parchment-dark/70 text-xs font-medium uppercase">
                        {team.name}
                      </span>
                      <button
                        type="button"
                        disabled={busy.has(`seed:${team.id}`)}
                        onClick={() =>
                          withBusy(`seed:${team.id}`, async () => {
                            const res = await bulkSeedEventBuyins(groupId, eventId, team.id);
                            if (!res.ok) setError(res.message);
                            else setNotice(`Seeded ${res.created} buy-in(s) for ${team.name}.`);
                            await reload();
                          })
                        }
                        className="text-osrs-gold/70 hover:text-osrs-gold-bright text-xs disabled:opacity-50"
                        title="Add a pledged buy-in row for each member who doesn't have one"
                      >
                        + Seed pledges
                      </button>
                    </div>
                    {(team.members ?? []).length === 0 ? (
                      <p className="text-osrs-parchment-dark/40 text-xs">No members.</p>
                    ) : (
                      <ul className="divide-osrs-bronze/10 divide-y">
                        {(team.members ?? []).map((m) => {
                          const row = findBuyin(rows, m.player_id, team.id);
                          const rowKey = `buyin:${team.id}:${m.player_id}`;
                          const paid = row?.status === "paid";
                          const amount = row?.amount.value ?? config.default_buyin.value;
                          const rowBusy = busy.has(rowKey);
                          const setPaid = (next: boolean) =>
                            withBusy(rowKey, async () => {
                              if (next) {
                                if (row) {
                                  await updateEventBuyin(groupId, eventId, row.id, {
                                    status: "paid",
                                  });
                                } else {
                                  await recordEventBuyin(groupId, eventId, {
                                    player_id: m.player_id,
                                    team_id: team.id,
                                    kind: "buyin",
                                    amount,
                                    status: "paid",
                                  });
                                }
                              } else if (row) {
                                await updateEventBuyin(groupId, eventId, row.id, {
                                  status: "pledged",
                                });
                              }
                              await reload();
                            });
                          const commitAmount = (v: number) =>
                            withBusy(rowKey, async () => {
                              if (row) {
                                await updateEventBuyin(groupId, eventId, row.id, { amount: v });
                              } else if (v > 0) {
                                await recordEventBuyin(groupId, eventId, {
                                  player_id: m.player_id,
                                  team_id: team.id,
                                  kind: "buyin",
                                  amount: v,
                                  status: "pledged",
                                });
                              }
                              await reload();
                            });
                          return (
                            <li
                              key={m.player_id}
                              className="flex items-center justify-between gap-3 py-2"
                            >
                              <span className="min-w-0 truncate text-sm">{m.player_name}</span>
                              <div className="flex items-center gap-3">
                                <QuantityInput
                                  value={amount}
                                  min={0}
                                  emptyAs={0}
                                  disabled={rowBusy}
                                  onChange={commitAmount}
                                  className="w-28"
                                />
                                <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={paid}
                                    disabled={rowBusy}
                                    onChange={(e) => setPaid(e.target.checked)}
                                    className="accent-osrs-gold size-4"
                                  />
                                  Paid
                                </label>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
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
              onAdd={(rsn, amount) =>
                withBusy("donate", async () => {
                  const res = await recordEventBuyin(groupId, eventId, {
                    rsn,
                    kind: "donation",
                    amount,
                    status: "paid",
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

/** Free-text donor + amount → a paid donation (external sponsors welcome). */
function DonationAdd({
  onAdd,
  busy,
}: {
  onAdd: (rsn: string, amount: number) => void;
  busy: boolean;
}) {
  const [rsn, setRsn] = useState("");
  const [amount, setAmount] = useState(0);
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
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => {
          onAdd(rsn.trim(), amount);
          setRsn("");
          setAmount(0);
        }}
        className="border-osrs-gold/50 text-osrs-gold-bright hover:bg-osrs-gold/10 rounded border px-3 py-1.5 text-sm disabled:opacity-50"
      >
        Add donation
      </button>
    </div>
  );
}
