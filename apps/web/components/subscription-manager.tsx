"use client";

/**
 * Group subscription management (pool model). A group's tier is funded by
 * contribution "legs" — independent recurring payments from different members
 * (a legacy PayPal agreement counts as a leg). The effective tier is whatever
 * the live pool total covers, so this page shows the pool, its legs, and
 * difference-priced upgrade cards ("+$Y/mo") instead of plan switching.
 */
import { useState, useTransition } from "react";
import type {
  GroupSubscription,
  GroupSubscriptionLeg,
  SubscriptionTier,
} from "@droptracker/api-types";
import { formatDate, formatPrice } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Badge, EmptyState, SubscriptionStatusBadge, TierBadge } from "@/components/ui";
import { InlineMarkdown } from "@/components/markdown";
import {
  cancelLeg,
  openBillingPortal,
  resumeLeg,
  startCheckout,
} from "@/app/(site)/(admin)/groups/[id]/subscription/actions";

const fmtUsd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

function legPayerLabel(leg: GroupSubscriptionLeg): string {
  if (leg.provider === "nitro") return "Member Nitro boosts";
  if (leg.user_name) return leg.user_name;
  if (leg.provider === "manual") return "Comped (staff grant)";
  if (leg.provider === "paypal") return "Legacy PayPal agreement";
  return "Unknown payer";
}

