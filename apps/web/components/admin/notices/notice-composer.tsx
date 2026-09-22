"use client";

/**
 * Write, target and send a pop-up notice (web118a).
 *
 * Left: the message, its look, who gets it and when. Right: a live copy of the
 * card as visitors will see it, plus "Preview pop-up" to open the real thing
 * over this page. Sending asks once more, with the audience count, before
 * anything goes out.
 */
import { useState, useTransition } from "react";
import {
  NOTICE_BODY_MAX,
  NOTICE_CTA_LABEL_MAX,
  NOTICE_TITLE_MAX,
  isAllowedNoticeLink,
  type AdminPopupNotice,
  type NoticeLabels,
  type NoticeOptions,
  type NoticeRule,
  type NoticeSize,
  type NoticeTone,
  type PopupNoticeInput,
} from "@droptracker/api-types";
import { createNotice, sendNotice, updateNotice } from "@/app/(site)/(admin)/admin/notices/actions";
import { NoticeDialog, NoticeInlinePreview } from "@/components/site-notices/notice-dialog";
import { Alert, Button, Field, Input, ToggleChip } from "@/components/ui";
import { getErrorMessage } from "@/lib/errors";
import { audienceProblem, localInputToUnix, unixToLocalInput } from "@/lib/site-notices";
import { AudienceBuilder } from "./audience-builder";
import { MarkdownEditor } from "./markdown-editor";

type Draft = {
  title: string;
  body_md: string;
  cta_label: string;
  cta_url: string;
  tone: NoticeTone;
  size: NoticeSize;
  audience: NoticeRule[];
  starts_at: string;
  expires_at: string;
};

const TONES: { value: NoticeTone; label: string }[] = [
  { value: "info", label: "Notice" },
  { value: "important", label: "Important" },
  { value: "success", label: "Good news" },
];

const SIZES: { value: NoticeSize; label: string }[] = [
  { value: "sm", label: "Compact" },
  { value: "md", label: "Standard" },
  { value: "lg", label: "Wide" },
];

const END_PRESETS: { label: string; days: number }[] = [
  { label: "1 day", days: 1 },
  { label: "1 week", days: 7 },
  { label: "30 days", days: 30 },
];

function toDraft(n?: AdminPopupNotice): Draft {
  return {
    title: n?.title ?? "",
    body_md: n?.body_md ?? "",
    cta_label: n?.cta_label ?? "",
    cta_url: n?.cta_url ?? "",
    tone: n?.tone ?? "info",
    size: n?.size ?? "md",
    audience: n?.audience ?? [],
    starts_at: unixToLocalInput(n?.starts_at ?? null),
    expires_at: unixToLocalInput(n?.expires_at ?? null),
  };
}

function toInput(d: Draft): PopupNoticeInput {
  return {
    title: d.title.trim(),
    body_md: d.body_md.trim(),
    cta_label: d.cta_label.trim() || null,
    cta_url: d.cta_url.trim() || null,
    tone: d.tone,
    size: d.size,
    audience: d.audience,
    starts_at: localInputToUnix(d.starts_at),
    expires_at: localInputToUnix(d.expires_at),
  };
}

/** Everything that blocks saving, keyed by field, in the backend's words. */
function problems(d: Draft, sending: boolean): Partial<Record<keyof Draft, string>> {
  const out: Partial<Record<keyof Draft, string>> = {};
  if (!d.title.trim()) out.title = "Give it a title.";
  if (!d.body_md.trim()) out.body_md = "Write a message.";
  const label = d.cta_label.trim();
  const url = d.cta_url.trim();
  if (Boolean(label) !== Boolean(url)) out.cta_url = "A button needs both a label and a link.";
  else if (url && !isAllowedNoticeLink(url)) out.cta_url = "Use a site path like /premium or a full https:// link.";
  const audience = audienceProblem(d.audience);
  if (audience) out.audience = audience;
  const start = localInputToUnix(d.starts_at);
  const end = localInputToUnix(d.expires_at);
  if (start && end && end <= start) out.expires_at = "The end must be after the start.";
  else if (sending && end && end * 1000 <= Date.now()) out.expires_at = "The end is already in the past.";
  return out;
}

