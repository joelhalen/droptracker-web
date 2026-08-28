"use client";

import { useState } from "react";

/**
 * A copyable code sample.
 *
 * Deliberately unhighlighted: syntax highlighting would mean a new dependency
 * (shiki/prism) and a theme that fights the parchment palette, for samples that
 * are three lines of curl. What a reader actually needs is to get the command
 * onto their clipboard without selecting it by hand, so that is what this does.
 */
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      // Long enough to notice, short enough that the button is ready again
      // before a reader who is copying several samples in a row comes back.
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be refused (insecure origin, permissions). The
      // code is still on screen and selectable, so this is not worth an error.
    }
  }

  return (
    <div className="ink-rule relative overflow-hidden rounded-md border bg-black/85">
      {label && (
        <div className="border-b border-white/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-white/50">
          {label}
        </div>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
        className="absolute right-2 top-2 rounded border border-white/15 bg-white/10 px-2 py-1 text-xs font-medium text-white/80 transition hover:bg-white/20"
        style={label ? { top: "2.4rem" } : undefined}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="overflow-x-auto px-3 py-3 pr-20 text-[13px] leading-relaxed text-emerald-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
