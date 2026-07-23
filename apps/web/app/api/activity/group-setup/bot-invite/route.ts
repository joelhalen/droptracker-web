/**
 * BFF: public bot application info (client id + invite URL) for the wizard's
 * "Invite the bot" button. Anonymous — the upstream /meta/bot-invite is public.
 */
import { NextResponse } from "next/server";
import { upstreamGet, UpstreamError } from "../../_lib";

export async function GET() {
  try {
    const invite = await upstreamGet(`/meta/bot-invite`, { revalidate: 3600 });
    return NextResponse.json(invite);
  } catch (err) {
    if (err instanceof UpstreamError) {
      return NextResponse.json({ detail: "Invite info unavailable." }, { status: err.status });
    }
    console.error("[activity/group-setup/bot-invite]", err);
    return NextResponse.json({ detail: "Couldn't reach the service." }, { status: 502 });
  }
}
