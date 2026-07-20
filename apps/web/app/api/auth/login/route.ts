/**
 * BFF: begin the Discord OAuth dance (FRONTEND_PLAN.md §7.1 steps 1-2).
 * Redirects the browser to Discord's consent screen with a signed state nonce.
 */
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { issueOAuthState, safeReturnPath, setSession } from "@/lib/session";

const DISCORD_AUTHORIZE = "https://discord.com/api/oauth2/authorize";
const SCOPES = ["identify", "guilds"];

export async function GET(req: NextRequest) {
  const redirectTo = safeReturnPath(req.nextUrl.searchParams.get("redirect"));
  const state = await issueOAuthState(redirectTo);

  if (!env.discord.clientId) {
    // No OAuth app configured. In mock mode, perform a dev sign-in so the
    // authenticated UI is demonstrable end-to-end without a live backend.
    if (env.useMockApi) {
      await setSession("mock-session");
      return NextResponse.redirect(new URL(redirectTo, env.siteUrl));
    }
    // Otherwise explain instead of bouncing the user to a broken Discord URL.
    return NextResponse.json(
      {
        title: "Discord OAuth not configured",
        detail:
          "Set DISCORD_BOT_CLIENT_ID / DISCORD_BOT_CLIENT_SECRET / DISCORD_REDIRECT_URI to enable sign-in.",
      },
      { status: 501 },
    );
  }

  const url = new URL(DISCORD_AUTHORIZE);
  url.searchParams.set("client_id", env.discord.clientId);
  url.searchParams.set("redirect_uri", env.discord.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("state", state);
  // Note: no `prompt=none`. With `prompt=none` Discord refuses to show the
  // consent screen and instead returns an error (e.g. `consent_required`)
  // whenever a fresh grant is needed — such as after we added the `guilds`
  // scope — which lands back in the callback with no `code`, no session, and an
  // immediate silent bounce back into sign-in. Omitting it lets Discord skip
  // consent automatically for already-authorized users and prompt only when a
  // grant is genuinely required.

  return NextResponse.redirect(url);
}
