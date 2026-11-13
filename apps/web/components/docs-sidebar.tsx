"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DocSummary } from "@droptracker/api-types";
import { DocsSearch } from "@/components/docs-search";

export function DocsSidebar({ groups }: { groups: { category: string; docs: DocSummary[] }[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-5 text-sm">
      <DocsSearch />
      <Link
        href="/docs"
        className={`block font-medium ${pathname === "/docs" ? "text-osrs-gold" : "hover:text-osrs-gold-bright"}`}
      >
        Overview
      </Link>
      {groups.map((g) => (
        <div key={g.category}>
          <div className="text-osrs-parchment-dark/50 mb-1.5 text-xs font-semibold uppercase tracking-wide">
            {g.category}
          </div>
          <ul className="space-y-1">
            {g.docs.map((d) => {
              const href = `/docs/${d.slug}`;
              const active = pathname === href;
              return (
                <li key={d.slug}>
                  <Link
                    href={href as Route}
                    className={`block rounded px-2 py-1 ${
                      active
                        ? "bg-osrs-bronze/40 text-osrs-gold"
                        : "text-osrs-parchment-dark/80 hover:text-osrs-gold-bright"
                    }`}
                  >
                    {d.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {/* Repo-versioned rather than CMS-authored: it documents code, so it
          changes in the same review as the code. */}
      <div>
        <div className="text-osrs-parchment-dark/50 mb-1.5 text-xs font-semibold uppercase tracking-wide">
          Developers
        </div>
        <ul className="space-y-1">
          <li>
            <Link
              href={"/docs/api" as Route}
              className={`block rounded px-2 py-1 ${
                pathname === "/docs/api"
                  ? "bg-osrs-bronze/40 text-osrs-gold"
                  : "text-osrs-parchment-dark/80 hover:text-osrs-gold-bright"
              }`}
            >
              Data API
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
