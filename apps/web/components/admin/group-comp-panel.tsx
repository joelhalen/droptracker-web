"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { GroupSubscription, SubscriptionTier } from "@droptracker/api-types";
import type { AdminGroupOverview } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { grantComp, revokeComp } from "@/app/(admin)/admin/groups/actions";

const STATUS_STYLES: Record<GroupSubscription["status"], string> = {
  none: "text-osrs-parchment-dark/60",
  active: "text-osrs-green",
  trialing: "text-osrs-green",
  past_due: "text-osrs-red",
  canceled: "text-osrs-red",
  expired: "text-osrs-red",
};

function renderValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function GroupCompPanel({
  overview,
  tiers,
}: {
  overview: AdminGroupOverview;
  tiers: SubscriptionTier[];
}) {
  const { group } = overview;
  const [sub, setSub] = useState<GroupSubscription | null>(overview.subscription);
  const [tierKey, setTierKey] = useState(tiers[0]?.key ?? "");
  const [days, setDays] = useState(30);
  const [pending, startTransition] = useTransition();
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isActive = sub?.status === "active" || sub?.status === "trialing";
  const configEntries = Object.entries(overview.config_summary ?? {});
  const maxActivity = Math.max(1, ...overview.activity_7d.map((d) => d.submissions));

  const onGrant = () =>
    startTransition(async () => {
      setError(null);
      setNotice(null);
      try {
        const next = await grantComp(group.id, tierKey, days);
        setSub(next);
        setNotice(`Granted ${tierKey} for ${days} days.`);
      } catch (e) {
        setError((e as Error).message || "Failed to grant subscription.");
      }
    });

  const onRevoke = () =>
    startTransition(async () => {
      setError(null);
      setNotice(null);
      try {
        const next = await revokeComp(group.id);
        setSub(next);
        setConfirmRevoke(false);
        setNotice("Subscription revoked.");
      } catch (e) {
        setError((e as Error).message || "Failed to revoke subscription.");
        setConfirmRevoke(false);
      }
    });

  const field =
    "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-2 text-sm outline-none";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-osrs-gold text-2xl font-bold">{group.name}</div>
          <div className="text-osrs-parchment-dark/60 mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>ID #{group.id}</span>
            <span>{group.member_count} members</span>
            {group.guild_id && <span>Guild {group.guild_id}</span>}
            {group.wom_id != null && <span>WOM {group.wom_id}</span>}
          </div>
        </div>
        <Link
          href={`/groups/${group.id}/admin` as Route}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-3 py-1.5 text-sm font-medium"
        >
          Manage as admin →
        </Link>
      </div>

      {overview.warnings.length > 0 && (
        <ul className="border-osrs-red/40 bg-osrs-red/10 space-y-1 rounded border p-3 text-sm">
          {overview.warnings.map((w, i) => (
            <li key={i} className="text-osrs-red">
              {w}
            </li>
          ))}
        </ul>
      )}

      {/* Subscription status + comp controls */}
      <section className="border-osrs-bronze/30 space-y-4 rounded border p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-osrs-parchment-dark/70 text-xs uppercase tracking-wide">
              Current subscription
            </div>
            <div className="text-osrs-gold text-xl font-bold">
              {sub?.tier_key ?? "Free"}
              {sub?.provider === "manual" && (
                <span className="bg-osrs-gold/20 text-osrs-gold ml-2 rounded px-1.5 py-0.5 text-xs align-middle">
                  Comped
                </span>
              )}
            </div>
            <div className={`mt-1 text-sm capitalize ${STATUS_STYLES[sub?.status ?? "none"]}`}>
              {(sub?.status ?? "none").replace("_", " ")}
              {sub?.current_period_end && (
                <span className="text-osrs-parchment-dark/60">
                  {" · "}
                  {sub.cancel_at_period_end ? "ends" : "renews"} {formatDate(sub.current_period_end)}
                </span>
              )}
            </div>
          </div>

          {isActive && (
            <div className="flex items-center gap-2">
              {confirmRevoke ? (
                <>
                  <button
                    onClick={onRevoke}
                    disabled={pending}
                    className="bg-osrs-red/80 text-osrs-parchment hover:bg-osrs-red rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                  >
                    {pending ? "Revoking…" : "Confirm revoke"}
                  </button>
                  <button
                    onClick={() => setConfirmRevoke(false)}
                    disabled={pending}
                    className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmRevoke(true)}
                  className="text-osrs-red hover:bg-osrs-red/10 rounded px-3 py-1.5 text-sm"
                >
                  Revoke
                </button>
              )}
            </div>
          )}
        </div>

        {/* Grant a comped subscription */}
        <div className="border-osrs-bronze/20 flex flex-wrap items-end gap-3 border-t pt-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Tier</span>
            <select value={tierKey} onChange={(e) => setTierKey(e.target.value)} className={field}>
              {tiers.length === 0 && <option value="">No tiers</option>}
              {tiers.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Days</span>
            <input
              type="number"
              min={1}
              max={3650}
              value={days}
              onChange={(e) => setDays(Math.max(1, Number(e.target.value)))}
              className={`${field} w-24`}
            />
          </label>
          <button
            onClick={onGrant}
            disabled={pending || !tierKey}
            className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending ? "Granting…" : isActive ? "Grant / extend" : "Grant comp"}
          </button>
        </div>

        {notice && <p className="text-osrs-green text-sm">{notice}</p>}
        {error && <p className="text-osrs-red text-sm">{error}</p>}
      </section>

      {/* Activity */}
      {overview.activity_7d.length > 0 && (
        <section>
          <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
            Submissions (last 7 days)
          </h2>
          <div className="flex h-32 items-end gap-2">
            {overview.activity_7d.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="bg-osrs-bronze hover:bg-osrs-gold w-full rounded-t transition-colors"
                  style={{ height: `${(d.submissions / maxActivity) * 100}%` }}
                  title={`${d.date}: ${d.submissions}`}
                />
                <span className="text-osrs-parchment-dark/50 text-[10px]">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
          <p className="text-osrs-parchment-dark/50 mt-2 text-xs">
            Last submission: {formatDate(overview.last_submission_ts)}
          </p>
        </section>
      )}

      {/* Config summary */}
      {configEntries.length > 0 && (
        <section>
          <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
            Config summary
          </h2>
          <dl className="grid gap-2 sm:grid-cols-2">
            {configEntries.map(([k, v]) => (
              <div
                key={k}
                className="border-osrs-bronze/20 flex justify-between gap-3 rounded border px-3 py-2 text-sm"
              >
                <dt className="text-osrs-parchment-dark/60">{k}</dt>
                <dd className="max-w-[60%] truncate text-right">{renderValue(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
