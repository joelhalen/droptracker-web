"use client";

/** The /feedback form (web155a): every question at once, no request. */
import Link from "next/link";
import { useId, useState } from "react";
import type { FeedbackGroup } from "@droptracker/api-types";
import { submitFeedback } from "@/app/(site)/feedback-actions";
import { Alert, Button, Card } from "@/components/ui";
import { blankDraft, toAnswer, type FeedbackDraft } from "@/lib/feedback";
import { FeedbackDetails, GroupPicker, RatingRow } from "./feedback-form";

export function FeedbackPage({
  groups,
  startGroupId,
}: {
  groups: FeedbackGroup[];
  startGroupId: number | null;
}) {
  const [draft, setDraft] = useState<FeedbackDraft>(() => blankDraft(startGroupId));
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const labelId = useId();

  if (sent) {
    return (
      <Card>
        <p className="text-osrs-gold font-semibold">Thanks. We read every one of these.</p>
        <div className="mt-3 flex gap-3 text-sm">
          <button
            type="button"
            className="text-osrs-gold-bright underline"
            onClick={() => {
              setDraft(blankDraft(startGroupId));
              setSent(false);
            }}
          >
            Send more
          </button>
          <Link href="/dashboard" className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright">
            Back to the dashboard
          </Link>
        </div>
      </Card>
    );
  }

  const answer = toAnswer(draft, null);
  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!answer) return;
          setSending(true);
          setError(null);
          const res = await submitFeedback(answer).catch(() => ({
            ok: false as const,
            error: "Couldn't send that. Please try again.",
          }));
          setSending(false);
          if (res.ok) setSent(true);
          else setError(res.error);
        }}
      >
        <GroupPicker
          groups={groups}
          value={draft.groupId}
          onChange={(groupId) => setDraft({ ...draft, groupId })}
        />
        <div>
          <p id={labelId} className="text-osrs-parchment mb-2 text-sm font-medium">
            How would you rate The DropTracker?
          </p>
          <RatingRow value={draft.rating} labelledBy={labelId} onChange={(rating) => setDraft({ ...draft, rating })} />
        </div>
        <FeedbackDetails draft={draft} onChange={setDraft} />
        {error && <Alert variant="error">{error}</Alert>}
        <Button type="submit" variant="primary" disabled={!answer || sending}>
          {sending ? "Sending..." : "Send feedback"}
        </Button>
        {!answer && <p className="text-osrs-parchment-dark/60 text-xs">Pick a score to send.</p>}
      </form>
    </Card>
  );
}
