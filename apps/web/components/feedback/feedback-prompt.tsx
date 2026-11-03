"use client";

/**
 * The feedback card (web155a). Mounted once in the site chrome; renders
 * nothing unless staff have asked this visitor for feedback at
 * /admin/feedback and they haven't answered, snoozed or declined it.
 *
 * It's a small card in the corner rather than a dialog, so it never blocks
 * the page:
 * - it waits for the page to settle and the tab to be visible, and longer
 *   than a pop-up notice so the two don't open together;
 * - step one is just the 1-10 score; picking one opens the two questions;
 * - "Not now" (and the X) bring it back in 14 days, "Don't ask again" never;
 * - closing after picking a score still sends that score, so a quick tap
 *   counts.
 */
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { FeedbackGroup } from "@droptracker/api-types";
import {
  loadFeedbackPrompt,
  markFeedbackSeen,
  snoozeFeedback,
  submitFeedback,
} from "@/app/(site)/feedback-actions";
import { Alert, Button, cn } from "@/components/ui";
import {
  FEEDBACK_OPEN_DELAY_MS,
  blankDraft,
  closedKey,
  initialGroupId,
  toAnswer,
  type FeedbackDraft,
} from "@/lib/feedback";
import { useMe } from "@/lib/use-me";
import { useInBuilderPreview } from "@/lib/page-layout/preview-frame";
import { FeedbackDetails, GroupPicker, RatingRow } from "./feedback-form";

/** Pages where the card would get in the way. */
const QUIET_PREFIXES = ["/admin/feedback", "/feedback"];

function wasClosed(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) != null;
  } catch {
    return false;
  }
}

function rememberClosed(key: string) {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    /* private mode: the server record still holds */
  }
}

export function FeedbackPrompt() {
  const me = useMe();
  const inPreview = useInBuilderPreview();
  if (!me || inPreview) return null;
  return <FeedbackPromptInner userId={me.user_id} />;
}

type Loaded = { requestId: number; groups: FeedbackGroup[] };

function FeedbackPromptInner({ userId }: { userId: number }) {
  const pathname = usePathname();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = () => {
      loadFeedbackPrompt()
        .then((res) => {
          if (cancelled || !res.prompt) return;
          if (wasClosed(closedKey(userId, res.prompt.request_id))) return;
          setLoaded({ requestId: res.prompt.request_id, groups: res.groups });
        })
        .catch(() => {
          /* never surface an error for an unsolicited card */
        });
    };
    const start = () => {
      timer = setTimeout(load, FEEDBACK_OPEN_DELAY_MS);
    };
    if (document.visibilityState === "visible") start();
    const onVisible = () => {
      if (document.visibilityState !== "visible" || timer) return;
      start();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);

  const quiet = QUIET_PREFIXES.some((p) => pathname?.startsWith(p));
  if (!loaded || quiet) return null;
  return (
    <FeedbackCard
      key={loaded.requestId}
      userId={userId}
      requestId={loaded.requestId}
      groups={loaded.groups}
      startGroupId={initialGroupId(loaded.groups, pathname)}
      onGone={() => setLoaded(null)}
    />
  );
}

function FeedbackCard({
  userId,
  requestId,
  groups,
  startGroupId,
  onGone,
}: {
  userId: number;
  requestId: number;
  groups: FeedbackGroup[];
  startGroupId: number | null;
  onGone: () => void;
}) {
  const [draft, setDraft] = useState<FeedbackDraft>(() => blankDraft(startGroupId));
  const [phase, setPhase] = useState<"ask" | "sending" | "thanks">("ask");
  const [error, setError] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const titleId = useId();
  const seen = useRef(false);

  const group = groups.find((g) => g.group_id === draft.groupId) ?? null;
  const key = closedKey(userId, requestId);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    if (!seen.current) {
      seen.current = true;
      markFeedbackSeen(requestId).catch(() => {});
    }
    return () => cancelAnimationFrame(raf);
  }, [requestId]);

  useEffect(() => {
    if (phase !== "thanks") return;
    const t = setTimeout(onGone, 4000);
    return () => clearTimeout(t);
  }, [phase, onGone]);

  const send = async (): Promise<boolean> => {
    const answer = toAnswer(draft, requestId);
    if (!answer) return false;
    setPhase("sending");
    setError(null);
    const res = await submitFeedback(answer).catch(() => ({
      ok: false as const,
      error: "Couldn't send that. Please try again.",
    }));
    if (!res.ok) {
      setPhase("ask");
      setError(res.error);
      return false;
    }
    rememberClosed(key);
    setPhase("thanks");
    return true;
  };

  /** "Not now", the X and "Don't ask again". A score already picked is
   * sent rather than lost. */
  const close = (forever: boolean) => {
    rememberClosed(key);
    if (draft.rating != null) {
      const answer = toAnswer(draft, requestId);
      if (answer) submitFeedback(answer).catch(() => {});
    } else {
      snoozeFeedback(requestId, forever).catch(() => {});
    }
    onGone();
  };

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className={cn(
        "card-pop fixed inset-x-2 bottom-20 z-40 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-xl p-4 transition-all duration-300 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:w-[23rem]",
        entered ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
    >
      {phase === "thanks" ? (
        <div className="flex items-start justify-between gap-3">
          <p className="text-osrs-gold text-sm font-semibold">Thanks. We read every one of these.</p>
          <CloseX onClick={onGone} />
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-osrs-parchment-dark/60 text-[11px] font-semibold tracking-wide uppercase">
                Quick question
              </p>
              <h2 id={titleId} className="text-osrs-gold mt-0.5 text-base leading-snug font-semibold">
                {group
                  ? `How would you rate The DropTracker for ${group.name}?`
                  : "How would you rate The DropTracker?"}
              </h2>
            </div>
            <CloseX onClick={() => close(false)} />
          </div>

          <div className="space-y-3">
            <GroupPicker
              groups={groups}
              value={draft.groupId}
              onChange={(groupId) => setDraft({ ...draft, groupId })}
            />
            <RatingRow
              value={draft.rating}
              labelledBy={titleId}
              onChange={(rating) => setDraft({ ...draft, rating })}
            />

            {draft.rating != null && (
              <>
                <FeedbackDetails draft={draft} onChange={setDraft} />
                {error && <Alert variant="error">{error}</Alert>}
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="w-full"
                  disabled={phase === "sending"}
                  onClick={() => void send()}
                >
                  {phase === "sending" ? "Sending..." : "Send feedback"}
                </Button>
              </>
            )}
          </div>

          <div className="text-osrs-parchment-dark/60 mt-3 flex justify-center gap-3 text-xs">
            <button type="button" className="hover:text-osrs-gold-bright" onClick={() => close(false)}>
              Not now
            </button>
            <span aria-hidden>·</span>
            <button type="button" className="hover:text-osrs-gold-bright" onClick={() => close(true)}>
              Don&apos;t ask again
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function CloseX({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClick}
      className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright -m-1 shrink-0 p-1"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
      </svg>
    </button>
  );
}
