import type { Metadata, Route } from "next";
import Link from "next/link";
import { api } from "@/lib/api";
import { groupDocsByCategory } from "@/lib/docs";
import { ScrollPanel } from "@/components/scroll-panel";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Guides for using DropTracker — getting started, accounts, groups, and more.",
};

// TODO: swap these for the real repo URLs
const GITHUB_LINKS = [
  { label: "RuneLite Plugin", href: "https://github.com/joelhalen/droptracker-plugin" },
  { label: "Core", href: "https://github.com/DropTracker-io/droptracker-core" },
  { label: "Web", href: "https://github.com/DropTracker-io/droptracker-web" },
];

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export default async function DocsIndexPage() {
  const groups = groupDocsByCategory(await api.docs());

  return (
    <ScrollPanel>
      <header className="relative mb-8 text-center">
        {/* Compact dev-docs button — pinned to the corner on wider screens so it
            doesn't push the page content down. */}
        <Link
          href={"/docs/dev" as Route}
          title="Internal workings — API, architecture, and contributor guides"
          className="ink-link ink-rule absolute right-0 top-0 hidden items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-80 sm:inline-flex"
        >
          <span aria-hidden="true">{"</>"}</span>
          Developer Docs
        </Link>

        <h1 className="ink-heading text-2xl font-bold sm:text-3xl">Documentation</h1>
        <p className="ink-muted mt-2">
          Everything you need to track loot, run a clan, and configure the DropTracker.
        </p>

        {/* On small screens the corner button would collide with the title,
            so it drops inline below the subtitle instead. */}
        <Link
          href={"/docs/dev" as Route}
          className="ink-link ink-rule mt-3 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium sm:hidden"
        >
          <span aria-hidden="true">{"</>"}</span>
          Developer Docs
        </Link>
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

      {/* Source links for the three parts of the app */}
      <footer className="ink-rule mt-10 border-t pt-4">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <span className="ink-muted">Source code:</span>
          {GITHUB_LINKS.map((repo) => (
            <a
              key={repo.label}
              href={repo.href}
              target="_blank"
              rel="noopener noreferrer"
              className="ink-link inline-flex items-center gap-1.5 font-medium"
            >
              <GitHubIcon className="h-4 w-4" />
              {repo.label}
            </a>
          ))}
        </div>
      </footer>
    </ScrollPanel>
  );
}