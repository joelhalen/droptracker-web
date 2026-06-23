import Link from "next/link";
import { requireUser } from "@/lib/auth";

// Authed shell. `requireUser` redirects unauthenticated visitors to sign-in.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/dashboard");

  const tabs = [
    { href: "/dashboard", label: "My accounts" },
    { href: "/settings", label: "Settings" },
    { href: "/submit", label: "Submit a drop" },
  ] as const;

  return (
    <div className="grid gap-8 md:grid-cols-[12rem_1fr]">
      <aside>
        <nav className="flex flex-col gap-1 text-sm">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="hover:bg-osrs-bronze/30 rounded px-3 py-2 transition-colors"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section>{children}</section>
    </div>
  );
}
