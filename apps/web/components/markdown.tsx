import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div
      className={`prose prose-invert prose-headings:text-osrs-gold prose-a:text-osrs-gold-bright prose-strong:text-osrs-parchment max-w-none ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

/**
 * Single-line rich text (bold/italic/links) — for short fragments like a
 * subscription tier's feature bullets, where wrapping in a `<p>` (Markdown's
 * block-level model, which `Markdown` above keeps) would be invalid inside an
 * inline context and adds unwanted paragraph spacing.
 */
export function InlineMarkdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <span className={`prose-invert prose-a:text-osrs-gold-bright prose-strong:text-osrs-parchment ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <>{children}</> }}>
        {children}
      </ReactMarkdown>
    </span>
  );
}
