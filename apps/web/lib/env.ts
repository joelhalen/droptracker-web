/**
 * Server-side environment access. Keep all secret reads here so the rest of the
 * app stays declarative and so we fail loudly when a required var is missing in
 * production.
 */
const bool = (v: string | undefined, fallback = false) =>
  v == null ? fallback : ["1", "true", "yes", "on"].includes(v.toLowerCase());

export const env = {
  /** Where the BFF reaches the Web API v1 process (server-side only). */
  webApiInternalUrl: process.env.WEB_API_INTERNAL_URL ?? "http://localhost:31325",
  /** Serve built-in mock data when the Web API is unreachable. */
  useMockApi: bool(process.env.USE_MOCK_API, process.env.NODE_ENV !== "production"),

  sessionCookieSecret: process.env.SESSION_COOKIE_SECRET ?? "dev-insecure-secret",

  /**
   * Whether the OAuth-state and session cookies get the `Secure` attribute.
   *
   * MUST be false whenever the browser can reach the app over plain HTTP —
   * including behind a TLS-terminating proxy such as Cloudflare "Flexible" SSL,
   * where the browser↔proxy hop may be HTTP and the proxy↔origin hop always is.
   * A `Secure` cookie delivered over an HTTP response is silently discarded by
   * the browser, so the session never persists and every guarded page bounces
   * straight back into the Discord OAuth dance (an endless sign-in loop).
   *
   * Flip SESSION_COOKIE_SECURE=true (via the env) only once TLS is guaranteed
   * end-to-end to the browser (e.g. Cloudflare "Always Use HTTPS" is on, or the
   * origin terminates TLS itself). A non-Secure cookie is still sent over HTTPS,
   * so leaving this false keeps sign-in working on both http:// and https://.
   */
  cookieSecure: bool(process.env.SESSION_COOKIE_SECURE, false),

  discord: {
    clientId: process.env.DISCORD_BOT_CLIENT_ID ?? "",
    clientSecret: process.env.DISCORD_BOT_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.DISCORD_REDIRECT_URI ?? "http://localhost:3000/api/auth/callback",
  },

  siteUrl: process.env.NEXTAUTH_URL ?? "http://localhost:3000",

  /**
   * Discord Activity OAuth apps: "clientId:secret,clientId2:secret2".
   *
   * The activity iframe derives its client id from its own hostname
   * (<client_id>.discordsays.com) and the BFF picks the matching secret here,
   * so one deployment serves several Discord applications at once — the
   * unverified webhook-bot app while testing and the verified primary app at
   * launch. The primary OAuth app (discord.clientId/Secret above) is always
   * accepted as a fallback without an entry.
   */
  activityAppSecrets: (() => {
    const map = new Map<string, string>();
    for (const pair of (process.env.ACTIVITY_APP_SECRETS ?? "").split(",")) {
      const sep = pair.indexOf(":");
      if (sep > 0) map.set(pair.slice(0, sep).trim(), pair.slice(sep + 1).trim());
    }
    return map;
  })(),
} as const;

export const SESSION_COOKIE = "dt_session";
