"use client";

/**
 * Markdown textarea with a small formatting toolbar for the pop-up composer.
 * The text edits themselves are pure (`lib/markdown-edit`); this component
 * only applies them and puts the selection back.
 */
import { useRef, type ReactNode } from "react";
import { Textarea, cn } from "@/components/ui";
import { insertBlock, insertLink, prefixLines, wrapSelection, type EditResult } from "@/lib/markdown-edit";

type Tool = { label: string; title: string; apply: (v: string, s: number, e: number) => EditResult; icon: ReactNode };

const TOOLS: Tool[] = [
  {
    label: "B",
    title: "Bold",
    apply: (v, s, e) => wrapSelection(v, s, e, "**", "**", "bold text"),
    icon: <span className="font-bold">B</span>,
  },
  {
    label: "I",
    title: "Italic",
    apply: (v, s, e) => wrapSelection(v, s, e, "_", "_", "italic text"),
    icon: <span className="font-serif italic">I</span>,
  },
  {
    label: "H",
    title: "Heading",
    apply: (v, s, e) => prefixLines(v, s, e, "### "),
    icon: <span className="font-bold">H</span>,
  },
  {
    label: "Link",
    title: "Link",
    apply: insertLink,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="size-4" aria-hidden>
        <path
          d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: "List",
    title: "Bulleted list",
    apply: (v, s, e) => prefixLines(v, s, e, "- "),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="size-4" aria-hidden>
        <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "1.",
    title: "Numbered list",
    apply: (v, s, e) => prefixLines(v, s, e, (i) => `${i + 1}. `),
    icon: <span className="text-xs font-semibold">1.</span>,
  },
  {
    label: "Quote",
    title: "Quote",
    apply: (v, s, e) => prefixLines(v, s, e, "> "),
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden>
        <path d="M7 7h4v4H9c0 1.7.6 2.6 2 3v2c-2.8-.4-4-2.3-4-5V7Zm7 0h4v4h-2c0 1.7.6 2.6 2 3v2c-2.8-.4-4-2.3-4-5V7Z" />
      </svg>
    ),
  },
  {
    label: "Image",
    title: "Image",
    apply: (v, s, e) => insertBlock(v, s, e, "![Describe the image](https://)", [22, 30]),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="size-4" aria-hidden>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" strokeWidth="2" />
        <path d="m4 17 5-5 4 4 2-2 5 5" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="15.5" cy="9" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Divider",
    title: "Divider",
    apply: (v, s, e) => insertBlock(v, s, e, "---"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="size-4" aria-hidden>
        <path d="M4 12h16" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

/** Starting points. Plain, short copy (no em-dashes; see the site copy rules). */
const EXAMPLES: { label: string; body: string }[] = [
  {
    label: "Feature update",
    body: "### What's new\n\n- **New thing**: one line on what it does.\n- **Another change**: why it matters to you.\n\n[Read the full post](/announcements)",
  },
  {
    label: "Action needed",
    body: "Your group needs a quick update before **Friday**.\n\n1. Open your group's **Settings**.\n2. Check the **Notifications** tab.\n3. Save your changes.\n\nQuestions? Open a ticket from the chat button in the corner.",
  },
  {
    label: "Thank you",
    body: "Thanks for supporting The DropTracker. You help keep the site running and free for everyone.\n\nAs a thank you, here's an early look at what we're building next.",
  },
];

const CHEATSHEET: [string, string][] = [
  ["**bold**", "bold"],
  ["_italic_", "italic"],
  ["### Heading", "heading"],
  ["- item", "bulleted list"],
  ["1. item", "numbered list"],
  ["[text](/premium)", "link (site path or https://)"],
  ["![alt](https://…/img.png)", "image"],
  ["> quote", "quote"],
  ["---", "divider"],
  ["| a | b |", "table row (put |---|---| under the first)"],
];

export function MarkdownEditor({
  id,
  value,
  onChange,
  maxLength,
  describedBy,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  describedBy?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const apply = (tool: Tool) => {
    const el = ref.current;
    if (!el) return;
    const result = tool.apply(value, el.selectionStart, el.selectionEnd);
    onChange(result.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selStart, result.selEnd);
    });
  };

  const applyExample = (body: string) => {
    if (value.trim() && !window.confirm("Replace the current message with this example?")) return;
    onChange(body);
    requestAnimationFrame(() => ref.current?.focus());
  };

  return (
    <div className="space-y-1.5">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="border-osrs-bronze/30 bg-osrs-surface-1 flex flex-wrap items-center gap-0.5 rounded-lg border p-1"
      >
        {TOOLS.map((tool) => (
          <button
            key={tool.label}
            type="button"
            title={tool.title}
            aria-label={tool.title}
            onClick={() => apply(tool)}
            className="text-osrs-parchment-dark hover:text-osrs-gold-bright hover:bg-osrs-bronze/25 flex h-8 min-w-8 items-center justify-center rounded px-1.5 text-sm transition-colors"
          >
            {tool.icon}
          </button>
        ))}
        <span className="bg-osrs-bronze/30 mx-1 h-5 w-px" aria-hidden />
        <select
          aria-label="Start from an example"
          value=""
          onChange={(e) => {
            const pick = EXAMPLES.find((x) => x.label === e.target.value);
            if (pick) applyExample(pick.body);
          }}
          className="text-osrs-parchment-dark hover:text-osrs-gold-bright bg-transparent px-1 text-xs outline-none"
        >
          <option value="">Examples…</option>
          {EXAMPLES.map((x) => (
            <option key={x.label} value={x.label}>
              {x.label}
            </option>
          ))}
        </select>
      </div>

      <Textarea
        ref={ref}
        id={id}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={12}
        maxLength={maxLength}
        spellCheck
        placeholder={"Write your message. **Bold**, _italic_, lists, links and images all work."}
        className="min-h-48 w-full resize-y font-mono text-[13px] leading-relaxed"
      />

      <div className="flex items-start justify-between gap-3">
        <details className="text-osrs-parchment-dark/70 text-xs">
          <summary className="hover:text-osrs-gold-bright cursor-pointer select-none">Formatting help</summary>
          <table className="mt-2 border-separate border-spacing-x-3 border-spacing-y-0.5">
            <tbody>
              {CHEATSHEET.map(([syntax, what]) => (
                <tr key={syntax}>
                  <td>
                    <code className="text-osrs-gold-bright">{syntax}</code>
                  </td>
                  <td>{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums",
            value.length > maxLength * 0.9 ? "text-osrs-red" : "text-osrs-parchment-dark/50",
          )}
        >
          {value.length.toLocaleString()} / {maxLength.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
