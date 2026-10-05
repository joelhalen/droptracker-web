/**
 * BFF: an NPC's page for the Discord Activity (anonymous): the overview, its
 * drop table and the global personal-best boards, in one read. The drop table
 * and boards are non-critical, as on the site: either comes back null when its
 * read fails rather than failing the view.
 */
import { NextResponse, type NextRequest } from "next/server";
import { NpcDetailSchema, NpcDropTableSchema, PbBossBoardSchema } from "@droptracker/api-types";
import { proxyPbBoardImages, rewriteImgUrls, upstreamGet, UpstreamError } from "../../_lib";

async function optional<T>(path: string, parse: (raw: unknown) => T): Promise<T | null> {
  try {
    return parse(await upstreamGet(path, { revalidate: 60 }));
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  try {
    const [npc, dropTable, pbBoard] = await Promise.all([
      upstreamGet(`/npcs/${id}`, { revalidate: 60 }).then((raw) => NpcDetailSchema.parse(raw)),
      optional(`/npcs/${id}/drop-table`, (raw) => NpcDropTableSchema.parse(raw)),
      optional(`/personal-bests/board?npc_id=${id}`, (raw) => PbBossBoardSchema.parse(raw)),
    ]);
    return NextResponse.json(
      rewriteImgUrls({
        npc,
        drop_table: dropTable,
        pb_board: pbBoard && proxyPbBoardImages(pbBoard),
      }),
    );
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    console.error("[activity/npcs/:id]", err);
    return NextResponse.json({ error: "upstream error" }, { status: 502 });
  }
}
