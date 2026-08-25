"use client";

/**
 * A suggestion/bug thread inside the widget: compact rendering of the same
 * data the `/suggestions/[id]` page shows, reusing the existing `submitReply`
 * server action. Replies append locally (no `router.refresh()` — the widget
 * owns its own state).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useTransition } from "react";
import type { SuggestionDetail } from "@droptracker/api-types";
import { submitReply } from "@/app/(site)/(public)/suggestions/actions";
import { loadSuggestion, markSuggestionRead } from "@/app/(site)/support-actions";
import { Markdown } from "@/components/markdown";
import { Alert, Badge, Button, SkeletonRows } from "@/components/ui";
import { getErrorMessage } from "@/lib/errors";
import { formatRelativeTime } from "@/lib/format";
import { useChatWidget } from "./widget-context";

export function SuggestionView({ suggestionId }: { suggestionId: number }) {
  const { clearUnread, hint } = useChatWidget();
  const [suggestion, setSuggestion] = useState<SuggestionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const seenHintSeq = useRef(0);

  const load = useCallback(async () => {
    const detail = await loadSuggestion(suggestionId);
    setSuggestion(detail);
    setError(null);
    const newest = detail.messages.reduce((max, m) => Math.max(max, m.id), 0);
    if (newest > 0) {
      void markSuggestionRead(suggestionId, newest).catch(() => {
        // Cosmetic; the badge clears on the next successful receipt.
      });
    }
    clearUnread("suggestion", suggestionId);
  }, [suggestionId, clearUnread]);

  useEffect(() => {
    setSuggestion(null);
    setError(null);
    load().catch((err) => setError(getErrorMessage(err, "Couldn't load this suggestion.")));
  }, [load]);

  useEffect(() => {
    if (!hint || hint.seq === seenHintSeq.current) return;
    seenHintSeq.current = hint.seq;
    if (hint.surface === "suggestion" && hint.refId === suggestionId) {
      load().catch(() => {});
    }
  }, [hint, suggestionId, load]);

  if (error) {
    return (
      <div className="p-3">
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }
  if (!suggestion) {
    return (
      <div className="p-3">
        <SkeletonRows rows={5} />
      </div>
    );
  }

  const send = () => {
    const content = draft.trim();
    // SuggestionReplyCreateSchema floor: 2 characters.
    if (content.length < 2 || sending) return;
    setReplyError(null);
    startSending(async () => {
      try {
        const posted = await submitReply(suggestionId, content);
        setDraft("");
        setSuggestion((prev) =>
          prev
            ? {
                ...prev,
                messages: [...prev.messages.filter((m) => m.id !== posted.id), posted],
                message_count: prev.message_count + 1,
              }
            : prev,
        );
      } catch (err) {
        setReplyError(getErrorMessage(err, "Couldn't post that reply."));
      }
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-osrs-bronze/25 flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2">
        <Badge variant={suggestion.type === "bug" ? "red" : "purple"} size="sm">
          {suggestion.type === "bug" ? "Bug" : "Suggestion"}
        </Badge>
        {!suggestion.is_open && (
          <Badge variant="neutral" size="sm">
            Closed
          </Badge>
        )}
        <Link
          href={`/suggestions/${suggestion.id}` as Route}
          className="text-osrs-gold-bright ml-auto text-xs hover:underline"
        >
          Open full page →
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <p className="text-osrs-parchment text-sm font-semibold">{suggestion.title}</p>
        <p className="text-osrs-parchment-dark/50 mb-2 text-xs">
          By {suggestion.author_name ?? "unknown"} · {formatRelativeTime(suggestion.created_at)}
        </p>
        <Markdown className="prose-sm" mentions={suggestion.mentions}>
          {suggestion.body_md}
        </Markdown>

        <div className="border-osrs-bronze/20 mt-4 border-t pt-2">
          {suggestion.messages.length === 0 ? (
            <p className="text-osrs-parchment-dark/50 text-xs">No replies yet.</p>
          ) : (
            suggestion.messages.map((m) => (
              <div key={m.id} className="border-osrs-bronze/15 border-b py-2 last:border-b-0">
                <p className="text-osrs-parchment-dark/50 text-xs">
                  <span className="text-osrs-parchment font-semibold">{m.author_name}</span>{" "}
                  {m.source === "discord" ? "via Discord" : "via the website"} ·{" "}
                  {formatRelativeTime(m.created_at)}
                </p>
                <Markdown className="prose-sm" mentions={suggestion.mentions}>
                  {m.content}
                </Markdown>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="border-osrs-bronze/25 shrink-0 border-t px-4 py-3">
        {suggestion.is_open ? (
          <div className="space-y-2">
            {replyError && <Alert variant="error">{replyError}</Alert>}
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder="Join the discussion…"
                disabled={sending}
                aria-label="Suggestion reply"
                className="border-osrs-bronze/30 bg-osrs-brown-dark/40 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 focus:border-osrs-gold/50 min-w-0 flex-1 resize-y rounded border px-3 py-2 text-sm outline-none disabled:opacity-50"
              />
              <Button
                variant="secondary"
                size="xs"
                className="shrink-0 px-3"
                onClick={send}
                disabled={sending || draft.trim().length < 2}
              >
                {sending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-osrs-parchment-dark/60 text-xs">
            This thread is closed on Discord, so replies are disabled.
          </p>
        )}
      </div>
    </div>
  );
}
