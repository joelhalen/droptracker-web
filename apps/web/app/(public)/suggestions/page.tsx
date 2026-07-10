import type { Metadata } from "next";
import Link from "next/link";
import type { SuggestionSummary } from "@droptracker/api-types";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Badge, Card, EmptyState } from "@/components/ui";
import { formatRelativeTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Suggestions & bug reports",
  description:
    "Community suggestions and bug reports for DropTracker — mirrored live with the Discord forums.",
};
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ page?: string; tab?: string }>;

const TABS = [
  { key: "all", label: "All" },
  { key: "suggestion", label: "\u{1F4A1} Suggestions" },
  { key: "bug", label: "\u{1F41B} Bugs" },
  { key: "mine", label: "My posts" },
] as const;

function ThreadRow({ s }: { s: SuggestionSummary }) {
  return (
    <Link
      href={`/suggestions/${s.id}`}
      className="hover:bg-osrs-bronze/10 block px-4 py-3 transition-colors"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg" title={s.type === "bug" ? "Bug report" : "Suggestion"}>
          {s.type === "bug" ? "\u{1F41B}" : "\u{1F4A1}"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-osrs-gold-bright truncate font-medium">{s.title}</span>
            {!s.is_open && <Badge tone="neutral">Closed</Badge>}
            {s.status === "pending" && (
              <Badge tone="bronze" title="Queued to appear in Discord">
                Syncing…
              </Badge>
            )}
            {s.origin === "discord" && (
              <Badge tone="sky" title="Started in the Discord forum">
                From Discord
              </Badge>
            )}
          </div>
          <p className="text-osrs-parchment-dark/60 mt-0.5 truncate text-sm">{s.excerpt}</p>
          <p className="text-osrs-parchment-dark/50 mt-1 text-xs">
            {s.author_name} · {s.message_count}{" "}
            {s.message_count === 1 ? "reply" : "replies"} · active{" "}
            {formatRelativeTime(s.last_activity_at ?? s.created_at)}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default async function SuggestionsPage({ searchParams }: { searchParams: SearchParams }) {
  const { page, tab } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const activeTab = TABS.some((t) => t.key === tab) ? (tab as (typeof TABS)[number]["key"]) : "all";

  const user = await getUser();
  const data = await api.suggestions({
    page: pageNum,
    type: activeTab === "suggestion" || activeTab === "bug" ? activeTab : undefined,
    mine: activeTab === "mine" && user != null ? true : undefined,
  });
  const totalPages = Math.max(1, Math.ceil(data.meta.total / data.meta.limit));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-osrs-gold text-2xl font-bold">Suggestions &amp; bug reports</h1>
          <p className="text-osrs-parchment-dark/70 mt-1 text-sm">
            Threads here are mirrored live with our{" "}
            <a href="/discord" className="text-osrs-gold-bright hover:underline">
              Discord forums
            </a>{" "}
            — post and reply from whichever you prefer.
          </p>
        </div>
        <Link
          href={user ? "/suggestions/new" : "/api/auth/login?redirect=%2Fsuggestions%2Fnew"}
          className="bg-osrs-gold text-osrs-brown-dark hover:bg-osrs-gold-bright rounded px-4 py-2 text-sm font-semibold transition-colors"
        >
          + New post
        </Link>
      </div>

      <div className="border-osrs-bronze/25 flex flex-wrap gap-1 border-b text-sm">
        {TABS.filter((t) => t.key !== "mine" || user != null).map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/suggestions" : `/suggestions?tab=${t.key}`}
            className={`rounded-t border-x border-t px-3 py-1.5 transition-colors ${
              activeTab === t.key
                ? "border-osrs-bronze/40 bg-osrs-brown-dark/40 text-osrs-gold"
                : "text-osrs-parchment-dark/60 hover:text-osrs-parchment border-transparent"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {data.items.length === 0 ? (
        <EmptyState
          title="No threads yet"
          hint="Be the first — new posts appear here and in the Discord forum at the same time."
        />
      ) : (
        <Card padding="p-0">
          <div className="divide-osrs-bronze/15 divide-y">
            {data.items.map((s) => (
              <ThreadRow key={s.id} s={s} />
            ))}
          </div>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="text-osrs-parchment-dark/70 flex items-center gap-3 text-sm">
          {pageNum > 1 && (
            <Link
              href={`/suggestions?tab=${activeTab}&page=${pageNum - 1}`}
              className="text-osrs-gold-bright hover:underline"
            >
              ← Newer
            </Link>
          )}
          <span>
            Page {pageNum} of {totalPages}
          </span>
          {pageNum < totalPages && (
            <Link
              href={`/suggestions?tab=${activeTab}&page=${pageNum + 1}`}
              className="text-osrs-gold-bright hover:underline"
            >
              Older →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
