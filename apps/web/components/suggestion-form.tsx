"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SuggestionCreate, SuggestionType } from "@droptracker/api-types";
import { submitSuggestion } from "@/app/(public)/suggestions/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";
import { Markdown } from "@/components/markdown";

const TITLE_MAX = 100;
const BODY_MAX = 4000;

const TYPES: { value: SuggestionType; label: string; hint: string }[] = [
  {
    value: "suggestion",
    label: "\u{1F4A1} Suggestion",
    hint: "Posted to the #suggestions forum in our Discord for the community to discuss.",
  },
  {
    value: "bug",
    label: "\u{1F41B} Bug report",
    hint: "Posted to the #bugs forum in our Discord so the team can triage it.",
  },
];

const BUG_TEMPLATE = `**What happened?**


**Steps to reproduce**

1.

**Expected behavior**

`;

/** Toolbar action: wrap the selection (inline) or prefix selected lines (block). */
type ToolbarAction =
  | { kind: "wrap"; before: string; after: string; placeholder: string }
  | { kind: "prefix"; prefix: string; placeholder: string }
  | { kind: "link" };

const TOOLBAR: { label: string; title: string; className?: string; action: ToolbarAction }[] = [
  { label: "B", title: "Bold", className: "font-bold", action: { kind: "wrap", before: "**", after: "**", placeholder: "bold text" } },
  { label: "I", title: "Italic", className: "italic", action: { kind: "wrap", before: "*", after: "*", placeholder: "italic text" } },
  { label: "S", title: "Strikethrough", className: "line-through", action: { kind: "wrap", before: "~~", after: "~~", placeholder: "strikethrough" } },
  { label: "H", title: "Heading", action: { kind: "prefix", prefix: "### ", placeholder: "Heading" } },
  { label: "<>", title: "Inline code", className: "font-mono", action: { kind: "wrap", before: "`", after: "`", placeholder: "code" } },
  { label: "```", title: "Code block", className: "font-mono", action: { kind: "wrap", before: "```\n", after: "\n```", placeholder: "code block" } },
  { label: "\u{1F517}", title: "Link", action: { kind: "link" } },
  { label: "\u{201D}", title: "Quote", className: "font-serif", action: { kind: "prefix", prefix: "> ", placeholder: "quote" } },
  { label: "•", title: "Bulleted list", action: { kind: "prefix", prefix: "- ", placeholder: "list item" } },
  { label: "1.", title: "Numbered list", action: { kind: "prefix", prefix: "1. ", placeholder: "list item" } },
];

