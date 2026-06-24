"use client";

import { useState, useTransition } from "react";
import { sendDiscordMessage } from "@/app/(admin)/admin/discord/actions";

export function DiscordSender() {
  const [channelId, setChannelId] = useState("");
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const field =
    "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";
  const valid = channelId.trim().length > 0 && content.trim().length > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    startTransition(async () => {
      await sendDiscordMessage({ channel_id: channelId.trim(), content });
      setContent("");
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    });
  };

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Channel ID</span>
        <input
          value={channelId}
          onChange={(e) => setChannelId(e.target.value.replace(/\D/g, ""))}
          placeholder="e.g. 1234567890"
          inputMode="numeric"
          className={field}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Message</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          maxLength={2000}
          className={field}
        />
        <span className="text-osrs-parchment-dark/50 mt-1 block text-right text-xs">
          {content.length}/2000
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!valid || pending}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send"}
        </button>
        {done && <span className="text-osrs-green text-sm">Sent.</span>}
      </div>
    </form>
  );
}
