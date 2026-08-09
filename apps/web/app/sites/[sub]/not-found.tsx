/**
 * Tenant-scoped 404 (sites-v1): catches notFound() from pages INSIDE a
 * claimed site (unknown page slug, missing preview token, …) and renders
 * within the tenant layout — so the clan's own nav/theme stays intact and
 * the way home is the tenant's home, not DropTracker's.
 */
export default function TenantPageNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-osrs-gold font-display text-3xl font-bold">Page not found</h1>
      <p className="text-osrs-parchment-dark/80 mt-3">
        This page doesn&apos;t exist on this clan&apos;s site.
      </p>
      <a
        href="/"
        className="bg-osrs-bronze hover:bg-osrs-gold hover:text-osrs-brown-dark mt-6 rounded px-4 py-2 text-sm font-medium transition-colors"
      >
        Back to the front page
      </a>
    </div>
  );
}
