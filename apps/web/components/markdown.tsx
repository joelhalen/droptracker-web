import ReactMarkdown, { type Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkDiscordTokens, type MentionMap } from "@/lib/discord-tokens";

/** remark plugin set, optionally including Discord-token → chip rendering when
 * a `mentions` map is supplied (ticket transcripts, suggestion/bug threads). */
function plugins(mentions?: MentionMap): Options["remarkPlugins"] {
  return mentions ? [remarkGfm, [remarkDiscordTokens, { mentions }]] : [remarkGfm];
}

/**
 * Shared safe Markdown renderer for user-submitted content (docs pages,
 * subscription tier features, and — going forward — anywhere else that used
 * to just dump raw `body_md` as preformatted text). Deliberately plain
 * Markdown via `react-markdown`, not MDX: MDX compiles to executable JSX, and
 * this content is now edited through web forms by group/site admins rather
 * than authored in a repo under code review, so nothing here should be able
 * to run arbitrary component code. `react-markdown` renders straight to React
 * elements (no `dangerouslySetInnerHTML`), so raw HTML embedded in the input
 * is also not executed by default.
 */
export function Markdown({
  children,
  className = "",
  tone = "default",
  mentions,
}: {
  children: string;
  className?: string;
  /** "ink" = dark-on-parchment palette for content inside a ScrollPanel. */
  tone?: "default" | "ink";
  /** When set, `<@id>` etc. Discord tokens render as resolved mention chips. */
  mentions?: MentionMap;
}) {
  const palette =
    tone === "ink"
      ? "prose prose-scroll-ink"
      : "prose prose-invert prose-headings:text-osrs-gold prose-a:text-osrs-gold-bright prose-strong:text-osrs-parchment";
  return (
    <div className={`${palette} max-w-none ${className}`}>
      <ReactMarkdown remarkPlugins={plugins(mentions)}>{children}</ReactMarkdown>
    </div>
  );
}

/**
 * Single-line rich text (bold/italic/links) — for short fragments like a
 * subscription tier's feature bullets, where wrapping in a `<p>` (Markdown's
 * block-level model, which `Markdown` above keeps) would be invalid inside an
 * inline context and adds unwanted paragraph spacing.
 */
export function InlineMarkdown({
  children,
  className = "",
  mentions,
}: {
  children: string;
  className?: string;
  /** When set, `<@id>` etc. Discord tokens render as resolved mention chips. */
  mentions?: MentionMap;
}) {
  return (
    <span className={`prose-invert prose-a:text-osrs-gold-bright prose-strong:text-osrs-parchment ${className}`}>
      <ReactMarkdown remarkPlugins={plugins(mentions)} components={{ p: ({ children }) => <>{children}</> }}>
        {children}
      </ReactMarkdown>
    </span>
  );
}
