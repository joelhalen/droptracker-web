/**
 * Tenant mini-site shell (sites-v1): one layout per `{sub}.SITES_DOMAIN`.
 *
 * Sits OUTSIDE the (site) chrome on purpose (precedent: /activity,
 * /board-image) — a clan's site gets its own nav/footer, not DropTracker's.
 * The wrapper div sets the full `--dt-*` variable set inline (server-driven
 * theme + saved palette overrides), which beats the root `data-theme`
 * palette by inheritance, so the visitor's droptracker.io theme preference
 * cannot restyle a clan site.
 *
 * Structure contract with the CSS sanitizer: everything the group can style
 * lives inside `#site-root`; the host footer (report link) renders outside
 * it, so scoped tenant CSS cannot select it away.
 */
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { sitePaletteStyle } from "@/lib/site-themes";
import type { SiteNavItem, SiteResolve } from "@droptracker/api-types";

const SITES_DOMAIN = process.env.SITES_DOMAIN ?? "";

type Params = Promise<{ sub: string }>;

async function onTenantHost(): Promise<boolean> {
  if (!SITES_DOMAIN) return false;
  const host = ((await headers()).get("host") ?? "").split(":")[0] ?? "";
  return host.endsWith("." + SITES_DOMAIN);
}

async function loadSite(sub: string): Promise<SiteResolve | null> {
  try {
    return await api.siteResolve(sub);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { sub } = await params;
  const site = await loadSite(sub);
  if (!site || site.status !== "ok") {
    return { robots: { index: false, follow: false } };
  }
  return {
    metadataBase: new URL(`https://${sub}.${SITES_DOMAIN}`),
    title: { default: site.group_name ?? sub, template: `%s — ${site.group_name ?? sub}` },
    // Indexable-after-review: raw-HTML/CSS sites stay noindex until a
    // superadmin clears the review flag.
    robots: site.needs_review ? { index: false, follow: false } : undefined,
    icons: site.icon_url ? { icon: site.icon_url } : undefined,
    openGraph: {
      siteName: site.group_name ?? sub,
      images: site.icon_url ? [site.icon_url] : undefined,
    },
  };
}

function NavLinks({ nav }: { nav: SiteNavItem[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {nav.map((item, i) => {
        const href = item.page_slug
          ? item.page_slug === "home"
            ? "/"
            : `/${item.page_slug}`
          : (item.href ?? "/");
        return (
          <a
            key={i}
            href={href}
            className="text-osrs-parchment hover:text-osrs-gold hover:bg-osrs-surface-2 rounded px-3 py-1.5 text-sm font-medium transition-colors"
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

export default async function TenantSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  // Cross-host guard: this tree is only reachable through the tenant-host
  // rewrites; direct /sites/... navigation on droptracker.io hosts 404s.
  if (!(await onTenantHost())) notFound();

  const { sub } = await params;
  const site = await loadSite(sub);

  // Unknown subdomain: render a branded "address available" landing rather
  // than notFound() — throwing from this layout would bubble to the MAIN
  // site's not-found page, whose chrome links don't exist on tenant hosts
  // (every nav link would 404). generateMetadata already marks this noindex.
  if (!site) {
    return (
      <div
        style={sitePaletteStyle("dusk", undefined)}
        className="bg-osrs-surface-0 text-osrs-parchment flex min-h-screen items-center justify-center p-8"
      >
        <div className="max-w-lg text-center">
          <h1 className="text-osrs-gold font-display text-4xl font-bold">
            {sub}.{SITES_DOMAIN}
          </h1>
          <p className="text-osrs-parchment-dark/90 mt-4 text-lg">
            No clan has claimed this address yet.
          </p>
          <p className="text-osrs-parchment-dark/70 mt-2 text-sm">
            Clan websites here are built with{" "}
            <a className="text-osrs-gold underline" href="https://www.droptracker.io/">
              DropTracker
            </a>{" "}
            — live loot, leaderboards and records, designed by the clan itself.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://www.droptracker.io/premium"
              className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark rounded-lg px-5 py-2.5 font-medium transition-colors"
            >
              Claim it for your clan
            </a>
            <a
              href={`https://${SITES_DOMAIN}/`}
              className="border-osrs-bronze/60 hover:bg-osrs-bronze/30 rounded-lg border px-5 py-2.5 font-medium transition-colors"
            >
              About {SITES_DOMAIN}
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (site.status !== "ok") {
    const suspended = site.status === "suspended";
    return (
      <div
        style={sitePaletteStyle("dusk", undefined)}
        className="bg-osrs-surface-0 text-osrs-parchment flex min-h-screen items-center justify-center p-8"
      >
        <div className="border-osrs-bronze/40 bg-osrs-surface-1 max-w-md rounded-2xl border p-8 text-center">
          <h1 className="text-osrs-gold text-2xl font-bold">
            {suspended ? "Site suspended" : "Site unavailable"}
          </h1>
          <p className="text-osrs-parchment-dark/80 mt-3">
            {suspended
              ? "This site has been suspended for violating the DropTracker hosted-content terms."
              : "This clan site is not currently available."}
          </p>
          <a className="text-osrs-gold mt-6 inline-block underline" href="https://www.droptracker.io/">
            DropTracker.io
          </a>
        </div>
      </div>
    );
  }

  const nav = site.nav ?? [];
  const paletteVars = sitePaletteStyle(site.theme_key, site.palette);

  return (
    <div
      style={paletteVars}
      className="bg-osrs-surface-0 text-osrs-parchment flex min-h-screen flex-col"
    >
      {/* Site-wide custom CSS: tinycss2-validated + #site-root-scoped at save. */}
      {site.custom_css ? <style dangerouslySetInnerHTML={{ __html: site.custom_css }} /> : null}

      <header className="border-osrs-bronze/30 bg-osrs-surface-1/80 border-b">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <a href="/" className="flex items-center gap-3">
            {site.icon_url && (
              <img src={site.icon_url} alt="" className="size-8 rounded-lg object-cover" />
            )}
            <span className="text-osrs-gold font-display text-lg font-bold">
              {site.group_name}
            </span>
          </a>
          {nav.length > 0 && <NavLinks nav={nav} />}
        </div>
      </header>

      <main id="site-root" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>

      {/* Host footer — OUTSIDE #site-root so scoped tenant CSS can't hide it.
          The report link is the abuse pipeline; keep it on the main domain. */}
      <footer className="border-osrs-bronze/30 bg-osrs-surface-1/80 border-t">
        <div className="text-osrs-parchment-dark/70 mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs">
          <a
            href={`https://www.droptracker.io/groups/${site.group_id}`}
            className="hover:text-osrs-gold"
          >
            Hosted by DropTracker
          </a>
          <a
            href={`https://www.droptracker.io/report?site=${encodeURIComponent(sub)}`}
            className="hover:text-osrs-gold underline"
          >
            Report this site
          </a>
        </div>
      </footer>
    </div>
  );
}
