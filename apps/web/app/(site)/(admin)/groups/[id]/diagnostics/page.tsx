import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GROUP_DIAGNOSTICS_RANGES } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { requireGroupAdminPage } from "@/lib/auth";
import { entityPath } from "@/lib/slug";
import { formatGp, formatRelativeTime } from "@/lib/format";
import { trendLabel } from "@/lib/diagnostics";
import { Card, EmptyState, StatTile } from "@/components/ui";
import { ActivityChart, ActivityHeatmap } from "@/components/group-diagnostics";

export const metadata: Metadata = { title: "Diagnostics" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ days?: string }>;

const DEFAULT_RANGE = 30;

function resolveRange(raw: string | undefined): number {
  const n = Number(raw);
  return (GROUP_DIAGNOSTICS_RANGES as readonly number[]).includes(n) ? n : DEFAULT_RANGE;
}

export default async function GroupDiagnosticsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, { days }] = await Promise.all([params, searchParams]);
  const groupId = Number(id);
  await requireGroupAdminPage(groupId); // web64a: event managers only reach Events
  if (!Number.isFinite(groupId)) notFound();

  const range = resolveRange(days);
  const diag = await api.diagnostics(groupId, range);

  const totals = diag.totals;
  const prev = diag.previous_totals;
  const coverage = diag.coverage;
  const windowLabel = `last ${range} days`;
  // A staggered deploy can leave this page talking to a Web API that predates
  // the richer payload; every added field defaults, so the panel degrades to
  // the heartbeat rather than throwing.
  const hasActivity = diag.daily.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {GROUP_DIAGNOSTICS_RANGES.map((n) => (
            <Link
              key={n}
              href={`/groups/${groupId}/diagnostics?days=${n}` as Route}
              scroll={false}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                n === range
                  ? "bg-osrs-gold/20 text-osrs-gold-bright"
                  : "text-osrs-parchment-dark/60 hover:text-osrs-parchment"
              }`}
            >
              {n} days
            </Link>
          ))}
        </div>
        {diag.generated_ts != null && (
          <span className="text-osrs-parchment-dark/40 text-xs">
            Updated {formatRelativeTime(diag.generated_ts)} · cached for 2 minutes
          </span>
        )}
      </div>

      {/* Not <Alert>: it renders a <p>, and a list inside a paragraph is
          invalid markup that React re-parents during hydration. */}
      {diag.warnings.length > 0 && (
        <div
          role="status"
          className="border-osrs-red/40 bg-osrs-red/10 text-osrs-red rounded border px-3 py-2"
        >
          <ul className="list-inside list-disc space-y-1 text-sm">
            {diag.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {diag.channel_problems.length > 0 && (
        <div
          role="status"
          className="border-osrs-red/40 bg-osrs-red/10 rounded border px-4 py-3 text-sm"
        >
          <p className="text-osrs-red font-semibold">Some boards have stopped updating</p>
          <ul className="text-osrs-parchment mt-2 space-y-2">
            {diag.channel_problems.map((p) => (
              <li key={p.feature}>
                <span className="font-medium">{p.label}</span> lives in the thread{" "}
                <span className="font-medium">&ldquo;{p.thread_name || "unnamed"}&rdquo;</span>,
                which Discord archived.{" "}
                {p.locked ? (
                  <>
                    The thread is also locked, and only members with the{" "}
                    <strong>Manage Threads</strong> permission can reopen a locked thread. Give the
                    DropTracker bot Manage Threads in that channel, or unlock the thread.
                  </>
                ) : (
                  <>
                    The bot isn&apos;t allowed to reopen it. Give the DropTracker bot{" "}
                    <strong>Send Messages in Threads</strong> in that channel.
                  </>
                )}{" "}
                <span className="text-osrs-parchment-dark/60 text-xs">
                  Checked {formatRelativeTime(p.checked_at)}.
                </span>
              </li>
            ))}
          </ul>
          <p className="text-osrs-parchment-dark/70 mt-2 text-xs">
            Discord archives a thread after a few days without new messages, and the bot editing its
            board doesn&apos;t count. The bot reopens archived threads by itself when it&apos;s
            allowed to, so once this is fixed you won&apos;t need to do it again.
          </p>
        </div>
      )}

      {/* ---- Pipeline heartbeat ------------------------------------------ */}
      <section>
        <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
          Pipeline
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Intake"
            value={
              <span className={diag.intake_healthy ? "text-osrs-green" : "text-osrs-red"}>
                {diag.intake_healthy ? "Healthy" : "Silent"}
              </span>
            }
            hint={diag.intake_healthy ? "tracked a drop in the last 24h" : "nothing in 24h"}
          />
          <StatTile
            label="Last tracked"
            value={formatRelativeTime(diag.last_submission_ts)}
            hint="any member, any submission"
          />
          <StatTile
            label="Last Discord post"
            value={formatRelativeTime(diag.last_announcement_ts)}
            hint="announcement sent to your server"
          />
          <StatTile
            label="Members synced"
            value={formatRelativeTime(diag.members_synced_ts)}
            hint="WiseOldMan roster reconcile"
          />
        </div>
      </section>

      {/* ---- Volume ------------------------------------------------------ */}
      {hasActivity && totals && (
        <section>
          <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
            Activity — {windowLabel}
          </h2>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Drops tracked"
              value={totals.drops.toLocaleString()}
              hint={trendLabel(totals.drops, prev?.drops) ?? undefined}
            />
            <StatTile
              label="Loot tracked"
              value={formatGp(totals.gp)}
              hint={trendLabel(totals.gp, prev?.gp) ?? undefined}
            />
            <StatTile
              label="Active players"
              value={totals.active_players.toLocaleString()}
              hint={trendLabel(totals.active_players, prev?.active_players) ?? undefined}
            />
            <StatTile
              label="Discord posts"
              value={totals.announcements.toLocaleString()}
              hint="drops that cleared your announce threshold"
            />
          </div>
          <Card>
            <ActivityChart daily={diag.daily} />
          </Card>
        </section>
      )}

      {/* ---- Coverage ---------------------------------------------------- */}
      {coverage && coverage.roster > 0 && (
        <section>
          <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
            Plugin coverage
          </h2>
          <Card>
            <CoverageBar
              roster={coverage.roster}
              active7d={coverage.active_7d}
              active30d={coverage.active_30d}
              trackedEver={coverage.tracked_ever}
            />
            <p className="text-osrs-parchment-dark/60 mt-4 text-xs">
              {coverage.tracked_ever.toLocaleString()} of {coverage.roster.toLocaleString()}{" "}
              members on the roster have ever sent us a drop
              {coverage.tracked_ever < coverage.roster && (
                <>
                  {" "}
                  — the other {(coverage.roster - coverage.tracked_ever).toLocaleString()} have
                  either never installed the plugin or never configured their group token
                </>
              )}
              .
              {coverage.hidden > 0 && (
                <>
                  {" "}
                  {coverage.hidden.toLocaleString()} member
                  {coverage.hidden === 1 ? " has" : "s have"} opted out of public display, so
                  they are counted here but never named.
                </>
              )}
              {coverage.ignored > 0 && (
                <>
                  {" "}
                  {coverage.ignored.toLocaleString()} member
                  {coverage.ignored === 1 ? " is" : "s are"} on this group&apos;s ignore list.
                </>
              )}
            </p>
          </Card>
        </section>
      )}

      {/* ---- When the clan plays ----------------------------------------- */}
      {diag.hour_matrix.length > 0 && (
        <section>
          <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
            When your clan plays
          </h2>
          <Card>
            <ActivityHeatmap matrix={diag.hour_matrix} />
            <p className="text-osrs-parchment-dark/50 mt-4 text-xs">
              Drops tracked per weekday and hour across the {windowLabel}. Useful for picking a
              time to schedule events, mass drops, or clan meetings.
            </p>
          </Card>
        </section>
      )}

      {/* ---- What is being submitted ------------------------------------- */}
      {diag.kinds.length > 0 && (
        <section>
          <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
            Submission types — {windowLabel}
          </h2>
          <Card padding="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-osrs-bronze/20 text-osrs-parchment-dark/60 border-b text-left text-xs uppercase">
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 text-right font-medium">Count</th>
                  <th className="px-4 py-2 text-right font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-osrs-bronze/10 divide-y">
                {diag.kinds.map((k) => (
                  <tr key={k.key} className={k.count === 0 ? "text-osrs-parchment-dark/40" : ""}>
                    <td className="px-4 py-2">{k.label}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {k.count.toLocaleString()}
                    </td>
                    <td className="text-osrs-parchment-dark/60 px-4 py-2 text-right">
                      {k.last_ts ? formatRelativeTime(k.last_ts) : "never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}

      {/* ---- Who and where ----------------------------------------------- */}
      {(diag.top_players.length > 0 || diag.top_npcs.length > 0) && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
              Top contributors
            </h2>
            {diag.top_players.length === 0 ? (
              <EmptyState title="Nobody tracked in this window" />
            ) : (
              <Card padding="p-2">
                <RankedList
                  rows={diag.top_players.map((p) => ({
                    key: p.player_id,
                    href: entityPath("players", p.player_id, p.player_name),
                    name: p.player_name,
                    value: formatGp(p.gp),
                    sub: `${p.drops.toLocaleString()} drops`,
                  }))}
                />
              </Card>
            )}
          </div>
          <div>
            <h2 className="heading-rule text-osrs-gold mb-4 pb-1 text-lg font-semibold">
              Top sources
            </h2>
            {diag.top_npcs.length === 0 ? (
              <EmptyState title="No tracked sources in this window" />
            ) : (
              <Card padding="p-2">
                <RankedList
                  rows={diag.top_npcs.map((n) => ({
                    key: n.npc_id,
                    href: entityPath("npcs", n.npc_id, n.npc_name),
                    name: n.npc_name,
                    value: formatGp(n.gp),
                    sub: `${n.drops.toLocaleString()} drops`,
                  }))}
                />
              </Card>
            )}
          </div>
        </section>
      )}

      {!hasActivity && !diag.oversized && (
        <EmptyState
          title="No activity data yet"
          hint="Once members install the plugin and submit, this page fills in with daily volume, coverage and play-time charts."
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function CoverageBar({
  roster,
  active7d,
  active30d,
  trackedEver,
}: {
  roster: number;
  active7d: number;
  active30d: number;
  trackedEver: number;
}) {
  // Nested, not stacked: each band is a subset of the one behind it (everyone
  // active this week was also active this month), so stacking would triple-count
  // the same people and overflow the roster.
  const pct = (n: number) => `${Math.min(100, (n / Math.max(1, roster)) * 100)}%`;
  const bands = [
    { label: "Ever tracked", n: trackedEver, className: "bg-osrs-bronze/60" },
    { label: "Active 30d", n: active30d, className: "bg-osrs-gold/70" },
    { label: "Active 7d", n: active7d, className: "bg-osrs-gold-bright" },
  ];
  return (
    <div>
      <div className="bg-osrs-surface-2 relative h-6 w-full overflow-hidden rounded">
        {bands.map((b) => (
          <div
            key={b.label}
            className={`absolute inset-y-0 left-0 ${b.className}`}
            style={{ width: pct(b.n) }}
          />
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Legend label="Roster" value={roster} swatch="bg-osrs-surface-2" />
        {bands
          .slice()
          .reverse()
          .map((b) => (
            <Legend key={b.label} label={b.label} value={b.n} swatch={b.className} />
          ))}
      </dl>
    </div>
  );
}

function Legend({ label, value, swatch }: { label: string; value: number; swatch: string }) {
  return (
    <div>
      <dt className="text-osrs-parchment-dark/60 flex items-center gap-1.5 text-xs">
        <span className={`inline-block size-2.5 rounded-sm ${swatch}`} aria-hidden />
        {label}
      </dt>
      <dd className="text-osrs-gold-bright mt-0.5 font-semibold tabular-nums">
        {value.toLocaleString()}
      </dd>
    </div>
  );
}

function RankedList({
  rows,
}: {
  rows: { key: number; href: Route; name: string; value: string; sub: string }[];
}) {
  return (
    <ol className="divide-osrs-bronze/10 divide-y">
      {rows.map((r, i) => (
        <li key={r.key} className="flex items-center gap-3 px-2 py-2">
          <span className="text-osrs-parchment-dark/40 w-4 shrink-0 text-right text-xs tabular-nums">
            {i + 1}
          </span>
          <Link
            href={r.href}
            className="hover:text-osrs-gold-bright min-w-0 flex-1 truncate text-sm font-medium transition-colors"
          >
            {r.name}
          </Link>
          <span className="shrink-0 text-right">
            <span className="text-osrs-gold-bright block text-sm font-semibold tabular-nums">
              {r.value}
            </span>
            <span className="text-osrs-parchment-dark/50 block text-[11px]">{r.sub}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
