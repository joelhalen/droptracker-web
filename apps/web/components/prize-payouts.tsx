"use client";

/**
 * Payouts card for the Prize Pot tab: the reverse of the buy-in checklist.
 * Shows which teams (or players, on an individual SOTW/BOTW) finished in a
 * paid place under the pot's distribution rule, and what each member is owed.
 * Admin-only read (GET /events/{id}/payouts, services/event_payouts.py).
 *
 * Advisory like the rest of the pot: nothing here moves GP. The "Copy list"
 * button hands the admin a plain-text list to work through in-game.
 */
import { useEffect, useState } from "react";
import type {
  EventPayouts,
  EventPayoutWinner,
  Money,
} from "@droptracker/api-types";
import { Badge, Card, EmptyState } from "@/components/ui";
import { GpAmount } from "@/components/gp-amount";
import { fetchEventPayouts } from "@/app/(site)/(admin)/groups/[id]/events/actions";

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Exact GP ("90,750,000"): the abbreviated figure is fine for reading, but
 * the trade window needs the real number. */
function exact(m: Money): string {
  return `${m.value.toLocaleString()} gp`;
}

function ruleSummary(p: EventPayouts): string {
  if (p.individual && p.distribution === "first_only") return "Winner takes all";
  const who = p.individual ? "players" : "teams";
  if (p.distribution === "top_n") {
    return p.top_n > 1 ? `Split evenly across the top ${p.top_n} ${who}` : "Winner takes all";
  }
  if (p.distribution === "custom_split") {
    return p.splits.length > 1 ? `Split ${p.splits.join(" / ")}% by place` : "Winner takes all";
  }
  return "Winner takes all";
}

function copyText(p: EventPayouts): string {
  const lines: string[] = [];
  for (const w of p.winners) {
    lines.push(`${ordinal(w.place)}${w.tied ? " (tied)" : ""} ${w.name}: ${exact(w.amount)}`);
    if (p.individual) continue;
    for (const m of w.members) {
      if (m.eligible) lines.push(`  ${m.player_name}: ${exact(m.amount)}`);
    }
  }
  return lines.join("\n");
}

