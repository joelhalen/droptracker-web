import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { resolveRef } from "@/lib/entity-ref";
import { RecapCard, formatPeriod } from "@/components/recap-card";
import { Card } from "@/components/ui";

/**
 * A player's recap for one period — the personal counterpart to
 * `/groups/{id}/recap/{period}`, and the same permanent artifact: each period
 * keeps its own URL rather than being replaced by the current one.
 *
 * The period segment is optional (`[[...period]]`), because the useful link to
 * hand someone is `/players/{id}/recap` — no date to get wrong. With no period
 * it shows the newest card the player has, falling back to the last completed
 * month for someone who has never had one generated.
 *
 * Unlike clan cards, player cards are not pre-generated: there are thousands of
 * players a month and almost none of those cards would ever be opened. The API
 * computes one the first time this page asks for it and stores it from then on,
 * so a cold view costs a second or two and every later view is a single row read.
 */
export const revalidate = 3600;

type Params = Promise<{ id: string; period?: string[] }>;

/** The most recent month that has finished, in the card's `YYYY-MM` form. */
function lastCompletedMonth(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed, so this is already last month
  return month === 0
    ? `${year - 1}-12`
    : `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * `["2026-06"]` → the period; `[]`/undefined → null, meaning "pick one";
 * anything longer is not a recap URL at all (`false`), which the page turns into
 * a 404 and metadata into a generic title.
 */
function periodFromSegments(segments?: string[]): string | null | false {
  if (!segments || segments.length === 0) return null;
  if (segments.length > 1) return false;
  return segments[0] ?? null;
}

async function resolvePeriod(playerId: number, requested: string | null): Promise<string> {
  if (requested) return requested;
  // Prefer a card they already have — showing last month when it's empty and
  // June is sitting there is worse than showing June.
  const index = await api.recapIndex("player", playerId);
  return index?.periods?.[0]?.period ?? lastCompletedMonth();
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, period: segments } = await params;
  const ref = await resolveRef("player", id).catch(() => null);
  if (!ref || ref.ambiguous) return { title: "Recap" };

  const requested = periodFromSegments(segments);
  if (requested === false) return { title: "Recap" };
  const period = await resolvePeriod(ref.id, requested);
  const recap = await api.recap("player", ref.id, period);
  if (!recap) return { title: "Recap" };

  const name = recap.subject?.name ?? "Player";
  const title = `${name} — ${formatPeriod(period)} recap`;
  return {
    title,
    description: `What ${name} looted in ${formatPeriod(period)}, tracked by DropTracker.`,
    openGraph: { title, type: "article" },
  };
}

export default async function PlayerRecapPage({ params }: { params: Params }) {
  const { id, period: segments } = await params;
  const ref = await resolveRef("player", id).catch(() => null);
  if (!ref || ref.ambiguous) notFound();

  const requested = periodFromSegments(segments);
  if (requested === false) notFound();
  const period = await resolvePeriod(ref.id, requested);
  const [recap, index] = await Promise.all([
    api.recap("player", ref.id, period),
    api.recapIndex("player", ref.id),
  ]);
  if (!recap) notFound();

  const others = (index?.periods ?? []).filter((p) => p.period !== period).slice(0, 12);

  return (
    <div className="mx-auto max-w-[1140px] px-4 py-8">
      {/* No <Card> wrapper — the poster carries its own frame; `fluid` renders
          the identical composition scaled to the container, so this page and the
          shareable PNG are the same artifact. */}
      <RecapCard recap={recap} fluid />

      {others.length > 0 && (
        <Card className="mt-4">
          <h2 className="text-osrs-parchment/80 mb-3 text-sm font-semibold tracking-wide uppercase">
            Other periods
          </h2>
          <div className="flex flex-wrap gap-2">
            {others.map((p) => (
              <Link
                key={p.period}
                href={`/players/${ref.id}/recap/${p.period}` as Route}
                className="border-osrs-bronze/40 hover:border-osrs-gold text-osrs-parchment-dark hover:text-osrs-gold-bright rounded-lg border px-3 py-1.5 text-sm transition-colors"
              >
                {formatPeriod(p.period)}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="text-osrs-parchment-dark/50 mt-4 text-center text-xs">
        <Link href={`/players/${ref.id}`} className="hover:text-osrs-gold-bright">
          Back to {recap.subject?.name ?? "the player"}
        </Link>
      </div>
    </div>
  );
}
