"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitReply } from "@/app/(public)/suggestions/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";

const REPLY_MAX = 1800;

export function SuggestionReplyForm({ suggestionId }: { suggestionId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await submitReply(suggestionId, content);
        setContent("");
        router.refresh();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't post the reply. Try again."));
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="border-osrs-bronze/40 bg-osrs-brown-dark/40 rounded border">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-24 w-full resize-y bg-transparent px-3 py-2 text-sm outline-none"
          maxLength={REPLY_MAX}
          placeholder="Write a reply — Markdown works, and it's mirrored into the Discord thread."
          required
        />
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || content.trim().length < 2}
          className="bg-osrs-gold text-osrs-brown-dark hover:bg-osrs-gold-bright rounded px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Posting…" : "Post reply"}
        </button>
        <span className="text-osrs-parchment-dark/50 text-xs">
          {content.length}/{REPLY_MAX}
        </span>
      </div>
    </form>
  );
}
