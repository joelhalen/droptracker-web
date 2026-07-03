import { requireSuperadmin } from "@/lib/auth";
import { TabNav, type NavTab } from "@/components/tab-nav";

// `href` is a plain string cast to `Route` at render time: some of these routes
// are newly added and may not yet be in the generated typed-routes manifest.
// No tab needs `matchPrefix` — none of these own nested dynamic child routes
// (see tab-nav.tsx for why "/admin" itself must stay exact-match-only).
const TABS: NavTab[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/data", label: "Data" },
  { href: "/admin/logs", label: "Logs" },
  { href: "/admin/groups", label: "Groups" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/announcements", label: "Global news" },
  { href: "/admin/docs", label: "Docs" },
  { href: "/admin/discord", label: "Discord sender" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/lookup", label: "Lookup" },
  { href: "/admin/tiers", label: "Tiers" },
];

/** Superadmin shell. Gates the whole /admin subtree to site staff. */
export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  await requireSuperadmin("/admin");

  return (
    <div className="space-y-6">
      <header>
        <span className="bg-osrs-red/20 text-osrs-red rounded px-2 py-0.5 text-xs font-medium">
          Site admin
        </span>
        <h1 className="text-osrs-gold mt-2 text-2xl font-bold">Administration</h1>
      </header>

      <TabNav tabs={TABS} />

      <div>{children}</div>
    </div>
  );
}
