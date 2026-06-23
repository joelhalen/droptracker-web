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

  discord: {
    clientId: process.env.DISCORD_BOT_CLIENT_ID ?? "",
    clientSecret: process.env.DISCORD_BOT_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.DISCORD_REDIRECT_URI ?? "http://localhost:3000/api/auth/callback",
  },

  siteUrl: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
} as const;

export const SESSION_COOKIE = "dt_session";
