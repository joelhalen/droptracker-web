/**
 * Clan bank card on a group's public page (web131a): the balance, what has
 * come in and gone out, the top donors and the latest activity. Donor names
 * and activity are left out when the group hides them (the backend sends
 * null). Server-safe: no hooks.
 */
import type { Route } from "next";
import Link from "next/link";
import { BANK_KIND_LABELS, type GroupBankEntry, type GroupBankSummary } from "@droptracker/api-types";
import { Card } from "@/components/ui";
import { CountUp } from "@/components/count-up";
import { GpAmount } from "@/components/gp-amount";
import { entityPath } from "@/lib/slug";
import { formatDate } from "@/lib/format";

const RECENT_SHOWN = 5;

function Name({ playerId, rsn }: { playerId: number | null; rsn: string | null }) {
  if (!rsn) return <span className="text-osrs-parchment-dark/60">Someone</span>;
  if (playerId == null) return <span>{rsn}</span>;
  return (
    <Link href={entityPath("players", playerId, rsn) as Route} className="hover:text-osrs-gold-bright">
      {rsn}
    </Link>
  );
}

function activityLine(e: GroupBankEntry) {
  if (e.kind === "donation") {
    return (
      <>
        <Name playerId={e.player_id} rsn={e.rsn} /> donated
      </>
    );
  }
  if (e.kind === "event_transfer") return <>Moved to {e.event_name ?? "an event"}</>;
  if (e.kind === "payout") {
    return (
      <>
        Paid to <Name playerId={e.player_id} rsn={e.rsn} />
      </>
    );
  }
  return <>{BANK_KIND_LABELS[e.kind]}</>;
}

export function GroupBankPanel({
  bank,
  manageHref,
}: {
  bank: GroupBankSummary;
  /** The admin Bank tab, for viewers who can manage it. */
  manageHref?: string | null;
}) {
  const balance = bank.balance ?? { value: 0, value_formatted: "0" };
  const recent = (bank.recent ?? []).slice(0, RECENT_SHOWN);
  const donors = bank.top_donors ?? [];
  return (
    <section className="rise-in">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="heading-rule text-osrs-gold flex-1 pb-1 text-lg font-semibold">Clan bank</h2>
        {manageHref && (
          <Link
            href={manageHref as Route}
            className="text-osrs-parchment-dark/70 shrink-0 text-sm hover:text-osrs-gold-bright"
          >
            Manage bank →
          </Link>
        )}
      </div>
      <Card padding="p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-osrs-parchment-dark/60 text-xs tracking-wide uppercase">Balance</div>
            <div
              className={`text-3xl font-bold tabular-nums ${balance.value < 0 ? "text-osrs-red" : "text-osrs-gold-bright"}`}
            >
              <CountUp value={balance.value} formatted={balance.value_formatted} /> gp
            </div>
          </div>
          <dl className="flex gap-6 text-sm">
            <div>
              <dt className="text-osrs-parchment-dark/60 text-xs">Donated</dt>
              <dd className="text-osrs-green font-semibold tabular-nums">
                {bank.donated_total?.value_formatted ?? "0"}
              </dd>
            </div>
            <div>
              <dt className="text-osrs-parchment-dark/60 text-xs">Paid out</dt>
              <dd className="font-semibold tabular-nums">{bank.paid_out_total?.value_formatted ?? "0"}</dd>
            </div>
            <div>
              <dt className="text-osrs-parchment-dark/60 text-xs">Donors</dt>
              <dd className="font-semibold tabular-nums">{bank.donor_count}</dd>
            </div>
          </dl>
        </div>

        {(donors.length > 0 || recent.length > 0) && (
          <div className="border-osrs-bronze/15 mt-5 grid gap-6 border-t pt-4 md:grid-cols-2">
            {donors.length > 0 && (
              <div className="min-w-0">
                <h3 className="text-osrs-parchment-dark/70 mb-2 text-xs font-semibold tracking-wide uppercase">
                  Top donors
                </h3>
                <ol className="space-y-1.5 text-sm">
                  {donors.slice(0, 5).map((d, i) => (
                    <li key={`${d.player_id ?? d.rsn}-${i}`} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">
                        <span className="text-osrs-parchment-dark/50 mr-2 tabular-nums">{i + 1}.</span>
                        <Name playerId={d.player_id} rsn={d.rsn} />
                      </span>
                      <GpAmount money={d.total} />
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {recent.length > 0 && (
              <div className="min-w-0">
                <h3 className="text-osrs-parchment-dark/70 mb-2 text-xs font-semibold tracking-wide uppercase">
                  Recent activity
                </h3>
                <ul className="space-y-1.5 text-sm">
                  {recent.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">
                        {activityLine(e)}
                        <span className="text-osrs-parchment-dark/50 ml-2 text-xs">{formatDate(e.created_at)}</span>
                      </span>
                      <span
                        className={`shrink-0 tabular-nums ${e.amount.value < 0 ? "text-osrs-red" : "text-osrs-green"}`}
                      >
                        {e.amount.value < 0 ? "" : "+"}
                        {e.amount.value_formatted}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}
