/**
 * BFF: Discord Activity OAuth exchange.
 *
 * Mirrors app/api/auth/callback/route.ts, adapted for the Embedded App SDK
 * flow: the iframe gets an authorization code from `sdk.commands.authorize()`
 * (no redirect_uri in this grant) and POSTs it here. We exchange it
 * server-side, mint our own session via the Web API, and hand everything back
 * in the response BODY — never a cookie, since cookies can't survive the
 * discordsays.com iframe (see lib/activity/auth-context.tsx).
 *
 * `client_id` is whichever Discord application the activity is running under
 * (derived from the iframe hostname); its secret comes from
 * env.activityAppSecrets, with the primary OAuth app accepted as a fallback.
 * The SDK needs the raw Discord access_token back for
 * `sdk.commands.authenticate()`, so it is returned alongside our session.
 */
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

const DISCORD_TOKEN = "https://discord.com/api/oauth2/token";
const DISCORD_ME = "https://discord.com/api/users/@me";

function secretFor(clientId: string): string | null {
  const mapped = env.activityAppSecrets.get(clientId);
  if (mapped) return mapped;
  if (clientId === env.discord.clientId && env.discord.clientSecret) {
    return env.discord.clientSecret;
  }
  return null;
}

export async function POST(req: NextRequest) {
  let body: { client_id?: string; code?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const clientId = (body.client_id ?? "").trim();
  const code = (body.code ?? "").trim();
  if (!/^\d+$/.test(clientId) || !code) {
    return NextResponse.json({ error: "client_id and code required" }, { status: 400 });
  }
  const clientSecret = secretFor(clientId);
  if (!clientSecret) {
    return NextResponse.json({ error: "unknown activity application" }, { status: 403 });
  }

  try {
    // 1. Exchange the authorization code for a Discord access token.
    const tokenRes = await fetch(DISCORD_TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
      }),
    });
    if (!tokenRes.ok) throw new Error(`Discord token exchange failed: ${tokenRes.status}`);
    const token = (await tokenRes.json()) as { access_token: string };

    // 2. Fetch the Discord profile.
    const profileRes = await fetch(DISCORD_ME, {
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    if (!profileRes.ok) throw new Error(`Discord profile fetch failed: ${profileRes.status}`);
    const profile = (await profileRes.json()) as {
      id: string;
      username: string;
      global_name?: string | null;
      avatar?: string | null;
    };

    // 3. Find-or-create the user + mint our session (same endpoint the site
    //    login uses). Session failure degrades to anonymous viewing rather
    //    than failing the whole activity.
    let sessionToken: string | null = null;
    try {
      const sessionRes = await fetch(`${env.webApiInternalUrl}/api/v1/auth/discord`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          discord_profile: profile,
          discord_access_token: token.access_token,
        }),
      });
      if (sessionRes.ok) {
        sessionToken = ((await sessionRes.json()) as { session_token: string }).session_token;
      } else {
        console.error("[activity/auth] session mint failed:", sessionRes.status);
      }
    } catch (err) {
      console.error("[activity/auth] session mint unreachable:", err);
    }

    return NextResponse.json({
      access_token: token.access_token,
      session_token: sessionToken,
      user: {
        id: profile.id,
        username: profile.username,
        global_name: profile.global_name ?? null,
        avatar: profile.avatar ?? null,
      },
    });
  } catch (err) {
    console.error("[activity/auth]", err);
    return NextResponse.json({ error: "exchange failed" }, { status: 502 });
  }
}
