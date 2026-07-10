import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { PbBoards } from "@/components/pb-boards";
import { PbBossPicker } from "@/components/pb-boss-picker";
import { EmptyState } from "@/components/ui";

export const revalidate = 120;

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ boss?: string }>;

function parseId(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const groupId = parseId((await params).id);
  if (groupId === null) return { title: "Personal Bests" };
  const index = await api.pbBosses(groupId);
  const name = index.group_name;
  return {
    title: name ? `${name} — Personal Bests` : "Personal Bests",
    description: name
      ? `The fastest kill times held by members of ${name}, ranked per boss and team size.`
      : undefined,
  };
}

export default async function GroupPersonalBestsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const groupId = parseId((await params).id);
  if (groupId === null) notFound();

  const index = await api.pbBosses(groupId);
  if (!index.group_name && index.bosses.length === 0) notFound();

  // Selected boss: honor ?boss= when it has ranked times for this group,
  // otherwise fall back to the group's most-contested board.
  const requested = parseId((await searchParams).boss);
  const selected =
    requested !== null && index.bosses.some((b) => b.npc_id === requested)
      ? requested
      : index.bosses[0]?.npc_id;

  const board = selected !== undefined ? await api.pbBoard(selected, groupId) : null;
  const basePath = `/groups/${groupId}/personal-bests`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href={`/groups/${groupId}` as Route}
            className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
          >
            ← {index.group_name ?? "Group"}
          </Link>
          <h1 className="text-osrs-gold mt-1 text-2xl font-bold">Personal bests</h1>
          <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
            Kill-time leaderboards among this clan&apos;s members, with each time&apos;s global
            standing.
          </p>
        </div>
        <Link
          href={
            (selected !== undefined ? `/personal-bests/${selected}` : "/personal-bests") as Route
          }
          className="border-osrs-bronze/50 hover:bg-osrs-bronze/30 rounded border px-3 py-1.5 text-sm font-medium"
        >
          Global boards →
        </Link>
      </div>

      {index.bosses.length === 0 || !board ? (
        <EmptyState
          title="No personal bests yet"
          hint="Kill times appear here once members submit them with the RuneLite plugin."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <PbBossPicker bosses={index.bosses} selected={board.npc_id} basePath={basePath} />
            <img
              src={board.icon_url}
              alt=""
              className="size-9 shrink-0 rounded object-contain"
              loading="lazy"
            />
            <span className="text-osrs-parchment-dark/60 text-sm">
              {board.player_count.toLocaleString()} members ranked
            </span>
          </div>
          <PbBoards board={board} />
        </>
      )}
    </div>
  );
}