export function NoticeComposer({
  editing,
  options,
  labels: initialLabels,
  onSaved,
  onCancel,
}: {
  /** The notice being edited, or undefined for a new one (possibly prefilled). */
  editing?: { notice: AdminPopupNotice; mode: "edit" | "duplicate" };
  options: NoticeOptions;
  labels: NoticeLabels;
  onSaved: (notice: AdminPopupNotice, verb: "saved" | "sent") => void;
  onCancel: () => void;
}) {
  const isEdit = editing?.mode === "edit";
  const [draft, setDraft] = useState<Draft>(() => {
    const d = toDraft(editing?.notice);
    // A duplicate is a fresh notice: its old schedule is almost never right.
    return editing?.mode === "duplicate" ? { ...d, starts_at: "", expires_at: "" } : d;
  });
  const [labels, setLabels] = useState<NoticeLabels>(initialLabels);
  const [showErrors, setShowErrors] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reach, setReach] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setConfirmSend(false);
  };

  const errs = showErrors ? problems(draft, confirmSend) : {};
  const liveEdit = isEdit && editing!.notice.status === "live";
  const canSend = !isEdit || editing!.notice.status === "draft";

  const save = (send: boolean) => {
    setShowErrors(true);
    if (Object.keys(problems(draft, send)).length > 0) {
      setConfirmSend(false);
      return;
    }
    if (send && !confirmSend) {
      setConfirmSend(true);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const input = toInput(draft);
        let saved: AdminPopupNotice;
        if (isEdit) {
          saved = await updateNotice(editing!.notice.id, input);
          if (send) saved = await sendNotice(saved.id);
        } else {
          saved = await createNotice(input, send);
        }
        onSaved(saved, send ? "sent" : "saved");
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save this notice."));
        setConfirmSend(false);
      }
    });
  };

  const previewContent = {
    title: draft.title,
    body_md: draft.body_md,
    cta_label: draft.cta_label.trim() || null,
    cta_url: draft.cta_url.trim() || null,
    tone: draft.tone,
    size: draft.size,
  };

  const setEndInDays = (days: number) => {
    const base = localInputToUnix(draft.starts_at) ?? Math.floor(Date.now() / 1000);
    set("expires_at", unixToLocalInput(base + days * 86400));
  };

  return (
    <div className="border-osrs-bronze/30 bg-osrs-surface-1/60 rounded-2xl border p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-osrs-gold text-lg font-semibold">
          {isEdit ? "Edit notice" : editing?.mode === "duplicate" ? "New notice (copy)" : "New notice"}
        </h2>
        {liveEdit && (
          <p className="text-osrs-parchment-dark/60 text-xs">
            This one is live. Changes reach people who haven&apos;t closed it yet. To show it to everyone again,
            duplicate it instead.
          </p>
        )}
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ---------------------------------------------------------- form */}
        <div className="min-w-0 space-y-6">
          <Section step={1} title="Message">
            <Field label="Title" error={errs.title}>
              {(p) => (
                <Input
                  {...p}
                  value={draft.title}
                  maxLength={NOTICE_TITLE_MAX}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. Clan points got an upgrade"
                  state={errs.title ? "error" : "default"}
                  className="w-full"
                />
              )}
            </Field>
            <Field label="Body" error={errs.body_md}>
              {(p) => (
                <MarkdownEditor
                  id={p.id}
                  describedBy={p["aria-describedby"]}
                  value={draft.body_md}
                  onChange={(v) => set("body_md", v)}
                  maxLength={NOTICE_BODY_MAX}
                />
              )}
            </Field>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <Field label="Button label" hint="Optional.">
                {(p) => (
                  <Input
                    {...p}
                    value={draft.cta_label}
                    maxLength={NOTICE_CTA_LABEL_MAX}
                    onChange={(e) => set("cta_label", e.target.value)}
                    placeholder="e.g. Take a look"
                    className="w-full"
                  />
                )}
              </Field>
              <Field
                label="Button link"
                hint="A site path like /premium, or a full https:// link. Clicking it also closes the notice."
                error={errs.cta_url}
              >
                {(p) => (
                  <Input
                    {...p}
                    value={draft.cta_url}
                    onChange={(e) => set("cta_url", e.target.value)}
                    placeholder="/premium"
                    state={errs.cta_url ? "error" : "default"}
                    className="w-full"
                  />
                )}
              </Field>
            </div>
          </Section>

          <Section step={2} title="Look">
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <Segmented
                label="Style"
                value={draft.tone}
                options={TONES}
                onChange={(v) => set("tone", v)}
              />
              <Segmented label="Width" value={draft.size} options={SIZES} onChange={(v) => set("size", v)} />
            </div>
          </Section>

          <Section step={3} title="Who sees it" note="Anyone matching at least one row.">
            <AudienceBuilder
              rules={draft.audience}
              onChange={(rules) => set("audience", rules)}
              options={options}
              labels={labels}
              onLabels={setLabels}
              onCount={setReach}
            />
            {errs.audience && <p className="text-osrs-red text-xs">{errs.audience}</p>}
          </Section>

          <Section step={4} title="When" note="Times are in your local time zone.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Starts" hint={draft.starts_at ? undefined : "Right away."}>
                {(p) => (
                  <Input
                    {...p}
                    type="datetime-local"
                    value={draft.starts_at}
                    onChange={(e) => set("starts_at", e.target.value)}
                    className="w-full"
                  />
                )}
              </Field>
              <Field label="Stops showing" hint={draft.expires_at ? undefined : "Never. It stays until each person closes it."} error={errs.expires_at}>
                {(p) => (
                  <Input
                    {...p}
                    type="datetime-local"
                    value={draft.expires_at}
                    onChange={(e) => set("expires_at", e.target.value)}
                    state={errs.expires_at ? "error" : "default"}
                    className="w-full"
                  />
                )}
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-osrs-parchment-dark/60 text-xs">Stop after:</span>
              {END_PRESETS.map((p) => (
                <ToggleChip key={p.days} onClick={() => setEndInDays(p.days)}>
                  {p.label}
                </ToggleChip>
              ))}
              {(draft.starts_at || draft.expires_at) && (
                <button
                  type="button"
                  onClick={() => {
                    set("starts_at", "");
                    set("expires_at", "");
                  }}
                  className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright ml-1 text-xs"
                >
                  Clear dates
                </button>
              )}
            </div>
          </Section>
        </div>

        {/* ------------------------------------------------------- preview */}
        <div className="min-w-0">
          <div className="space-y-3 xl:sticky xl:top-28">
            <div className="flex items-center justify-between gap-2">
              <p className="text-osrs-parchment-dark/60 text-[11px] font-semibold tracking-wide uppercase">
                How it looks
              </p>
              <Button type="button" variant="ghost" size="xs" onClick={() => setPreviewOpen(true)}>
                Preview pop-up
              </Button>
            </div>
            <div className="bg-osrs-surface-0/60 border-osrs-bronze/20 rounded-2xl border p-3 sm:p-5">
              <NoticeInlinePreview notice={previewContent} />
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------- actions */}
      <div className="border-osrs-bronze/20 mt-6 flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        {confirmSend ? (
          <>
            <p className="text-osrs-parchment mr-auto text-sm">{sendQuestion(draft, reach)}</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmSend(false)} disabled={pending}>
              Back
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={() => save(true)} disabled={pending}>
              {pending ? "Sending…" : "Yes, send it"}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="link" size="sm" onClick={onCancel} disabled={pending} className="mr-auto">
              Cancel
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewOpen(true)}>
              Preview pop-up
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => save(false)} disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Save draft"}
            </Button>
            {canSend && (
              <Button type="button" variant="primary" size="sm" onClick={() => save(true)} disabled={pending}>
                Send…
              </Button>
            )}
          </>
        )}
      </div>

      {previewOpen && (
        <NoticeDialog
          notice={previewContent}
          preview
          onClose={() => setPreviewOpen(false)}
          // Site links do nothing here, so a click can't navigate away from an
          // unsaved draft. External links still open in their own tab.
          onFollowLink={() => {}}
        />
      )}
    </div>
  );
}

function sendQuestion(d: Draft, reach: number | null): string {
  const who =
    reach == null ? "everyone who matches" : `${reach.toLocaleString()} ${reach === 1 ? "account" : "accounts"}`;
  const start = localInputToUnix(d.starts_at);
  if (start && start * 1000 > Date.now()) {
    const when = new Date(start * 1000).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return `Schedule this for ${when}? It will reach ${who}, counted as of now.`;
  }
  return `Send this to ${who} now? They see it the next time they open the site.`;
}

function Section({
  step,
  title,
  note,
  children,
}: {
  step: number;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="bg-osrs-bronze/30 text-osrs-gold-bright flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
          {step}
        </span>
        <h3 className="text-osrs-parchment font-semibold">{title}</h3>
        {note && <span className="text-osrs-parchment-dark/50 text-xs">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="space-y-1">
      <p className="text-osrs-parchment text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <ToggleChip key={o.value} shape="tab" active={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </ToggleChip>
        ))}
      </div>
    </div>
  );
}
