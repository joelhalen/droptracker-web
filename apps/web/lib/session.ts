/**
 * BFF session helpers. The Web API mints the authoritative session token
 * (FRONTEND_PLAN.md §7.1 step 4); the BFF stores it in an httpOnly, Secure,
 * SameSite=Lax cookie so the browser never sees a backend token.
 *
 * The OAuth `state` nonce is signed with an HMAC keyed on SESSION_COOKIE_SECRET
 * so the callback can verify it without server-side storage (Redis-backed state
 * is the §13 alternative).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env, SESSION_COOKIE } from "./env";

const OAUTH_STATE_COOKIE = "dt_oauth_state";
const STATE_TTL_MS = 10 * 60 * 1000;

function sign(value: string): string {
  return createHmac("sha256", env.sessionCookieSecret).update(value).digest("base64url");
}

/** Create a signed, time-bound OAuth state token and persist it in a cookie. */
export async function issueOAuthState(redirectTo: string): Promise<string> {
  const payload = `${Date.now()}.${encodeURIComponent(redirectTo)}`;
  const token = `${payload}.${sign(payload)}`;
  (await cookies()).set(OAUTH_STATE_COOKIE, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_MS / 1000,
  });
  return token;
}

/** Verify the returned `state` against the cookie. Returns the redirect target. */
export async function consumeOAuthState(returned: string): Promise<{ redirectTo: string } | null> {
  const jar = await cookies();
  const stored = jar.get(OAUTH_STATE_COOKIE)?.value;
  jar.delete(OAUTH_STATE_COOKIE);
  if (!stored || stored !== returned) return null;

  const parts = stored.split(".");
  if (parts.length !== 3) return null;
  const [ts, redirect, mac] = parts as [string, string, string];
  const expected = sign(`${ts}.${redirect}`);
  if (
    expected.length !== mac.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(mac))
  ) {
    return null;
  }
  if (Date.now() - Number(ts) > STATE_TTL_MS) return null;
  return { redirectTo: decodeURIComponent(redirect) };
}

/** Store the backend-issued session token in an httpOnly cookie. */
export async function setSession(token: string, maxAgeSeconds = 60 * 60 * 24 * 7): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function hasSession(): Promise<boolean> {
  return Boolean((await cookies()).get(SESSION_COOKIE)?.value);
}
