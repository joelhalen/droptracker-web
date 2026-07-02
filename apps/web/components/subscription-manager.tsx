"use client";

import { useState, useTransition } from "react";
import type { GroupSubscription, SubscriptionTier } from "@droptracker/api-types";
import { formatDate, formatPrice } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { Alert, EmptyState } from "@/components/ui";
import { InlineMarkdown } from "@/components/markdown";
import {
  cancelSubscription,
  openBillingPortal,
  resumeSubscription,
  startCheckout,
} from "@/app/(admin)/groups/[id]/subscription/actions";

const STATUS_STYLES: Record<GroupSubscription["status"], string> = {
  none: "text-osrs-parchment-dark/60",
  active: "text-osrs-green",
  trialing: "text-osrs-green",
  past_due: "text-osrs-red",
  canceled: "text-osrs-red",
  expired: "text-osrs-red",
};

export function SubscriptionManager({
  groupId,
  tiers,
  initial,
}: {
  groupId: number;
  tiers: SubscriptionTier[];
  initial: GroupSubscription;
}) {
  const [sub, setSub] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const paidTiers = tiers.filter((t) => t.price_cents > 0);
  const isActive = sub.status === "active" || sub.status === "trialing";

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

  const onCancel = () =>
    startTransition(async () => {
      setError(null);
      try {
        setSub(await cancelSubscription(groupId));
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't cancel the subscription. Please try again."));
      }
    });

  const onResume = () =>
    startTransition(async () => {
      setError(null);
      try {
        setSub(await resumeSubscription(groupId));
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't resume the subscription. Please try again."));
      }
    });

  return (
    <div className="space-y-8">
      {/* Current plan */}
      <section className="border-osrs-bronze/30 rounded border p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-osrs-parchment-dark/70 text-xs uppercase tracking-wide">
              Current plan
            </div>
            <div className="text-osrs-gold text-2xl font-bold">
              {tiers.find((t) => t.key === sub.tier_key)?.name ?? "Free"}
            </div>
            <div className={`mt-1 text-sm capitalize ${STATUS_STYLES[sub.status]}`}>
              {sub.status.replace("_", " ")}
              {sub.current_period_end && (
                <span className="text-osrs-parchment-dark/60">
                  {" · "}
                  {sub.cancel_at_period_end ? "ends" : "renews"} {formatDate(sub.current_period_end)}
                </span>
              )}
            </div>
          </div>

          {isActive && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onPortal}
                disabled={pending}
                className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Manage billing
              </button>
              {sub.cancel_at_period_end ? (
                <button
                  onClick={onResume}
                  disabled={pending}
                  className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  Resume
                </button>
              ) : (
                <button
                  onClick={onCancel}
                  disabled={pending}
                  className="text-osrs-red hover:bg-osrs-red/10 rounded px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>

        {sub.cancel_at_period_end && (
          <p className="text-osrs-red mt-3 text-sm">
            This subscription will not renew and ends on {formatDate(sub.current_period_end)}.
          </p>
        )}
        {notice && <p className="text-osrs-parchment-dark/70 mt-3 text-sm">{notice}</p>}
        {error && <Alert variant="error" className="mt-3">{error}</Alert>}
      </section>

      {/* Available tiers */}
      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">Plans</h2>
        {paidTiers.length === 0 && <EmptyState title="No paid plans are available right now" />}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paidTiers.map((t) => {
            const current = sub.tier_key === t.key && isActive;
            return (
              <div
                key={t.key}
                className={`flex flex-col rounded border p-5 ${
                  t.recommended ? "border-osrs-gold/60" : "border-osrs-bronze/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-osrs-gold-bright text-lg font-semibold">{t.name}</span>
                  {t.recommended && (
                    <span className="bg-osrs-gold/20 text-osrs-gold rounded px-1.5 py-0.5 text-xs">
                      Popular
                    </span>
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
                  disabled={pending || current}
                  className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark mt-5 rounded px-3 py-2 text-sm font-medium disabled:cursor-default disabled:opacity-50"
                >
                  {current ? "Current plan" : isActive ? "Switch to this plan" : "Subscribe"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
