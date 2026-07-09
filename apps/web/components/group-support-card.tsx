"use client";

/**
 * "Support this clan" card on the public group page (pool model). Shows the
 * tier the group's pooled contributions cover and lets any signed-in member
 * add their own recurring contribution toward the next tier — the pool sums
 * every member's payment, so nobody has to shoulder a whole tier alone.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import type { GroupSubscriptionSummary } from "@droptracker/api-types";
import { getErrorMessage } from "@/lib/errors";
import { Alert, TierBadge } from "@/components/ui";
import { contributeToGroup } from "@/app/(public)/groups/[id]/actions";

const fmtUsd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

export function GroupSupportCard({
  groupId,
  summary,
  signedIn,
}: {
  groupId: number;
  summary: GroupSubscriptionSummary;
  signedIn: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const next = summary.next_tier;

  const onContribute = () => {
    if (!next) return;
    startTransition(async () => {
      setNotice(null);
      setError(null);
      try {
        const { url } = await contributeToGroup(groupId, next.key);
        if (url) {
          window.location.href = url;
        } else {
          setNotice("Billing is not configured in this environment yet.");
        }
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't start the contribution. Please try again."));
      }
    });
  };

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-osrs-gold flex items-center gap-2 font-semibold">
            Support this clan
            {summary.tier_key && (
              <TierBadge tierKey={summary.tier_key} name={summary.tier_name ?? undefined} />
            )}
          </div>
          <p className="text-osrs-parchment-dark/70 mt-0.5 text-sm">
            {summary.tier_key ? (
              <>
                Members pool {fmtUsd(summary.total_monthly_cents)}/mo for{" "}
                <span className="text-osrs-parchment">{summary.tier_name}</span>
                {next && (
                  <>
                    {" "}
                    — {fmtUsd(next.delta_cents)}/mo more unlocks{" "}
                    <span className="text-osrs-parchment">{next.name}</span>
                  </>
                )}
                .
              </>
            ) : next ? (
              <>
                Unlock <span className="text-osrs-parchment">{next.name}</span> perks for the
                whole clan from {fmtUsd(next.delta_cents)}/mo — contributions from every member
                add up.
              </>
            ) : (
              "This clan enjoys the highest tier — thanks to its supporters!"
            )}
          </p>
        </div>
        {next &&
          (signedIn ? (
            <button
              onClick={onContribute}
              disabled={pending}
              className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark shrink-0 rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              Contribute {fmtUsd(next.delta_cents)}/mo
            </button>
          ) : (
            <Link
              href={`/api/auth/login?redirect=${encodeURIComponent(`/groups/${groupId}`)}`}
              prefetch={false}
              className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 shrink-0 rounded border px-3 py-1.5 text-sm font-medium"
            >
              Sign in to contribute
            </Link>
          ))}
      </div>
      {notice && <p className="text-osrs-parchment-dark/70 mt-2 text-sm">{notice}</p>}
      {error && <Alert variant="error" className="mt-2">{error}</Alert>}
    </div>
  );
}
