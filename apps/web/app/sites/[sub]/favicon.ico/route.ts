/**
 * Tenant favicon (rewritten from `/favicon.ico` on the tenant host):
 * 302 to the group's icon when set, else the DropTracker icon on www.
 */
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

const FALLBACK = "https://www.droptracker.io/favicon.ico";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sub: string }> },
) {
  const { sub } = await params;
  const site = await api.siteResolve(sub).catch(() => null);
  const target = (site?.status === "ok" && site.icon_url) || FALLBACK;
  return Response.redirect(target, 302);
}
