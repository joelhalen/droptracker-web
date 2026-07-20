/**
 * BFF: Discord OAuth callback (FRONTEND_PLAN.md §7.1 steps 2-4).
 *
 * 1. Verify the signed state nonce.
 * 2. Exchange the code for a Discord access token (server-side).
 * 3. Hand the Discord profile to the Web API, which finds-or-creates the
 *    `users` row and mints the authoritative session token.
 * 4. Store that token in an httpOnly cookie and redirect back into the app.
 */
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { consumeOAuthState, safeReturnPath, setSession } from "@/lib/session";

const DISCORD_TOKEN = "https://discord.com/api/oauth2/token";
const DISCORD_ME = "https://discord.com/api/users/@me";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(new URL("/?auth=error", env.siteUrl));
  }

  const verified = await consumeOAuthState(state);
  if (!verified) {
    return NextResponse.redirect(new URL("/?auth=state_mismatch", env.siteUrl));
  }

  try {
    // 2. Exchange the authorization code for a Discord access token.
    const tokenRes = await fetch(DISCORD_TOKEN, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.discord.clientId,
        client_secret: env.discord.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: env.discord.redirectUri,
      }),
    });
    if (!tokenRes.ok) throw new Error(`Discord token exchange failed: ${tokenRes.status}`);
    const token = (await tokenRes.json()) as { access_token: string };

    // 2b. Fetch the Discord profile.
    const profileRes = await fetch(DISCORD_ME, {
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    if (!profileRes.ok) throw new Error(`Discord profile fetch failed: ${profileRes.status}`);
    const profile = await profileRes.json();

    // 3. Exchange the Discord profile for our own session token.
    const sessionRes = await fetch(`${env.webApiInternalUrl}/api/v1/auth/discord`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ discord_profile: profile, discord_access_token: token.access_token }),
    });
    if (!sessionRes.ok) throw new Error(`Web API session mint failed: ${sessionRes.status}`);
    const { session_token } = (await sessionRes.json()) as { session_token: string };

    // 4. Persist as httpOnly cookie. Re-clamp the return path (defense in
    // depth — the state is HMAC-signed, but the login route pre-dating the
    // clamp may have signed an absolute URL).
    await setSession(session_token);
    return NextResponse.redirect(new URL(safeReturnPath(verified.redirectTo), env.siteUrl));
  } catch (err) {
    console.error("[auth/callback]", err);
    return NextResponse.redirect(new URL("/?auth=exchange_failed", env.siteUrl));
  }
}
