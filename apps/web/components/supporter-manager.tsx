"use client";

import { useEffect, useState, useTransition } from "react";
import type { SubscriptionTier, UserSubscription } from "@droptracker/api-types";
import { formatDate, formatPrice } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Badge, SubscriptionStatusBadge } from "@/components/ui";
import { InlineMarkdown } from "@/components/markdown";
import {
  cancelSupporter,
  getSupporterStatus,
  openSupporterPortal,
  resumeSupporter,
  startSupporterCheckout,
} from "@/app/(public)/premium/actions";

/**
 * Personal supporter subscription card for the /premium page.
 *
 * The page is statically revalidated, so the signed-in user's subscription
 * state is fetched client-side via a server action after mount; signed-out
 * visitors just see the subscribe button (checkout prompts sign-in).
 */
export function SupporterManager({ tiers }: { tiers: SubscriptionTier[] }) {
  const [sub, setSub] = useState<UserSubscription | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSupporterStatus()
      .then((s) => {
        if (!cancelled) setSub(s);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const paidTiers = tiers.filter((t) => t.price_cents > 0);
  if (paidTiers.length === 0) return null;
  const isActive = sub != null && (sub.status === "active" || sub.status === "trialing");

  const redirectOrNotice = (url: string | null) => {
    if (url) {
      window.location.href = url;
    } else {
      setNotice("Billing is not configured in this environment yet.");
    }
  };

  const run = (fn: () => Promise<void>, fallbackMessage: string) =>
    startTransition(async () => {
      setNotice(null);
      setError(null);
      try {
        await fn();
      } catch (err) {
        setError(getErrorMessage(err, fallbackMessage));
      }
    });

  const onCheckout = (tierKey: string) =>
    run(async () => {
      const { url } = await startSupporterCheckout(tierKey);
      redirectOrNotice(url);
    }, "Couldn't start checkout. Sign in first, then try again.");

  const onPortal = () =>
    run(async () => {
      const { url } = await openSupporterPortal();
      redirectOrNotice(url);
    }, "Couldn't open the billing portal. Please try again.");

  const onCancel = () =>
    run(async () => {
      setSub(await cancelSupporter());
    }, "Couldn't cancel the subscription. Please try again.");

  const onResume = () =>
    run(async () => {
      setSub(await resumeSupporter());
    }, "Couldn't resume the subscription. Please try again.");

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <header className="text-center">
        <h2 className="text-osrs-gold text-2xl font-bold">Support DropTracker personally</h2>
        <p className="text-osrs-parchment-dark/80 mx-auto mt-1 max-w-xl text-sm">
          A personal subscription that supports the project and unlocks perks for you — separate
          from (or in addition to) your group&apos;s plan.
        </p>
      </header>

      <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-1">
        {paidTiers.map((t) => {
          const current = isActive && sub?.tier_key === t.key;
          return (
            <div
              key={t.key}
              className="bg-osrs-surface-1 shadow-osrs-card border-osrs-gold/40 flex flex-col rounded-xl border p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-osrs-gold-bright flex items-center gap-2 text-lg font-semibold">
                  {t.name}
                  {current && <Badge tone="green">Active</Badge>}
                </span>
                <span className="text-osrs-parchment text-2xl font-bold">{formatPrice(t)}</span>
              </div>
              {t.description && (
                <p className="text-osrs-parchment-dark/70 mt-1 text-sm">{t.description}</p>
              )}
              <ul className="mt-4 space-y-1.5 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-osrs-green">✓</span>
                    <InlineMarkdown>{f}</InlineMarkdown>
                  </li>
                ))}
              </ul>

              {current && sub ? (
                <div className="mt-5 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <SubscriptionStatusBadge status={sub.status} />
                    {sub.current_period_end && (
                      <span className="text-osrs-parchment-dark/60">
                        {sub.cancel_at_period_end ? "ends" : "renews"}{" "}
                        {formatDate(sub.current_period_end)}
                      </span>
                    )}
                  </div>
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
                  <p className="text-osrs-parchment-dark/60 text-xs">
                    Configure your submission DMs in{" "}
                    <a href="/settings" className="text-osrs-gold-bright hover:underline">
                      Settings
                    </a>
                    .
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => onCheckout(t.key)}
                  disabled={pending || !loaded}
                  className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark mt-5 rounded px-3 py-2 text-sm font-medium disabled:cursor-default disabled:opacity-50"
                >
                  {isActive ? "Switch to this plan" : "Become a supporter"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {notice && <p className="text-osrs-parchment-dark/70 text-center text-sm">{notice}</p>}
      {error && (
        <Alert variant="error" className="mx-auto max-w-2xl">
          {error}
        </Alert>
      )}
    </section>
  );
}
