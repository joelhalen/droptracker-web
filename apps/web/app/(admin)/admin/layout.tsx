import type { Route } from "next";
import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth";

const TABS: { href: Route; label: string }[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/announcements", label: "Global news" },
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

      <nav className="border-osrs-bronze/30 flex flex-wrap gap-1 border-b pb-2 text-sm">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="hover:bg-osrs-bronze/30 rounded px-3 py-1.5">
            {t.label}
          </Link>
        ))}
      </nav>

      <div>{children}</div>
    </div>
  );
}
