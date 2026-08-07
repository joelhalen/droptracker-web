/**
 * Phase-0 stub for the tenant mini-site surface. Proves the full serving
 * chain (Cloudflare → nginx wildcard block → Next host rewrite → this tree)
 * before any real rendering lands. Replaced by the real tenant layout+pages
 * in the sites-v1 build-out.
 */
export default async function TenantSiteStub({
  params,
}: {
  params: Promise<{ sub: string }>;
}) {
  const { sub } = await params;
  return (
    <main style={{ padding: "4rem", fontFamily: "monospace" }}>
      <h1>{sub}</h1>
      <p>tenant surface OK — served for subdomain “{sub}”.</p>
    </main>
  );
}