export function SuggestionForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SuggestionCreate>({ type: "suggestion", title: "", body_md: "" });
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const field =
    "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold rounded border px-3 py-2 text-sm w-full outline-none";

  const setType = (type: SuggestionType) => {
    setForm((f) => {
      let body_md = f.body_md;
      // Offer the bug template, but never clobber something the user wrote.
      if (type === "bug" && f.body_md.trim() === "") body_md = BUG_TEMPLATE;
      if (type === "suggestion" && f.body_md === BUG_TEMPLATE) body_md = "";
      return { ...f, type, body_md };
    });
  };

  /** Replace [start, end) of the body with `text`, then restore focus/selection. */
  const spliceBody = (start: number, end: number, text: string, selectFrom: number, selectTo: number) => {
    setForm((f) => ({ ...f, body_md: f.body_md.slice(0, start) + text + f.body_md.slice(end) }));
    requestAnimationFrame(() => {
      const el = bodyRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selectFrom, selectTo);
    });
  };

  const runToolbar = (action: ToolbarAction) => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const selected = form.body_md.slice(start, end);

    if (action.kind === "wrap") {
      const inner = selected || action.placeholder;
      const text = action.before + inner + action.after;
      spliceBody(start, end, text, start + action.before.length, start + action.before.length + inner.length);
    } else if (action.kind === "prefix") {
      // Expand to whole lines, then prefix each. Insert placeholder when empty.
      const lineStart = form.body_md.lastIndexOf("\n", start - 1) + 1;
      const block = form.body_md.slice(lineStart, end) || action.placeholder;
      const text = block
        .split("\n")
        .map((line) => action.prefix + line)
        .join("\n");
      spliceBody(lineStart, Math.max(end, lineStart), text, lineStart, lineStart + text.length);
    } else {
      const label = selected || "link text";
      const text = `[${label}](https://)`;
      const urlStart = start + label.length + 3; // "[label](" — select the URL for typing over
      spliceBody(start, end, text, urlStart, urlStart + "https://".length);
    }
  };

  const canSubmit = form.title.trim().length >= 5 && form.body_md.trim().length >= 20 && !pending;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const created = await submitSuggestion(form);
        router.push(`/suggestions/${created.id}`);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't submit. Check your inputs and try again."));
      }
    });
  };

  const activeHint = TYPES.find((t) => t.value === form.type)?.hint;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <span className="mb-1 block text-sm font-medium">What are you submitting?</span>
        <div className="flex gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              aria-pressed={form.type === t.value}
              className={`rounded border px-4 py-2 text-sm transition-colors ${
                form.type === t.value
                  ? "border-osrs-gold bg-osrs-gold/10 text-osrs-gold"
                  : "border-osrs-bronze/40 bg-osrs-brown-dark/40 hover:border-osrs-bronze"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {activeHint && <p className="text-osrs-parchment-dark/60 mt-1 text-xs">{activeHint}</p>}
      </div>

      <label className="block">
        <span className="mb-1 flex items-baseline justify-between text-sm font-medium">
          Title
          <span className="text-osrs-parchment-dark/50 text-xs font-normal">
            {form.title.length}/{TITLE_MAX} — becomes the Discord thread name
          </span>
        </span>
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className={field}
          maxLength={TITLE_MAX}
          placeholder={
            form.type === "bug" ? "e.g. Lootboard skips drops from seasonal worlds" : "e.g. Add a dark theme for lootboards"
          }
          required
        />
      </label>

      <div>
        <div className="mb-1 flex items-end justify-between">
          <div className="flex gap-1 text-sm">
            {(["write", "preview"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-t border-x border-t px-3 py-1 capitalize transition-colors ${
                  tab === t
                    ? "border-osrs-bronze/40 bg-osrs-brown-dark/40 text-osrs-gold"
                    : "text-osrs-parchment-dark/60 border-transparent hover:text-osrs-parchment"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <span className="text-osrs-parchment-dark/50 text-xs">
            {form.body_md.length}/{BODY_MAX} — Markdown, shown as-is in Discord
          </span>
        </div>

        {tab === "write" ? (
          <div className="border-osrs-bronze/40 bg-osrs-brown-dark/40 rounded border">
            <div className="border-osrs-bronze/25 flex flex-wrap gap-1 border-b p-1.5">
              {TOOLBAR.map((b) => (
                <button
                  key={b.title}
                  type="button"
                  title={b.title}
                  onClick={() => runToolbar(b.action)}
                  className={`hover:bg-osrs-bronze/30 min-w-8 rounded px-2 py-1 text-xs transition-colors ${b.className ?? ""}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <textarea
              ref={bodyRef}
              value={form.body_md}
              onChange={(e) => setForm((f) => ({ ...f, body_md: e.target.value }))}
              className="min-h-56 w-full resize-y bg-transparent px-3 py-2 font-mono text-sm outline-none"
              maxLength={BODY_MAX}
              placeholder="Describe it in as much detail as you can — formatting carries over to Discord."
              required
            />
          </div>
        ) : (
          <div className="border-osrs-bronze/40 bg-osrs-brown-dark/40 min-h-56 rounded border px-4 py-3">
            {form.body_md.trim() ? (
              <Markdown className="prose-sm">{form.body_md}</Markdown>
            ) : (
              <p className="text-osrs-parchment-dark/50 text-sm italic">Nothing to preview yet.</p>
            )}
          </div>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-osrs-gold text-osrs-brown-dark hover:bg-osrs-gold-bright rounded px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Submitting…" : form.type === "bug" ? "Submit bug report" : "Submit suggestion"}
        </button>
        <span className="text-osrs-parchment-dark/50 text-xs">
          Posted with attribution — you&apos;ll be pinged on the Discord thread.
        </span>
      </div>
    </form>
  );
}
