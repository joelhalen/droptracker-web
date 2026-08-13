import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { resolveRef } from "@/lib/entity-ref";
import { ClanLogBoard } from "@/components/clan-log-board";
import { formatClanLogPeriod } from "@/lib/clan-log";
import { Card } from "@/components/ui";

/**
 * A clan's unique-completion board — every boss's uniques, obtained or missing.
 *
 * The question suggestion #112 asked that the recap could not answer: a recap
 * shows the year's best loot, this shows the whole list and what is still
 * outstanding. Everything rendered was frozen into a snapshot by
 * `services/clan_log`, so the page is one indexed row read.
 */
export const revalidate = 300;

type Params = Promise<{ id: string }>;
type Search = Promise<{ period?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const ref = await resolveRef("group", id).catch(() => null);
  if (!ref || ref.ambiguous) return { title: "Clan Log" };
  const board = await api.clanLog(ref.id);
  if (!board) return { title: "Clan Log" };
  const title = `Clan Log — ${board.summary.obtained}/${board.summary.total} uniques`;
  return {
    title,
    description:
      "Every boss unique this clan has obtained, and the ones still missing, tracked by DropTracker.",
    openGraph: { title, type: "article" },
  };
}

export default async function GroupClanLogPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const { period: rawPeriod } = await searchParams;
  const period = rawPeriod ?? "all";

  const ref = await resolveRef("group", id).catch(() => null);
  if (!ref || ref.ambiguous) notFound();

  const [board, periods] = await Promise.all([
    api.clanLog(ref.id, period),
    api.clanLogPeriods(ref.id),
  ]);
  if (!board) notFound();

  const base = `/groups/${ref.id}`;

  return (
    <div className="mx-auto max-w-[1140px] px-4 py-8">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-osrs-gold-bright text-2xl font-bold">Clan Log</h1>
          <p className="text-osrs-parchment-dark mt-1 text-sm">
            Every boss unique we track, and who in the clan pulled it.
          </p>
        </div>
        <Link
          href={base as Route}
          className="text-osrs-parchment-dark hover:text-osrs-gold-bright text-sm"
        >
          Back to the clan
        </Link>
      </div>

      {periods.length > 1 && (
        <Card className="mb-4" padding="p-3">
          <div className="flex flex-wrap gap-2">
            {periods.slice(0, 18).map((p) => (
              <Link
                key={p}
                href={`${base}/log?period=${encodeURIComponent(p)}` as Route}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  p === period
                    ? "border-osrs-gold text-osrs-gold-bright bg-osrs-gold/10"
                    : "border-osrs-bronze/40 text-osrs-parchment-dark hover:border-osrs-gold hover:text-osrs-gold-bright"
                }`}
              >
                {formatClanLogPeriod(p)}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <ClanLogBoard board={board} />

      <p className="text-osrs-parchment-dark/50 mt-4 text-center text-xs">
        A slot counts as obtained when a tracked drop, collection-log unlock or pet
        submission named it. Anything obtained before the clan started tracking is shown
        as not seen.
      </p>
    </div>
  );
}
