import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { resolveRef } from "@/lib/entity-ref";
import { RecapCard, formatPeriod } from "@/components/recap-card";
import { Card } from "@/components/ui";

/**
 * A clan's recap for one period — the permanent artifact a Discord post links
 * to. Deliberately never expires: each period keeps its own URL rather than
 * being replaced by the current one, which is the behaviour that made Steam
 * Replay's pinned-to-profile archive stick (and the absence of which is a
 * standing complaint about it deleting old years).
 *
 * Everything shown was frozen into `recap_snapshots` when the card was
 * generated, so this route is a single indexed row read — no aggregation, and
 * no risk of the numbers shifting under a link someone shared months ago.
 */
export const revalidate = 3600;

type Params = Promise<{ id: string; period: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, period } = await params;
  const ref = await resolveRef("group", id).catch(() => null);
  if (!ref || ref.ambiguous) return { title: "Recap" };
  const recap = await api.recap("group", ref.id, period);
  if (!recap) return { title: "Recap" };

  const name = recap.subject?.name ?? "Clan";
  const title = `${name} — ${formatPeriod(period)} recap`;
  return {
    title,
    description: `What ${name} looted in ${formatPeriod(period)}, tracked by DropTracker.`,
    openGraph: { title, type: "article" },
  };
}

export default async function GroupRecapPage({ params }: { params: Params }) {
  const { id, period } = await params;
  const ref = await resolveRef("group", id).catch(() => null);
  if (!ref || ref.ambiguous) notFound();

  const [recap, index] = await Promise.all([
    api.recap("group", ref.id, period),
    api.recapIndex("group", ref.id),
  ]);
  if (!recap) notFound();

  // Newest first, and the current period dropped from its own switcher.
  const others = (index?.periods ?? []).filter((p) => p.period !== period).slice(0, 12);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Card>
        <RecapCard recap={recap} />
      </Card>

      {others.length > 0 && (
        <Card className="mt-4">
          <h2 className="text-osrs-parchment/80 mb-3 text-sm font-semibold tracking-wide uppercase">
            Other periods
          </h2>
          <div className="flex flex-wrap gap-2">
            {others.map((p) => (
              <Link
                key={p.period}
                href={`/groups/${ref.id}/recap/${p.period}` as Route}
                className="border-osrs-bronze/40 hover:border-osrs-gold text-osrs-parchment-dark hover:text-osrs-gold-bright rounded-lg border px-3 py-1.5 text-sm transition-colors"
              >
                {formatPeriod(p.period)}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="text-osrs-parchment-dark/50 mt-4 text-center text-xs">
        <Link href={`/groups/${ref.id}`} className="hover:text-osrs-gold-bright">
          Back to {recap.subject?.name ?? "the clan"}
        </Link>
      </div>
    </div>
  );
}
