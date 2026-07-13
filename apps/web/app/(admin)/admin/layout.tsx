import { requireSuperadmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";

/**
 * Superadmin shell. Gates the whole /admin subtree to site staff and renders
 * the sectioned navigation (sidebar on desktop, disclosure on mobile) from
 * the shared registry in lib/admin-nav.ts.
 */
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

      {/* min-w-0 on the content cell: tables inside must be able to shrink
          (see the mobile-overflow rules) instead of widening the grid. */}
      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <AdminNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
