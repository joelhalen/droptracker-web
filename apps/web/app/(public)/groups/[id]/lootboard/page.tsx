import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { orNotFound } from "@/lib/fetch";
import { PERIOD_OPTIONS, DEFAULT_PERIOD, resolvePeriod } from "@/lib/period";
import { groupSocialMetadata } from "@/lib/seo";
import { LootboardCanvas } from "@/components/lootboard-canvas";

export const revalidate = 30;

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ period?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  try {
    const group = await api.group(Number(id));
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
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) notFound();
  const { period: periodKey = DEFAULT_PERIOD } = await searchParams;

  const [group, board] = await Promise.all([
    orNotFound(api.group(groupId)),
    api.lootboard(groupId, resolvePeriod(periodKey)),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/groups/${groupId}`}
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
            href={`/groups/${groupId}/lootboard?period=${p.key}` as Route}
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
