import type { Metadata, Route } from "next";
import Link from "next/link";
import { getDocsByCategory } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Guides for using DropTracker — getting started, accounts, groups, and more.",
};

export default async function DocsIndexPage() {
  const groups = await getDocsByCategory();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-osrs-gold text-3xl font-bold">Documentation</h1>
        <p className="text-osrs-parchment-dark/80 mt-2">
          Everything you need to track loot, run a clan, and configure DropTracker.
        </p>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        {groups.map((g) => (
          <section key={g.category}>
            <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-lg font-semibold">
              {g.category}
            </h2>
            <ul className="space-y-2">
              {g.docs.map((d) => (
                <li key={d.slug}>
                  <Link
                    href={`/docs/${d.slug}` as Route}
                    className="text-osrs-gold-bright font-medium hover:underline"
                  >
                    {d.title}
                  </Link>
                  {d.description && (
                    <p className="text-osrs-parchment-dark/70 text-sm">{d.description}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
