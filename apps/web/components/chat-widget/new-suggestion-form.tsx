"use client";

/**
 * New suggestion/bug from the widget — a compact take on `/suggestions/new`,
 * reusing the existing `submitSuggestion` server action (which mirrors the
 * thread into the Discord forum). Success swaps to the suggestion view.
 */
import { useState, useTransition } from "react";
import type { SuggestionType } from "@droptracker/api-types";
import { submitSuggestion } from "@/app/(site)/(public)/suggestions/actions";
import { Alert, Button } from "@/components/ui";
import { getErrorMessage } from "@/lib/errors";
import { useChatWidget } from "./widget-context";

// Mirrors SuggestionCreateSchema (title 5..100, body 20..4000).
const TITLE_MIN = 5;
const TITLE_MAX = 100;
const BODY_MIN = 20;
const BODY_MAX = 4000;

export function NewSuggestionForm() {
  const { replace, refreshInbox } = useChatWidget();
  const [type, setType] = useState<SuggestionType>("suggestion");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmitting] = useTransition();

  const titleOk = title.trim().length >= TITLE_MIN && title.trim().length <= TITLE_MAX;
  const bodyOk = body.trim().length >= BODY_MIN && body.trim().length <= BODY_MAX;

  const submit = () => {
    if (!titleOk || !bodyOk || submitting) return;
    setError(null);
    startSubmitting(async () => {
      try {
        const created = await submitSuggestion({
          type,
          title: title.trim(),
          body_md: body.trim(),
        });
        refreshInbox();
        replace({ kind: "suggestion", suggestionId: created.id });
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't post that. Please try again."));
      }
    });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex gap-2" role="radiogroup" aria-label="Thread type">
        {(
          [
            { value: "suggestion", label: "\u{1F4A1} Suggestion" },
            { value: "bug", label: "\u{1F41B} Bug report" },
          ] as const
        ).map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={type === t.value}
            onClick={() => setType(t.value)}
            className={`rounded border px-2.5 py-1.5 text-xs transition-colors ${
              type === t.value
                ? "border-osrs-gold/60 bg-osrs-gold/10 text-osrs-parchment"
                : "border-osrs-bronze/30 text-osrs-parchment-dark/80 hover:border-osrs-gold/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={TITLE_MAX}
        placeholder="Title (also names the Discord thread)"
        disabled={submitting}
        aria-label="Title"
        className="border-osrs-bronze/30 bg-osrs-brown-dark/40 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 focus:border-osrs-gold/50 mb-2 w-full rounded border px-3 py-2 text-sm outline-none disabled:opacity-50"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        placeholder={
          type === "bug"
            ? "What happened, what you expected, and steps to reproduce. Markdown works."
            : "What would you like to see, and why? Markdown works."
        }
        disabled={submitting}
        aria-label="Body"
        className="border-osrs-bronze/30 bg-osrs-brown-dark/40 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 focus:border-osrs-gold/50 mb-1 w-full resize-y rounded border px-3 py-2 text-sm outline-none disabled:opacity-50"
      />
      <p className="text-osrs-parchment-dark/50 mb-3 text-xs">
        {body.trim().length < BODY_MIN
          ? `At least ${BODY_MIN} characters.`
          : `${body.length} / ${BODY_MAX}`}
      </p>

      {error && (
        <Alert variant="error" className="mb-3">
          {error}
        </Alert>
      )}

      <div className="mt-auto flex items-center justify-between gap-2">
        <p className="text-osrs-parchment-dark/50 text-xs">
          Posted publicly and mirrored to the Discord forum.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={submit}
          disabled={submitting || !titleOk || !bodyOk}
        >
          {submitting ? "Posting…" : "Post"}
        </Button>
      </div>
    </div>
  );
}
