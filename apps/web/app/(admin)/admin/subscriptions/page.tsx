/**
 * Superadmin monetization dashboard: MRR/lifetime KPIs, 12-month income from
 * the payments ledger, every subscription (group contribution legs + personal
 * supporters), and recent payments. Read-only; comps/tiers are managed on
 * /admin/groups and /admin/tiers.
 */
import type { Metadata } from "next";
import type { AdminPaymentRow, AdminSubscriptionRow } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Badge, EmptyState, SubscriptionStatusBadge, TierBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Subscriptions & revenue" };
export const dynamic = "force-dynamic";

const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-osrs-bronze/20 rounded border p-4">
      <dt className="text-osrs-parchment-dark/70 text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-osrs-gold-bright mt-1 text-2xl font-bold tabular-nums">{value}</dd>
      {hint && <p className="text-osrs-parchment-dark/50 mt-1 text-xs">{hint}</p>}
    </div>
  );
}

/** CSS bar chart — same pattern as the activity bars on /admin/groups. */
function IncomeBars({ months }: { months: { month: string; amount_cents: number }[] }) {
  if (!months.length) {
    return (
      <EmptyState
        title="No payments recorded yet"
        hint="The ledger fills as Stripe/PayPal payments arrive (and via the Stripe backfill)."
      />
    );
  }
  const max = Math.max(...months.map((m) => m.amount_cents), 1);
  return (
    <div className="border-osrs-bronze/20 rounded border p-4">
      <div className="flex items-end gap-2" style={{ height: 140 }}>
        {months.map((m) => (
          <div key={m.month} className="flex flex-1 flex-col items-center gap-1 self-stretch">
            <div className="flex w-full flex-1 items-end">
              <div
                className="bg-osrs-gold/70 w-full rounded-t"
                style={{ height: `${Math.max(2, (m.amount_cents / max) * 100)}%` }}
                title={`${m.month}: ${usd(m.amount_cents)}`}
              />
            </div>
            <span className="text-osrs-parchment-dark/50 text-[10px] whitespace-nowrap">
              {m.month.slice(5)}
            </span>
          </div>
        ))}
      </div>
      <p className="text-osrs-parchment-dark/50 mt-2 text-right text-xs">
        Net income by month (payments − refunds), last 12 months
      </p>
    </div>
  );
}

function ownerLabel(row: AdminSubscriptionRow | AdminPaymentRow): string {
  if (row.scope === "group") {
    const payer = row.user_name ? ` · ${row.user_name}` : "";
    return `${row.group_name ?? `Group ${row.group_id}`}${payer}`;
  }
  return row.user_name ?? `User ${row.user_id}`;
}

function SubsTable({ rows }: { rows: AdminSubscriptionRow[] }) {
  if (!rows.length) return <EmptyState title="No subscriptions yet" />;
  return (
    <div className="border-osrs-bronze/20 overflow-x-auto rounded border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-osrs-gold/80 text-left">
            <th className="px-3 py-2">Who</th>
            <th className="px-3 py-2">Scope</th>
            <th className="px-3 py-2">Tier</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2">Provider</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Renews</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={`${r.scope}-${r.id}`}
              className={`border-osrs-bronze/20 border-t ${r.live ? "" : "opacity-60"}`}
            >
              <td className="px-3 py-2">{ownerLabel(r)}</td>
              <td className="px-3 py-2">
                <Badge tone={r.scope === "group" ? "bronze" : "sky"}>
                  {r.scope === "group" ? "Group" : "Supporter"}
                </Badge>
              </td>
              <td className="px-3 py-2">
                {r.tier_key ? <TierBadge tierKey={r.tier_key} /> : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                {r.amount_cents != null ? `${usd(r.amount_cents)}/mo` : "—"}
              </td>
              <td className="px-3 py-2 capitalize">{r.provider ?? "—"}</td>
              <td className="px-3 py-2">
                <SubscriptionStatusBadge status={r.status} />
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {r.current_period_end ? (
                  <span className={r.cancel_at_period_end ? "text-osrs-red" : ""}>
                    {r.cancel_at_period_end ? "ends " : ""}
                    {formatDate(r.current_period_end)}
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentsTable({ rows }: { rows: AdminPaymentRow[] }) {
  if (!rows.length) return <EmptyState title="No payments recorded yet" />;
  return (
    <div className="border-osrs-bronze/20 overflow-x-auto rounded border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-osrs-gold/80 text-left">
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Who</th>
            <th className="px-3 py-2">Tier</th>
            <th className="px-3 py-2">Provider</th>
            <th className="px-3 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-osrs-bronze/20 border-t">
              <td className="px-3 py-2 whitespace-nowrap">
                {p.paid_at ? formatDate(p.paid_at) : "—"}
              </td>
              <td className="px-3 py-2">{ownerLabel(p)}</td>
              <td className="px-3 py-2">{p.tier_key ?? "—"}</td>
              <td className="px-3 py-2 capitalize">{p.provider}</td>
              <td
                className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${
                  p.kind === "payment" ? "text-osrs-green" : "text-osrs-red"
                }`}
              >
                {p.kind === "payment" ? "+" : "−"}
                {usd(p.amount_cents)}
                {p.kind !== "payment" && (
                  <span className="text-osrs-parchment-dark/60 ml-1 text-xs">({p.kind})</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminSubscriptionsPage() {
  const data = await api.adminSubscriptionsOverview();
  const { kpis } = data;
  const live = data.subscriptions.filter((s) => s.live);
  const lapsed = data.subscriptions.filter((s) => !s.live);

  return (
    <div className="space-y-8">
      <h1 className="text-osrs-gold text-3xl font-bold">Subscriptions &amp; revenue</h1>

      <section>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Kpi
            label="MRR"
            value={usd(kpis.mrr_cents)}
            hint={`Groups ${usd(kpis.group_mrr_cents)} · supporters ${usd(kpis.user_mrr_cents)}`}
          />
          <Kpi label="Lifetime income" value={usd(kpis.lifetime_cents)} hint="From the payments ledger" />
          <Kpi label="Paying groups" value={String(kpis.paying_groups)} />
          <Kpi label="Supporters" value={String(kpis.active_user_subscriptions)} />
        </dl>
        {kpis.past_due > 0 && (
          <p className="text-osrs-red mt-2 text-sm">
            {kpis.past_due} subscription{kpis.past_due === 1 ? "" : "s"} past due.
          </p>
        )}
        {data.tier_distribution.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-osrs-parchment-dark/60">Groups by tier:</span>
            {data.tier_distribution.map((t) => (
              <span key={t.tier_key} className="inline-flex items-center gap-1">
                <TierBadge tierKey={t.tier_key} name={t.tier_name} />
                <span className="tabular-nums">×{t.groups}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">Income</h2>
        <IncomeBars months={data.income_by_month} />
      </section>

      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
          Active subscriptions
        </h2>
        <SubsTable rows={live} />
      </section>

      {lapsed.length > 0 && (
        <section>
          <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
            Lapsed &amp; winding down
          </h2>
          <SubsTable rows={lapsed} />
        </section>
      )}

      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
          Recent payments
        </h2>
        <PaymentsTable rows={data.recent_payments} />
      </section>
    </div>
  );
}
