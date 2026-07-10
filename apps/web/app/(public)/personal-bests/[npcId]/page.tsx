import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { PbBoards } from "@/components/pb-boards";
import { StatTile } from "@/components/ui";

export const revalidate = 120;

type Params = Promise<{ npcId: string }>;

function parseNpcId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const npcId = parseNpcId((await params).npcId);
  if (npcId === null) return { title: "Personal Bests" };
  const board = await api.pbBoard(npcId);
  if (!board) return { title: "Personal Bests" };
  return {
    title: `${board.name} — Personal Best Leaderboards`,
    description: `The fastest recorded ${board.name} kill times on DropTracker, ranked per team size.`,
  };
}

export default async function PbBossPage({ params }: { params: Params }) {
  const npcId = parseNpcId((await params).npcId);
  if (npcId === null) notFound();
  const board = await api.pbBoard(npcId);
  if (!board) notFound();

  const recordHolder = board.boards
    .flatMap((b) => b.entries.filter((e) => e.rank === 1))
    .sort((a, b) => a.time_ms - b.time_ms)[0];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={"/personal-bests" as Route}
          className="text-osrs-parchment-dark/60 text-sm hover:text-osrs-gold-bright"
        >
          ← All bosses
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <img
            src={board.icon_url}
            alt=""
            className="size-12 shrink-0 rounded object-contain"
            loading="lazy"
          />
          <div className="min-w-0">
            <h1 className="text-osrs-gold truncate text-2xl font-bold">{board.name}</h1>
            <p className="text-osrs-parchment-dark/70 text-sm">Personal best leaderboards</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Ranked players" value={board.player_count.toLocaleString()} />
        <StatTile label="Recorded times" value={board.entry_count.toLocaleString()} />
        <StatTile label="Team sizes" value={String(board.boards.length)} />
        <StatTile
          label="Fastest time"
          value={recordHolder ? recordHolder.time_display : "—"}
        />
      </div>

      <PbBoards board={board} />
    </div>
  );
}
