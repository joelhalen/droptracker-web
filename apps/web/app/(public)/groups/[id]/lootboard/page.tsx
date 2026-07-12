import type { Metadata, Route } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { resolveRef, resolveIdOrRedirect } from "@/lib/entity-ref";
import { PERIOD_OPTIONS, DEFAULT_PERIOD, resolvePeriod } from "@/lib/period";
import { groupSocialMetadata } from "@/lib/seo";
import { LootboardCanvas } from "@/components/lootboard-canvas";

export const revalidate = 30;

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ period?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const ref = await resolveRef("group", id).catch(() => null);
  if (!ref || ref.ambiguous) return { title: "Lootboard" };
  try {
    const group = await api.group(ref.id);
    return groupSocialMetadata(group, {
      title: `${group.name} — Lootboard`,
      description: `Live loot leaderboard for ${group.name} on DropTracker.`,
    });
  } catch {
    return { title: "Lootboard" };
  }
}

export default async function GroupLootboardPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const groupId = await resolveIdOrRedirect("group", "groups", id);
  const { period: periodKey = DEFAULT_PERIOD } = await searchParams;

  const [group, board] = await Promise.all([
    orNotFound(api.group(groupId)),
    api.lootboard(groupId, resolvePeriod(periodKey)),
  ]);
  const base = group.canonical_slug ? `/groups/${group.canonical_slug}` : `/groups/${groupId}`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={base as Route}
          className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
        >
          ← {group.name}
        </Link>
        <h1 className="text-osrs-gold mt-1 text-2xl font-bold">Lootboard</h1>
      </div>

      <div className="flex flex-wrap gap-1">
        {PERIOD_OPTIONS.map((p) => (
          <Link
            key={p.key}
            href={`${base}/lootboard?period=${p.key}` as Route}
            className={`rounded px-3 py-1.5 text-sm ${
              periodKey === p.key
                ? "bg-osrs-bronze text-osrs-parchment"
                : "text-osrs-parchment-dark/80 hover:text-osrs-gold-bright"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <LootboardCanvas board={board} />
    </div>
  );
}
