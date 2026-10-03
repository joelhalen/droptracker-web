/**
 * BFF: the account half of a player profile for the Discord Activity: the
 * collection log, combat achievements + diaries, and this month's loot tracker,
 * which feed the same showcase tabs the site profile has.
 *
 * Each part is non-critical, exactly as on the site: most players have never
 * synced, and a profile must still render when any one read fails, so a failed
 * part comes back as null rather than failing the whole response.
 *
 * Collection log screenshots are B2-hosted, cross-origin to the Activity iframe
 * and blocked by its CSP, so they are rewritten onto the same-origin
 * board-img proxy here. Other loot-month reads go through the public
 * `/api/players/[id]/loot` route, which is already same-origin on the activity
 * host.
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  PlayerAchievementsSchema,
  PlayerCollectionLogSchema,
  PlayerLootTrackerSchema,
  type PlayerCollectionLog,
} from "@droptracker/api-types";
import { proxiedBoardImg, rewriteImgUrls, upstreamGet } from "../../../_lib";

async function part<T>(path: string, parse: (raw: unknown) => T): Promise<T | null> {
  try {
    return parse(await upstreamGet(path, { revalidate: 60 }));
  } catch (err) {
    console.error(`[activity/players/:id/account] ${path}`, err);
    return null;
  }
}

function proxyScreenshots(log: PlayerCollectionLog): PlayerCollectionLog {
  const details = Object.fromEntries(
    Object.entries(log.details).map(([slot, d]) => [
      slot,
      { ...d, image_url: proxiedBoardImg(d.image_url) ?? null },
    ]),
  );
  return { ...log, details };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const [collectionLog, achievements, loot] = await Promise.all([
    part(`/players/${id}/collection-log`, (raw) => PlayerCollectionLogSchema.parse(raw)),
    part(`/players/${id}/achievements`, (raw) => PlayerAchievementsSchema.parse(raw)),
    part(`/players/${id}/loot`, (raw) => PlayerLootTrackerSchema.parse(raw)),
  ]);

  return NextResponse.json(
    rewriteImgUrls({
      collection_log: collectionLog ? proxyScreenshots(collectionLog) : null,
      achievements,
      loot,
    }),
  );
}
