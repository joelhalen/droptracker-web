"use client";

/**
 * The feedback questions (web155a), shared by the slide-in card and the
 * /feedback page. The card shows the score row first and opens the rest once
 * a score is picked; the page shows everything at once.
 */
import { useId } from "react";
import {
  FEEDBACK_TEXT_MAX,
  type FeedbackAttribution,
  type FeedbackGroup,
} from "@droptracker/api-types";
import { Checkbox, Select, Textarea, cn } from "@/components/ui";
import { RATINGS, attributionOptions, defaultAttribution, type FeedbackDraft } from "@/lib/feedback";

export function RatingRow({
  value,
  onChange,
  labelledBy,
}: {
  value: number | null;
  onChange: (rating: number) => void;
  labelledBy?: string;
}) {
  return (
    <div>
      <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-5 gap-1.5 min-[400px]:grid-cols-10 min-[400px]:gap-1">
        {RATINGS.map((n) => {
          const on = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(n)}
              className={cn(
                "h-9 rounded-md border text-sm font-semibold transition-colors",
                on
                  ? "border-osrs-gold bg-osrs-gold text-osrs-brown-dark"
                  : "border-osrs-bronze/40 bg-osrs-surface-1 text-osrs-parchment hover:border-osrs-gold/60 hover:text-osrs-gold-bright",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="text-osrs-parchment-dark/60 mt-1 flex justify-between text-[11px]">
        <span>Needs work</span>
        <span>Love it</span>
      </div>
    </div>
  );
}

export function GroupPicker({
  groups,
  value,
  onChange,
}: {
  groups: FeedbackGroup[];
  value: number | null;
  onChange: (groupId: number) => void;
}) {
  const id = useId();
  if (groups.length < 2) return null;
  return (
    <label htmlFor={id} className="text-osrs-parchment-dark/80 flex items-center gap-2 text-xs">
      Answering for
      <Select
        id={id}
        value={value == null ? "" : String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="py-1 text-xs"
      >
        {groups.map((g) => (
          <option key={g.group_id} value={g.group_id}>
            {g.name}
          </option>
        ))}
      </Select>
    </label>
  );
}

function CountedTextarea({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  const left = FEEDBACK_TEXT_MAX - value.length;
  return (
    <div>
      <label htmlFor={id} className="text-osrs-parchment mb-1 block text-sm font-medium">
        {label}
      </label>
      <Textarea
        id={id}
        rows={3}
        value={value}
        maxLength={FEEDBACK_TEXT_MAX}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y text-sm"
      />
      {left < 100 && (
        <p className={cn("mt-0.5 text-right text-[11px]", left < 20 ? "text-osrs-red" : "text-osrs-parchment-dark/60")}>
          {left} left
        </p>
      )}
    </div>
  );
}

/** Everything after the score: the two questions and the permissions. */
export function FeedbackDetails({
  draft,
  onChange,
}: {
  draft: FeedbackDraft;
  onChange: (draft: FeedbackDraft) => void;
}) {
  const set = (patch: Partial<FeedbackDraft>) => onChange({ ...draft, ...patch });
  const hasGroup = draft.groupId != null;
  const options = attributionOptions(hasGroup);
  // A clan switch to "none" can leave an option that no longer exists.
  const attribution: FeedbackAttribution = options.some((o) => o.value === draft.attribution)
    ? draft.attribution
    : defaultAttribution(draft.groupId);
  const radioName = useId();

  return (
    <div className="space-y-3">
      <CountedTextarea
        label={hasGroup ? "What's working best for your clan?" : "What's working best for you?"}
        placeholder="Loot boards, events, notifications..."
        value={draft.liked}
        onChange={(liked) => set({ liked })}
      />
      <CountedTextarea
        label="What would you change or add?"
        placeholder="Anything missing, confusing or annoying"
        value={draft.improve}
        onChange={(improve) => set({ improve })}
      />

      <div className="space-y-2">
        <label className="text-osrs-parchment flex items-start gap-2 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={draft.quoteConsent}
            onChange={(e) => set({ quoteConsent: e.target.checked, attribution })}
          />
          <span>You can share this quote on The DropTracker&apos;s site and Discord</span>
        </label>
        {draft.quoteConsent && (
          <fieldset className="ml-6">
            <legend className="text-osrs-parchment-dark/70 mb-1 text-xs">Show it as</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {options.map((o) => (
                <label key={o.value} className="text-osrs-parchment flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name={radioName}
                    value={o.value}
                    checked={attribution === o.value}
                    onChange={() => set({ attribution: o.value })}
                    className="accent-osrs-gold"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label className="text-osrs-parchment flex items-start gap-2 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={draft.contactOk}
            onChange={(e) => set({ contactOk: e.target.checked })}
          />
          <span>OK to message me on Discord about this</span>
        </label>
      </div>
    </div>
  );
}
