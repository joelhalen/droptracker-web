/**
 * robots.txt for the sites domain apex. Without this, `osrs.site/robots.txt`
 * falls through to the main app's single-host robots route and advertises
 * droptracker.io's sitemap on the wrong domain.
 *
 * Draft previews are disallowed; tenant subdomains serve their own robots.txt
 * from app/sites/[sub]/robots.txt.
 */
const SITES_DOMAIN = process.env.SITES_DOMAIN || "osrs.site";

export const dynamic = "force-static";

export function GET() {
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /__preview/",
    "",
    `Sitemap: https://${SITES_DOMAIN}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "content-type": "text/plain", "cache-control": "public, max-age=3600" },
  });
}
