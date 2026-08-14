"use client";

/**
 * Shared Discord Components-V2 preview primitives.
 *
 * Two editors render the same block DSL — event message layouts
 * (services/event_message_layouts.py) and notification layouts
 * (services/component_layout.py) — and the part that has to be exactly right
 * in both is the substitution rule: a line still holding an unresolved token
 * is dropped when the message is sent, so a preview that keeps it lies about
 * what the group will receive. That rule lives here once rather than being
 * copied into each editor, where the two copies would drift.
 *
 * Each editor still owns its own block rendering — events have standings,
 * notifications have media galleries — and passes its own token pattern,
 * because the two renderers use slightly different ones and the preview should
 * drop exactly what its own backend drops.
 *
 * The substitution and dropping rules themselves are pure and live in
 * lib/components-v2.ts, where they are unit-tested against the same cases the
 * Python renderer's tests cover; this module is the markup around them.
 */
import { useEffect, useState } from "react";

export {
  EVENT_TOKEN_RE,
  NOTIFICATION_TOKEN_RE,
  isSendableUrl,
  resolveLines,
  resolveValue,
} from "@/lib/components-v2";

export function formatInline(text: string, keyPrefix: string): React.ReactNode[] {
  const pattern =
    /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\)|\{[a-z0-9_]+\})/g;
  const parts = text.split(pattern);
  return parts.filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    // Emphasis recurses: the most-used token of all, {player_name}, resolves
    // to a markdown link, so `**{player_name}**` becomes `**[Ron](url)**` —
    // which Discord draws as a bold link and a non-recursing formatter draws
    // as the link's source text.
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={key}>{formatInline(part.slice(2, -2), key)}</strong>;
    if (part.startsWith("__") && part.endsWith("__"))
      return <u key={key}>{formatInline(part.slice(2, -2), key)}</u>;
    if (part.startsWith("~~") && part.endsWith("~~"))
      return <s key={key}>{formatInline(part.slice(2, -2), key)}</s>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={key}>{formatInline(part.slice(1, -1), key)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={key} className="rounded bg-black/40 px-1 text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link)
      return (
        <span key={key} className="text-[#00a8fc] hover:underline">
          {link[1]}
        </span>
      );
    if (/^\{[a-z0-9_]+\}$/i.test(part))
      return (
        <span key={key} className="rounded bg-[#5865f2]/30 px-0.5 text-[#c9cdfb]">
          {part}
        </span>
      );
    return <span key={key}>{part}</span>;
  });
}

/** One markdown-ish line with Discord heading/subtext prefixes. */
export function PreviewLine({ line, keyPrefix }: { line: string; keyPrefix: string }) {
  if (line.startsWith("# "))
    return (
      <div className="text-[20px] font-bold text-white">{formatInline(line.slice(2), keyPrefix)}</div>
    );
  if (line.startsWith("## "))
    return (
      <div className="text-[17px] font-bold text-white">{formatInline(line.slice(3), keyPrefix)}</div>
    );
  if (line.startsWith("### "))
    return (
      <div className="text-[15px] font-semibold text-white">
        {formatInline(line.slice(4), keyPrefix)}
      </div>
    );
  if (line.startsWith("-# "))
    return <div className="text-xs text-[#949ba4]">{formatInline(line.slice(3), keyPrefix)}</div>;
  return <div className="text-sm text-[#dbdee1]">{formatInline(line, keyPrefix)}</div>;
}

export function PreviewLines({ text, keyPrefix }: { text: string; keyPrefix: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <PreviewLine key={i} line={line} keyPrefix={`${keyPrefix}-${i}`} />
      ))}
    </>
  );
}

export function HiddenOnError({ src, className }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (failed || !src) return null;
  // Plain <img>: preview URLs are arbitrary user input, not next/image targets.
  return <img src={src} alt="" className={className} onError={() => setFailed(true)} />;
}

/** The message chrome around a container: bot identity, then the accent bar. */
export function DiscordMessageFrame({
  accent,
  children,
}: {
  accent: string;
  children: React.ReactNode;
}) {
  const now = new Date();
  const timeText = `Today at ${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  return (
    <div className="rounded-lg bg-[#313338] p-4 font-sans">
      <div className="flex items-start gap-3">
        <div className="bg-osrs-gold/90 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg">
          <img src="/images/logo.png" alt="DropTracker" className="h-6 w-6" />
        </div>
        <div className="min-w-0 grow">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-white">DropTracker</span>
            <span className="rounded bg-[#5865f2] px-1 text-[10px] font-semibold text-white">
              APP
            </span>
            <span className="text-xs text-[#949ba4]">{timeText}</span>
          </div>
          <div
            className="mt-1 max-w-[520px] space-y-1.5 rounded border-l-4 bg-[#2b2d31] py-3 pr-4 pl-3"
            style={{ borderLeftColor: accent }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
