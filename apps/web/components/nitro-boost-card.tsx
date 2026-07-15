"use client";

/**
 * Lets a signed-in user choose which of their groups a Nitro boost they place
 * on the DropTracker Discord supports. Each boosting member adds a fixed monthly
 * pool credit to exactly one group (see services/nitro_attribution.py). The
 * choice takes effect only while the user is actually boosting.
 */
import { useState, useTransition } from "react";
import type { MyNitroBoost } from "@droptracker/api-types";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";
import { setNitroBoostGroup } from "@/app/(site)/(dashboard)/settings/actions";

const fmtUsd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

export function NitroBoostCard({ initial }: { initial: MyNitroBoost }) {
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Nothing to configure if the user isn't in any group.
  if (state.groups.length === 0) return null;

  const soleGroup = state.groups.length === 1 ? state.groups[0] : undefined;
  const effectiveName =
    state.groups.find((g) => g.id === state.effective_group_id)?.name ?? null;

  const onChange = (value: string) => {
    const groupId = value === "" ? null : Number(value);
    setError(null);
    startTransition(async () => {
      try {
        setState(await setNitroBoostGroup(groupId));
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save your choice. Please try again."));
      }
    });
  };

  return (
    <section className="max-w-xl">
      <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">Discord boost</h2>
      <p className="text-osrs-parchment-dark/70 mb-4 text-sm">
        If you boost the{" "}
        <a href="/discord" className="text-osrs-gold-bright hover:underline">
          DropTracker Discord
        </a>
        , your boost adds {fmtUsd(state.per_boost_cents)}/mo of premium credit toward one of your
        clans&apos; subscriptions — helping unlock more features.
      </p>

      {soleGroup ? (
        <p className="text-osrs-parchment-dark/90 text-sm">
          Your boost supports <span className="text-osrs-gold">{soleGroup.name}</span>.
        </p>
      ) : (
        <label className="block text-sm">
          <span className="text-osrs-parchment-dark/80 mb-1 block">Boost supports</span>
          <select
            value={state.designated_group_id ?? ""}
            disabled={pending}
            onChange={(e) => onChange(e.target.value)}
            className="bg-osrs-surface-1 border-osrs-bronze/40 text-osrs-parchment w-full rounded border px-3 py-2 disabled:opacity-50"
          >
            <option value="">
              Auto-pick{effectiveName ? ` (currently ${effectiveName})` : ""}
            </option>
            {state.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      )}
    </section>
  );
}
