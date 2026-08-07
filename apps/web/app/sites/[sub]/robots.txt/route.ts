/**
 * Tenant robots.txt (rewritten from `/{robots.txt}` on the tenant host).
 * Sites pending raw-HTML review are fully disallowed; published clean sites
 * allow everything except draft previews.
 */
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sub: string }> },
) {
  const { sub } = await params;
  const site = await api.siteResolve(sub).catch(() => null);
  const indexable = site?.status === "ok" && !site.needs_review;
  const body = indexable
    ? "User-agent: *\nDisallow: /__preview/\n"
    : "User-agent: *\nDisallow: /\n";
  return new Response(body, {
    headers: { "content-type": "text/plain", "cache-control": "public, max-age=300" },
  });
}