function WinnerBlock({
  w,
  individual,
  expectBuyins,
}: {
  w: EventPayoutWinner;
  individual: boolean;
  expectBuyins: boolean;
}) {
  const eligible = w.members.filter((m) => m.eligible).length;
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-10 shrink-0 text-lg" aria-label={`${ordinal(w.place)} place`}>
          {MEDALS[w.place] ?? <span className="text-osrs-parchment-dark/70 text-sm">{ordinal(w.place)}</span>}
        </span>
        <span className="min-w-0 flex-1 truncate font-bold">{w.name}</span>
        {w.tied && (
          <Badge variant="bronze" size="sm">
            Tied
          </Badge>
        )}
        <span className="text-osrs-parchment-dark/60 text-xs tabular-nums">{w.share_pct}%</span>
        <span className="text-osrs-gold-bright font-bold tabular-nums" title={exact(w.amount)}>
          <GpAmount money={w.amount} />
        </span>
      </div>

      {!individual && (
        <div className="mt-2 pl-0 sm:pl-[3.25rem]">
          {w.members.length === 0 ? (
            <p className="text-osrs-parchment-dark/50 text-xs">This team has no members to pay.</p>
          ) : (
            <>
              <p className="text-osrs-parchment-dark/60 mb-1 text-xs">
                {eligible > 0
                  ? `${exact(w.members.find((m) => m.eligible)!.amount)} each to ${eligible} ${
                      eligible === 1 ? "member" : "members"
                    }`
                  : "No member qualifies for a share."}
              </p>
              <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                {w.members.map((m) => (
                  <li
                    key={m.player_id}
                    className={`flex min-w-0 items-center justify-between gap-2 py-0.5 text-sm ${
                      m.eligible ? "" : "opacity-50"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{m.player_name}</span>
                      {!m.took_part && (
                        <Badge variant="neutral" size="sm" title="No credited progress or tracked kills in this event">
                          Inactive
                        </Badge>
                      )}
                      {expectBuyins && !m.paid_buyin && (
                        <Badge variant="red" size="sm" title="No paid buy-in recorded for this player">
                          No buy-in
                        </Badge>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums" title={exact(m.amount)}>
                      {m.amount.value_formatted}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export function PrizePayouts({
  groupId,
  eventId,
  refreshKey,
  expectBuyins,
}: {
  groupId: number | null;
  eventId: number;
  /** The pot takes buy-ins (vs donations only): flag members with none paid. */
  expectBuyins: boolean;
  /** Anything that changes the pot (total, rule): refetches when it moves. */
  refreshKey: string;
}) {
  const [data, setData] = useState<EventPayouts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchEventPayouts(groupId, eventId)
      .then((p) => alive && (setData(p), setError(null)))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed to load payouts."));
    return () => {
      alive = false;
    };
  }, [groupId, eventId, refreshKey]);

  return <PayoutsView data={data} error={error} expectBuyins={expectBuyins} />;
}

/** The card itself, data in hand. Split from the fetching wrapper so it
 * renders (and can be previewed) from a plain payload. */
export function PayoutsView({
  data,
  error = null,
  expectBuyins,
}: {
  data: EventPayouts | null;
  error?: string | null;
  expectBuyins: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-osrs-gold text-sm font-semibold">Payouts</h4>
        {data &&
          (data.final ? (
            <Badge variant="green" size="sm">
              Final
            </Badge>
          ) : (
            <Badge variant="ember" size="sm" title="Standings can still change until the event ends">
              Live preview
            </Badge>
          ))}
      </div>
      <p className="text-osrs-parchment-dark/60 mb-3 text-xs">
        Who gets paid and how much, from the current pot and your payout rule. Pay these out in-game.
      </p>

      {(error || copyError) && <p className="text-osrs-red text-sm">{error ?? copyError}</p>}
      {!data && !error && <p className="text-osrs-parchment-dark/60 text-sm">Working out payouts…</p>}

      {data && (
        <>
          <div className="bg-osrs-surface-2/60 mb-3 flex flex-wrap items-center justify-between gap-2 rounded px-3 py-2 text-sm">
            <span>{ruleSummary(data)}</span>
            <span className="tabular-nums">
              <GpAmount money={data.total} /> pot
            </span>
          </div>

          {data.total.value === 0 ? (
            <EmptyState title="Nothing to pay out yet" hint="Only paid buy-ins and donations count toward the pot." />
          ) : data.winners.length === 0 ? (
            <EmptyState
              title={data.final ? "No one placed" : "No one has placed yet"}
              hint="A team or player needs a score above zero to finish in a paid place."
            />
          ) : (
            <ul className="divide-osrs-bronze/10 divide-y">
              {data.winners.map((w) => (
                <WinnerBlock
                  key={`${w.kind}:${w.id}`}
                  w={w}
                  individual={data.individual}
                  expectBuyins={expectBuyins}
                />
              ))}
            </ul>
          )}

          {(data.unclaimed.value > 0 || data.unallocated.value > 0 || data.rounding.value > 0) && (
            <ul className="text-osrs-parchment-dark/60 mt-3 space-y-0.5 text-xs">
              {data.unclaimed.value > 0 && (
                <li>
                  Unclaimed: {exact(data.unclaimed)} for{" "}
                  {data.unclaimed_places.map(ordinal).join(", ")} place (no one finished there).
                </li>
              )}
              {data.unallocated.value > 0 && (
                <li>Not assigned: {exact(data.unallocated)} (a placed team has no member who qualifies).</li>
              )}
              {data.rounding.value > 0 && <li>Left over from rounding to whole GP: {exact(data.rounding)}.</li>}
            </ul>
          )}

          {data.winners.length > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(copyText(data));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    setCopyError("Couldn't copy to the clipboard.");
                  }
                }}
                className="border-osrs-bronze/30 hover:border-osrs-gold/40 rounded border px-3 py-1.5 text-sm"
              >
                Copy payout list
              </button>
              {copied && <span className="text-osrs-green text-xs">Copied.</span>}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
