"use client";

/**
 * Boost-slot attribution for the superadmin dashboard.
 *
 * Discord exposes no per-member boost count: the member list only says WHO
 * boosts, boost system messages carry a count that can go stale, and
 * `premium_subscription_count` is an unattributable total. So the reconciler
 * credits what it can prove and reports the rest — this screen is where the
 * remainder gets assigned by hand. See services/nitro_attribution.py.
 */
import { useState, useTransition } from "react";
import type { AdminNitroBoosts, AdminNitroBoostEntry } from "@droptracker/api-types";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Badge, EmptyState } from "@/components/ui";
import { setNitroBoostSlots } from "@/app/(site)/(admin)/admin/nitro-boosts/actions";

const usd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

const SOURCE_LABEL: Record<AdminNitroBoostEntry["source"], { label: string; hint: string }> = {
  manual: { label: "Manual", hint: "Set by an admin here — always wins." },
  message: { label: "Boost message", hint: "Read from Discord's own boost announcement." },
  default: { label: "Default", hint: "No multi-boost signal; credited one slot." },
};

function SlotEditor({
  userId,
  current,
  onSaved,
}: {
  userId: number;
  current: number;
  onSaved: (slots: number | null) => void;
}) {
  const [value, setValue] = useState(String(current));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = (slots: number | null) => {
    setError(null);
    startTransition(async () => {
      try {
        await setNitroBoostSlots(userId, slots);
        onSaved(slots);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save. Please try again."));
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Boost slots"
        className="bg-osrs-surface-1 border-osrs-bronze/40 text-osrs-parchment w-16 rounded border px-2 py-1 text-sm disabled:opacity-50"
      />
      <button
        type="button"
        disabled={pending || !value}
        onClick={() => save(Number(value))}
        className="border-osrs-bronze/40 text-osrs-parchment hover:border-osrs-gold/60 rounded border px-2 py-1 text-xs disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => save(null)}
        title="Remove the override and fall back to the automatic count"
        className="text-osrs-parchment-dark/60 hover:text-osrs-parchment px-1 text-xs disabled:opacity-50"
      >
        Clear
      </button>
      {error && (
        <span className="text-xs text-red-400" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function NitroBoostsManager({ data }: { data: AdminNitroBoosts }) {
  const [edits, setEdits] = useState<Record<number, number | null>>({});
  const snapshot = data.snapshot;

  if (!snapshot) {
    return (
      <EmptyState
        title="No reconcile published yet"
        hint="The webhook bot publishes this after its first Nitro reconcile (within an hour of start, or immediately after a boost). Check droptracker-webhooks is running."
      />
    );
  }

  const perBoost = snapshot.per_boost_cents || data.per_boost_cents;
  const lastRun = new Date(snapshot.at * 1000);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Boost slots on the guild" value={snapshot.guild_total ?? "—"} hint="Discord's own total" />
        <Kpi label="Distinct boosters" value={snapshot.boosters} />
        <Kpi label="Slots credited" value={snapshot.attributed} hint={`${usd(snapshot.attributed * perBoost)}/mo`} />
        <Kpi
          label="Unattributed"
          value={snapshot.unattributed}
          hint={snapshot.unattributed > 0 ? `${usd(snapshot.unattributed * perBoost)}/mo uncredited` : "All slots assigned"}
          tone={snapshot.unattributed > 0 ? "warn" : "ok"}
        />
      </div>

      {snapshot.unattributed > 0 && (
        <Alert variant="info">
          Discord reports {snapshot.guild_total} boost slots but only {snapshot.attributed} could be
          traced to a member — usually boosts placed before the current system channel existed, or
          whose announcement was deleted. Those {snapshot.unattributed} slots are deliberately{" "}
          <strong>not</strong> credited to any clan. Raise the count on whoever owns them below.
        </Alert>
      )}

      {snapshot.over_attributed > 0 && (
        <Alert variant="error">
          {snapshot.over_attributed} more slot(s) are claimed than the guild reports. Lower an
          override, or check whether someone stopped boosting since their last boost message.
        </Alert>
      )}

      <div className="border-osrs-bronze/20 overflow-x-auto rounded border">
        <table className="w-full text-sm">
          <thead className="text-osrs-parchment-dark/60 border-osrs-bronze/20 border-b text-left text-xs uppercase">
            <tr>
              <th className="px-3 py-2">Booster</th>
              <th className="px-3 py-2">Credited clan</th>
              <th className="px-3 py-2">Slots</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Credit</th>
              <th className="px-3 py-2">Override</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.entries.map((entry) => {
              const edited = entry.user_id != null ? edits[entry.user_id] : undefined;
              const slots = edited === undefined ? entry.slots : (edited ?? entry.observed ?? 1);
              return (
                <tr key={entry.discord_id} className="border-osrs-bronze/10 border-b last:border-0">
                  <td className="px-3 py-2">
                    <span className="text-osrs-parchment">
                      {entry.username ?? <span className="text-osrs-parchment-dark/50">Unlinked</span>}
                    </span>
                    <div className="text-osrs-parchment-dark/50 text-xs tabular-nums">
                      {entry.discord_id}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {entry.group_name ?? (
                      <span className="text-osrs-parchment-dark/50" title="No group — credit is not applied">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{slots}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={entry.source === "manual" ? "gold" : entry.source === "message" ? "sky" : "neutral"}
                      title={SOURCE_LABEL[entry.source].hint}
                    >
                      {SOURCE_LABEL[entry.source].label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{usd(slots * perBoost)}/mo</td>
                  <td className="px-3 py-2">
                    {entry.user_id != null ? (
                      <SlotEditor
                        userId={entry.user_id}
                        current={entry.slots}
                        onSaved={(next) => setEdits((prev) => ({ ...prev, [entry.user_id!]: next }))}
                      />
                    ) : (
                      <span className="text-osrs-parchment-dark/50 text-xs">
                        Needs a linked account
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Overrides for people who have since stopped boosting are ignored by the
          reconciler, but left visible so they can be tidied up. */}
      {data.overrides.some((o) => !snapshot.entries.some((e) => e.user_id === o.user_id)) && (
        <div>
          <h3 className="text-osrs-gold mb-2 text-sm font-semibold">Overrides for non-boosters</h3>
          <p className="text-osrs-parchment-dark/60 mb-2 text-xs">
            These users have an override but are not currently boosting, so nothing is credited.
          </p>
          <ul className="space-y-1 text-sm">
            {data.overrides
              .filter((o) => !snapshot.entries.some((e) => e.user_id === o.user_id))
              .map((o) => (
                <li key={o.user_id} className="flex items-center gap-3">
                  <span className="text-osrs-parchment-dark/80">
                    {o.username ?? o.discord_id ?? `User ${o.user_id}`} — {o.slots} slot
                    {o.slots === 1 ? "" : "s"}
                  </span>
                  <SlotEditor userId={o.user_id} current={o.slots} onSaved={() => undefined} />
                </li>
              ))}
          </ul>
        </div>
      )}

      <p className="text-osrs-parchment-dark/50 text-xs">
        Last reconcile {lastRun.toLocaleString()}. Changes are picked up on the bot&apos;s next pass
        (nudged to run within a minute).
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = "ok",
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="border-osrs-bronze/20 rounded border p-4">
      <dt className="text-osrs-parchment-dark/70 text-xs uppercase tracking-wide">{label}</dt>
      <dd
        className={`mt-1 text-2xl font-bold tabular-nums ${
          tone === "warn" ? "text-amber-400" : "text-osrs-gold-bright"
        }`}
      >
        {value}
      </dd>
      {hint && <p className="text-osrs-parchment-dark/50 mt-1 text-xs">{hint}</p>}
    </div>
  );
}
