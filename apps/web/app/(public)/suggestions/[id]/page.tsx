import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { MentionMap, SuggestionMessage } from "@droptracker/api-types";
import { api, ApiError } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { ScrollPanel } from "@/components/scroll-panel";
import { SuggestionReplyForm } from "@/components/suggestion-reply-form";
import { formatRelativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  try {
    const s = await api.suggestion(Number(id));
    return { title: s.title };
  } catch {
    return { title: "Suggestions" };
  }
}

function Reply({ m, mentions }: { m: SuggestionMessage; mentions?: MentionMap }) {
  return (
    <div className="ink-rule border-t py-4">
      <p className="ink-muted mb-2 text-xs">
        <span className="ink-heading font-semibold">{m.author_name}</span>{" "}
        {m.source === "discord" ? "via Discord" : "via the website"} ·{" "}
        {formatRelativeTime(m.created_at)}
        {m.edited_at && <span className="italic"> (edited)</span>}
      </p>
      <Markdown tone="ink" className="prose-sm" mentions={mentions}>
        {m.content}
      </Markdown>
    </div>
  );
}

export default async function SuggestionThreadPage({ params }: { params: Params }) {
  const { id } = await params;
  const suggestionId = Number(id);
  if (!Number.isInteger(suggestionId) || suggestionId < 1) notFound();

  let s;
  try {
    s = await api.suggestion(suggestionId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const user = await getUser();

  return (
    <div className="space-y-6">
      <Link href="/suggestions" className="text-osrs-parchment-dark/60 text-sm hover:underline">
        ← All suggestions
      </Link>

      <ScrollPanel>
        <header className="mb-6 text-center">
          <h1 className="ink-heading text-xl font-bold sm:text-2xl">
            {s.type === "bug" ? "\u{1F41B}" : "\u{1F4A1}"} {s.title}
          </h1>
          <p className="ink-muted mt-2 text-sm">
            Started by <span className="ink-heading font-semibold">{s.author_name}</span>{" "}
            {s.origin === "discord" ? "in Discord" : "on the website"} ·{" "}
            {formatRelativeTime(s.created_at)}
            {!s.is_open && " · closed"}
            {s.status === "pending" && " · syncing to Discord…"}
            {s.discord_thread_url && (
              <>
                {" · "}
                <a href={s.discord_thread_url} target="_blank" rel="noreferrer" className="ink-link">
                  Open in Discord ↗
                </a>
              </>
            )}
          </p>
        </header>

        <Markdown tone="ink" mentions={s.mentions}>
          {s.body_md}
        </Markdown>

        <div className="mt-8">
          <h2 className="ink-heading mb-1 text-base font-semibold">
            {s.messages.length === 0
              ? "No replies yet"
              : `${s.messages.length} ${s.messages.length === 1 ? "reply" : "replies"}`}
          </h2>
          {s.messages.map((m) => (
            <Reply key={m.id} m={m} mentions={s.mentions} />
          ))}
        </div>
      </ScrollPanel>

      <div className="mx-auto max-w-2xl">
        {s.is_open ? (
          user ? (
            <SuggestionReplyForm suggestionId={s.id} />
          ) : (
            <Card padding="p-4">
              <p className="text-osrs-parchment-dark/70 text-sm">
                <a
                  href={`/api/auth/login?redirect=${encodeURIComponent(`/suggestions/${s.id}`)}`}
                  className="text-osrs-gold-bright hover:underline"
                >
                  Sign in with Discord
                </a>{" "}
                to join the discussion — replies are mirrored into the Discord thread.
              </p>
            </Card>
          )
        ) : (
          <p className="text-osrs-parchment-dark/50 text-center text-sm">
            This thread is closed on Discord, so replies are disabled.
          </p>
        )}
      </div>
    </div>
  );
}
