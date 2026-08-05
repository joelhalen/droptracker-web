import { requireDeveloper } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";

/**
 * Staff shell (web87a). Admits developers AND superadmins; the nav filters by
 * role, and every superadmin-only page inside the subtree re-asserts
 * `requireSuperadmin` itself — this layout gate alone is deliberately the
 * weaker (developer) one.
 */
export default async function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDeveloper("/admin");
  const role = user.is_superadmin ? "superadmin" : "developer";

  return (
    <div className="space-y-6">
      <header>
        <span className="bg-osrs-red/20 text-osrs-red rounded px-2 py-0.5 text-xs font-medium">
          {role === "superadmin" ? "Site admin" : "Developer"}
        </span>
        <h1 className="text-osrs-gold mt-2 text-2xl font-bold">Administration</h1>
      </header>

      {/* min-w-0 on the content cell: tables inside must be able to shrink
          (see the mobile-overflow rules) instead of widening the grid. */}
      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <AdminNav role={role} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
