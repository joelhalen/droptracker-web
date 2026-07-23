/**
 * BFF: resolve the launch guild's DropTracker group (anonymous). Backed by the
 * Web API's GET /groups/by-guild/{guildId}; 404 = guild not registered.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rewriteImgUrls, upstreamGet, UpstreamError } from "../_lib";

const GuildGroupSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  member_count: z.number().int().optional(),
  icon_url: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const guildId = (req.nextUrl.searchParams.get("guildId") ?? "").trim();
  if (!/^\d+$/.test(guildId)) {
    return NextResponse.json({ error: "guildId required" }, { status: 400 });
  }
  // fresh=1 bypasses the anonymous 5-minute cache — the group-setup wizard
  // uses it right after creating a group so the new clan resolves immediately.
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";
  try {
    const group = GuildGroupSchema.parse(
      await upstreamGet(
        `/groups/by-guild/${guildId}`,
        fresh ? { revalidate: 0 } : { revalidate: 300 },
      ),
    );
    return NextResponse.json(rewriteImgUrls(group));
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) {
      return NextResponse.json({ error: "not registered" }, { status: 404 });
    }
    console.error("[activity/guild-group]", err);
    return NextResponse.json({ error: "upstream error" }, { status: 502 });
  }
}
