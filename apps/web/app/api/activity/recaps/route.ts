/**
 * BFF: a recap card for the Discord Activity (anonymous), with the subject's
 * archive of periods, in one read: `?scope=group|player&id=N[&period=P]`.
 *
 * With no period it picks the way the site does: the newest card the subject
 * has, else (players only) the last completed month, which the API generates
 * on first read. Clans' cards are pre-generated, so a clan with no archive
 * simply has none (`recap: null`).
 */
import { NextResponse, type NextRequest } from "next/server";
import { RecapIndexSchema, RecapSchema, type RecapIndex } from "@droptracker/api-types";
import { rewriteImgUrls, upstreamGet, UpstreamError } from "../_lib";

/** The most recent finished month, in the card's `YYYY-MM` form. */
function lastCompletedMonth(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return month === 0 ? `${year - 1}-12` : `${year}-${String(month).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const scope = sp.get("scope");
  const id = sp.get("id") ?? "";
  const requested = (sp.get("period") ?? "").trim();
  if ((scope !== "group" && scope !== "player") || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "bad scope or id" }, { status: 400 });
  }
  if (requested && !/^\d{4}(-\d{2})?$/.test(requested)) {
    return NextResponse.json({ error: "bad period" }, { status: 400 });
  }

  const index: RecapIndex | null = await upstreamGet(`/recaps/${scope}/${id}`, { revalidate: 300 })
    .then((raw) => RecapIndexSchema.parse(raw))
    .catch(() => null);
  const period =
    requested || index?.periods[0]?.period || (scope === "player" ? lastCompletedMonth() : null);

  let recap = null;
  if (period) {
    try {
      recap = RecapSchema.parse(
        await upstreamGet(`/recaps/${scope}/${id}/${period}`, { revalidate: 3600 }),
      );
    } catch (err) {
      // 404 = below the activity floor for that period: no card, not an error.
      if (!(err instanceof UpstreamError && err.status === 404)) {
        console.error("[activity/recaps]", err);
        return NextResponse.json({ error: "upstream error" }, { status: 502 });
      }
    }
  }
  return NextResponse.json(
    rewriteImgUrls({ periods: index?.periods ?? [], period, recap }),
  );
}
