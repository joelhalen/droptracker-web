/**
 * Pure helpers for clan leader feedback (web155a), shared by the feedback
 * card in the site chrome, the /feedback page and the admin page.
 * `test/feedback.test.ts` pins them.
 */
import {
  FEEDBACK_RATING_MAX,
  FEEDBACK_RATING_MIN,
  type FeedbackAnswer,
  type FeedbackAttribution,
  type FeedbackGroup,
} from "@droptracker/api-types";

/** The card waits this long after the page settles, and longer than a
 * pop-up notice so the two never open on top of each other. */
export const FEEDBACK_OPEN_DELAY_MS = 4000;

export const RATINGS: number[] = Array.from(
  { length: FEEDBACK_RATING_MAX - FEEDBACK_RATING_MIN + 1 },
  (_, i) => FEEDBACK_RATING_MIN + i,
);

/** The clan the card should start on: the one whose page the visitor is
 * on, if they lead it, otherwise their first (owners come first). */
export function initialGroupId(groups: FeedbackGroup[], pathname: string | null): number | null {
  const match = pathname?.match(/^\/groups\/(-?\d+)(?:\/|$)/);
  if (match) {
    const id = Number(match[1]);
    if (groups.some((g) => g.group_id === id)) return id;
  }
  return groups[0]?.group_id ?? null;
}

/** "Clan name only" is the default; without a clan there is no name to
 * show, so anonymous is. */
export function defaultAttribution(groupId: number | null): FeedbackAttribution {
  return groupId == null ? "anon" : "clan";
}

export function attributionOptions(
  hasGroup: boolean,
): { value: FeedbackAttribution; label: string }[] {
  return hasGroup
    ? [
        { value: "clan", label: "Clan name only" },
        { value: "full", label: "My name and clan" },
        { value: "anon", label: "Anonymous" },
      ]
    : [
        { value: "full", label: "My name" },
        { value: "anon", label: "Anonymous" },
      ];
}

export type FeedbackDraft = {
  rating: number | null;
  groupId: number | null;
  liked: string;
  improve: string;
  quoteConsent: boolean;
  attribution: FeedbackAttribution;
  contactOk: boolean;
};

export function blankDraft(groupId: number | null): FeedbackDraft {
  return {
    rating: null,
    groupId,
    liked: "",
    improve: "",
    quoteConsent: false,
    attribution: defaultAttribution(groupId),
    contactOk: false,
  };
}

/** The answer to send, or null while there is no score yet. */
export function toAnswer(draft: FeedbackDraft, requestId: number | null): FeedbackAnswer | null {
  if (draft.rating == null) return null;
  return {
    request_id: requestId,
    group_id: draft.groupId,
    rating: draft.rating,
    liked_text: draft.liked.trim(),
    improve_text: draft.improve.trim(),
    quote_consent: draft.quoteConsent,
    attribution: draft.attribution,
    contact_ok: draft.contactOk,
  };
}

/** Shown in the admin list and the Discord post colour: red, amber, green. */
export function ratingBand(rating: number): "low" | "mid" | "high" {
  if (rating >= 8) return "high";
  if (rating >= 5) return "mid";
  return "low";
}

/** sessionStorage key: a card closed in this tab stays closed even if the
 * snooze request never reached the server. */
export function closedKey(userId: number, requestId: number): string {
  return `dt:feedback:closed:${userId}:${requestId}`;
}
