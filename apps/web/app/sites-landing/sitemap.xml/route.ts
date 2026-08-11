/**
 * Sitemap for the sites domain apex.
 *
 * Deliberately just the homepage: tenant sites live on their own subdomains
 * and each serves its own sitemap, so listing them here would be cross-host
 * and wrong. Kept as a route handler (not app/sitemap.ts) because the apex is
 * reached through a host rewrite, and the main domain already owns that file.
 */
const SITES_DOMAIN = process.env.SITES_DOMAIN || "osrs.site";

export const dynamic = "force-static";

export function GET() {
  const urls = [{ loc: `https://${SITES_DOMAIN}/`, priority: "1.0", changefreq: "weekly" }];
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(
        (u) =>
          `  <url><loc>${u.loc}</loc><changefreq>${u.changefreq}</changefreq>` +
          `<priority>${u.priority}</priority></url>`,
      )
      .join("\n") +
    "\n</urlset>\n";
  return new Response(body, {
    headers: { "content-type": "application/xml", "cache-control": "public, max-age=3600" },
  });
}
