"use client";

import { HiddenOnError, PreviewText } from "@/components/embed-editor";

/**
 * Live previews for the announcement composer: the Discord post (styled like
 * the embed builder's preview) and what members see in game.
 */

export type AnnouncementEmbedDraft = {
  title: string;
  body: string;
  color: string;
  url: string;
  thumbnail: string;
  image: string;
  footer: string;
  timestamp: boolean;
  /** The ping line above the embed, already resolved to names. */
  pings: string[];
};

function timeText(): string {
  const now = new Date();
  return `Today at ${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

export function AnnouncementDiscordPreview({ draft }: { draft: AnnouncementEmbedDraft }) {
  const stripColor = /^#[0-9a-fA-F]{6}$/.test(draft.color) ? draft.color : "#c8aa6e";
  const when = timeText();
  // Discord caps an embed description at 4096; the backend sends 4000.
  const body = draft.body.length > 4000 ? draft.body.slice(0, 4000) : draft.body;

  return (
    <div className="rounded-lg bg-[#313338] p-4 font-sans">
      <div className="flex items-start gap-3">
        <div className="bg-osrs-gold/90 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg">
          <img src="/images/logo.png" alt="DropTracker" className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-white">DropTracker</span>
            <span className="rounded bg-[#5865f2] px-1 text-[10px] font-semibold text-white">
              APP
            </span>
            <span className="text-xs text-[#949ba4]">{when}</span>
          </div>
          {draft.pings.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1 text-sm">
              {draft.pings.map((p) => (
                <span key={p} className="rounded bg-[#5865f2]/30 px-0.5 text-[#c9cdfb]">
                  {p}
                </span>
              ))}
            </div>
          )}
          <div
            className="mt-1 grid max-w-[520px] grid-cols-1 rounded border-l-4 bg-[#2b2d31] py-3 pr-4 pl-3"
            style={{ borderLeftColor: stripColor }}
          >
            <div className="flex gap-4">
              <div className="min-w-0 grow break-words">
                <div
                  className={`text-[15px] font-semibold ${
                    draft.url.trim() ? "text-[#00a8fc] hover:underline" : "text-white"
                  }`}
                >
                  {draft.title.trim() || <span className="text-[#949ba4]">Title</span>}
                </div>
                <div className="mt-1 text-sm leading-snug text-[#dbdee1]">
                  {body.trim() ? (
                    <PreviewText text={body} useSamples={false} />
                  ) : (
                    <span className="text-[#949ba4]">Your announcement text</span>
                  )}
                </div>
              </div>
              {draft.thumbnail.trim() && (
                <HiddenOnError
                  src={draft.thumbnail}
                  className="h-16 w-16 shrink-0 rounded object-contain"
                />
              )}
            </div>
            {draft.image.trim() && (
              <HiddenOnError src={draft.image} className="mt-3 max-h-64 w-full rounded object-cover" />
            )}
            {(draft.footer.trim() || draft.timestamp) && (
              <div className="mt-2 flex items-center gap-1 text-[11px] text-[#949ba4]">
                {draft.footer.trim() && <span>{draft.footer}</span>}
                {draft.timestamp && (
                  <span>
                    {draft.footer.trim() ? "• " : ""}
                    {when}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * What the plugin draws: a `[DropTracker]` console line in the chatbox and a
 * pop-up card with the title over the same text. Mirrors
 * `services/plugin_notifications.clan_announcement_envelope`.
 */
export function AnnouncementInGamePreview({
  groupName,
  title,
  message,
}: {
  groupName: string;
  title: string;
  message: string;
}) {
  const text = `${groupName}: ${message || title || "…"}`;
  return (
    <div className="space-y-2">
      <div className="max-w-[360px] rounded border-2 border-[#5c5141] bg-[#3e3529] p-3 shadow-lg">
        <div className="text-[13px] font-bold text-[#ff981f]">{title || "Title"}</div>
        <div className="mt-1 text-[12px] leading-snug text-white">{text}</div>
      </div>
      <div className="rounded bg-[#c7b38d] px-2 py-1.5 font-mono text-[12px] text-black">
        <span>[</span>
        <span className="text-[#0000ff]">DropTracker</span>
        <span>] </span>
        {text}
      </div>
    </div>
  );
}