export function SubscriptionManager({
  groupId,
  tiers,
  initial,
  highlightTierKey,
}: {
  groupId: number;
  tiers: SubscriptionTier[];
  initial: GroupSubscription;
  /** Tier deep-linked from /premium (`?tier=`) — its plan card gets a gold ring. */
  highlightTierKey?: string;
}) {
  const [sub, setSub] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paidTiers = tiers.filter((t) => t.price_cents > 0);
  const isActive = sub.status === "active" || sub.status === "trialing";
  const poolTotal = sub.total_monthly_cents ?? 0;
  const legs = sub.legs ?? [];
  const liveLegs = legs.filter((l) => l.status === "active" || l.status === "trialing");

  const redirectOrNotice = (url: string | null) => {
    if (url) {
      window.location.href = url;
    } else {
      setNotice("Billing is not configured in this environment yet.");
    }
  };

  const onCheckout = (tierKey: string) =>
    startTransition(async () => {
      setNotice(null);
      setError(null);
      try {
        const { url } = await startCheckout(groupId, tierKey);
        redirectOrNotice(url);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't start checkout. Please try again."));
      }
    });

  const onPortal = () =>
    startTransition(async () => {
      setNotice(null);
      setError(null);
      try {
        const { url } = await openBillingPortal(groupId);
        redirectOrNotice(url);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't open the billing portal. Please try again."));
      }
    });

  const onCancelLeg = (legId: number) =>
    startTransition(async () => {
      setError(null);
      try {
        setSub(await cancelLeg(groupId, legId));
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't cancel the contribution. Please try again."));
      }
    });

  const onResumeLeg = (legId: number) =>
    startTransition(async () => {
      setError(null);
      try {
        setSub(await resumeLeg(groupId, legId));
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't resume the contribution. Please try again."));
      }
    });

  return (
    <div className="space-y-8">
      {/* Current plan (effective pool view) */}
      <section className="bg-osrs-surface-1 border-osrs-bronze/30 shadow-osrs-card rounded-xl border p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-osrs-parchment-dark/70 text-xs uppercase tracking-wide">
              Current plan
            </div>
            <div className="text-osrs-gold flex flex-wrap items-center gap-2 text-2xl font-bold">
              {tiers.find((t) => t.key === sub.tier_key)?.name ?? "Free"}
              <TierBadge
                tierKey={sub.tier_key}
                name={tiers.find((t) => t.key === sub.tier_key)?.name}
              />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
              {sub.status !== "none" && <SubscriptionStatusBadge status={sub.status} />}
              {poolTotal > 0 && (
                <span className="text-osrs-parchment-dark/80">
                  {fmtUsd(poolTotal)}/mo pooled from {liveLegs.length} contribution
                  {liveLegs.length === 1 ? "" : "s"}
                </span>
              )}
              {sub.nitro && sub.nitro.booster_count > 0 && (
                <span className="text-osrs-parchment-dark/80">
                  incl. {fmtUsd(sub.nitro.monthly_cents)}/mo from {sub.nitro.booster_count} member
                  {sub.nitro.booster_count === 1 ? "" : "s"} boosting Discord
                </span>
              )}
              {sub.current_period_end && (
                <span className="text-osrs-parchment-dark/60">
                  {sub.cancel_at_period_end ? "ends" : "next renewal"}{" "}
                  {formatDate(sub.current_period_end)}
                </span>
              )}
            </div>
          </div>

          {isActive && (
            <button
              onClick={onPortal}
              disabled={pending}
              className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Manage my billing
            </button>
          )}
        </div>

        {sub.cancel_at_period_end && (
          <p className="text-osrs-red mt-3 text-sm">
            Every contribution is winding down — the plan ends on{" "}
            {formatDate(sub.current_period_end)}.
          </p>
        )}
        {notice && <p className="text-osrs-parchment-dark/70 mt-3 text-sm">{notice}</p>}
        {error && <Alert variant="error" className="mt-3">{error}</Alert>}
      </section>

      {/* Contribution legs */}
      {legs.length > 0 && (
        <section>
          <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
            Contributions
          </h2>
          <p className="text-osrs-parchment-dark/70 mb-3 text-sm">
            Independent recurring payments that add up to the group&apos;s plan. If one lapses,
            the plan drops to whatever the remaining contributions still cover.
          </p>
          <div className="border-osrs-bronze/20 overflow-x-auto rounded border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-osrs-gold/80 text-left">
                  <th className="px-3 py-2">Payer</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Provider</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Renews</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {legs.map((leg) => (
                  <tr key={leg.id} className="border-osrs-bronze/20 border-t">
                    <td className="px-3 py-2">
                      {legPayerLabel(leg)}
                      {leg.mine && (
                        <Badge tone="sky" className="ml-2">
                          You
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {leg.amount_cents != null ? `${fmtUsd(leg.amount_cents)}/mo` : "—"}
                    </td>
                    <td className="px-3 py-2 capitalize">{leg.provider ?? "—"}</td>
                    <td className="px-3 py-2">
                      <SubscriptionStatusBadge status={leg.status} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {leg.current_period_end ? (
                        <span className={leg.cancel_at_period_end ? "text-osrs-red" : ""}>
                          {leg.cancel_at_period_end ? "ends " : ""}
                          {formatDate(leg.current_period_end)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(leg.status === "active" || leg.status === "trialing") &&
                        leg.provider !== "manual" &&
                        leg.provider !== "nitro" &&
                        (leg.cancel_at_period_end ? (
                          <button
                            onClick={() => onResumeLeg(leg.id)}
                            disabled={pending}
                            className="text-osrs-gold-bright text-xs hover:underline disabled:opacity-50"
                          >
                            Resume
                          </button>
                        ) : (
                          <button
                            onClick={() => onCancelLeg(leg.id)}
                            disabled={pending}
                            className="text-osrs-red text-xs hover:underline disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Available tiers (difference-priced) */}
      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">Plans</h2>
        {paidTiers.length === 0 && <EmptyState title="No paid plans are available right now" />}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paidTiers.map((t) => {
            const covered = poolTotal >= t.price_cents && isActive;
            const delta = t.price_cents - poolTotal;
            const current = sub.tier_key === t.key && isActive;
            return (
              <div
                key={t.key}
                className={`bg-osrs-surface-1 shadow-osrs-card flex flex-col rounded-xl border p-5 ${
                  t.key === highlightTierKey
                    ? "border-osrs-gold ring-osrs-gold/40 ring-1"
                    : t.recommended
                      ? "border-osrs-gold/60"
                      : "border-osrs-bronze/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-osrs-gold-bright text-lg font-semibold">{t.name}</span>
                  {current ? (
                    <Badge tone="green">Current</Badge>
                  ) : covered ? (
                    <Badge tone="green">Covered</Badge>
                  ) : (
                    t.recommended && <Badge tone="gold">Popular</Badge>
                  )}
                </div>
                <div className="text-osrs-parchment mt-1 text-2xl font-bold">{formatPrice(t)}</div>
                {t.description && (
                  <p className="text-osrs-parchment-dark/70 mt-1 text-sm">{t.description}</p>
                )}
                <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-osrs-green">✓</span>
                      <InlineMarkdown>{f}</InlineMarkdown>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onCheckout(t.key)}
                  disabled={pending || covered}
                  className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark mt-5 rounded px-3 py-2 text-sm font-medium disabled:cursor-default disabled:opacity-50"
                >
                  {covered
                    ? current
                      ? "Current plan"
                      : "Already covered"
                    : poolTotal > 0
                      ? `Upgrade — +${fmtUsd(delta)}/mo`
                      : "Subscribe"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
