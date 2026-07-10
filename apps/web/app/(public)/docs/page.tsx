import type { Metadata, Route } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { groupDocsByCategory } from "@/lib/docs";
import { ScrollPanel } from "@/components/scroll-panel";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Guides for using DropTracker — getting started, accounts, groups, and more.",
};

export default async function DocsIndexPage() {
  const groups = groupDocsByCategory(await api.docs());

  return (
    <ScrollPanel>
      <header className="mb-8 text-center">
        <h1 className="ink-heading text-2xl font-bold sm:text-3xl">Documentation</h1>
        <p className="ink-muted mt-2">
          Everything you need to track loot, run a clan, and configure DropTracker.
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        {groups.map((g) => (
          <section key={g.category}>
            <h2 className="ink-heading ink-rule mb-3 border-b pb-1 text-lg font-semibold">
              {g.category}
            </h2>
            <ul className="space-y-2">
              {g.docs.map((d) => (
                <li key={d.slug}>
                  <Link href={`/docs/${d.slug}` as Route} className="ink-link font-medium">
                    {d.title}
                  </Link>
                  {d.description && <p className="ink-muted text-sm">{d.description}</p>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </ScrollPanel>
  );
}
