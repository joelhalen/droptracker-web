"use client";

/**
 * List editor for the `death_message_variants` config key (type "messagelist"):
 * add/remove message templates, one of which the bot picks at random per death.
 * Stored as a JSON string array ("" = unset) — the same value the backend's
 * parse_death_variants reads (disc services/notification_service.py).
 *
 * The live preview mirrors the send path's two placements: the message as the
 * plain content line above the default death embed, or as the embed's
 * description (`death_message_as_embed_description`, threaded in as a prop so
 * the preview flips with the unsaved checkbox). Content mode substitutes the
 * plain-value samples because message content renders no markdown links.
 */
import { useMemo, useState } from "react";
import {
  MESSAGE_LIST_MAX_ENTRIES,
  MESSAGE_LIST_MAX_ENTRY_LENGTH,
  messageListIssue,
} from "@droptracker/api-types";
import {
  DEATH_CONTENT_SAMPLE_OVERRIDES,
  DEATH_PLACEHOLDERS,
  SUGGESTED_DEATH_MESSAGES,
} from "@/lib/death-placeholders";
import { formatInline } from "@/components/components-v2-preview";
import { Button, Input } from "@/components/ui";

function parseMessages(value: string): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((e): e is string => typeof e === "string") : [];
  } catch {
    return [];
  }
}

const KNOWN_TOKENS = new Set(DEATH_PLACEHOLDERS.map((d) => d.token));

function unknownTokens(messages: string[]): string[] {
  const out = new Set<string>();
  for (const message of messages) {
    for (const match of message.matchAll(/\{[a-z0-9_]+\}/gi)) {
      if (!KNOWN_TOKENS.has(match[0])) out.add(match[0]);
    }
  }
  return [...out];
}

function substituteSamples(text: string, overrides?: Record<string, string>): string {
  let out = text;
  for (const d of DEATH_PLACEHOLDERS) {
    out = out.split(d.token).join(overrides?.[d.token] ?? d.sample);
  }
  return out;
}

export function DeathMessageListEditor({
  value,
  onChange,
  asEmbedDescription = false,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  asEmbedDescription?: boolean;
  disabled?: boolean;
}) {
  const messages = useMemo(() => parseMessages(value), [value]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  const commit = (list: string[]) => onChange(list.length ? JSON.stringify(list) : "");

  const issue = messageListIssue(value);
  const unknown = unknownTokens(messages);

  const previewMessage = messages[Math.min(previewIndex, Math.max(messages.length - 1, 0))];

  const addSuggested = () => {
    const existing = new Set(messages);
    const fresh = SUGGESTED_DEATH_MESSAGES.filter((m) => !existing.has(m));
    commit([...messages, ...fresh].slice(0, MESSAGE_LIST_MAX_ENTRIES));
  };

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(token);
      setTimeout(() => setCopied((t) => (t === token ? null : t)), 1200);
    } catch {
      /* clipboard unavailable — the token text is still visible to copy by hand */
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {messages.map((message, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type="text"
              value={message}
              maxLength={MESSAGE_LIST_MAX_ENTRY_LENGTH}
              onChange={(e) => commit(messages.map((m, j) => (j === i ? e.target.value : m)))}
              onFocus={() => setPreviewIndex(i)}
              disabled={disabled}
              className="w-full disabled:cursor-not-allowed"
              placeholder="{player_name} has died to {source}."
            />
            <button
              type="button"
              onClick={() => {
                commit(messages.filter((_, j) => j !== i));
                setPreviewIndex((p) => Math.max(0, Math.min(p, messages.length - 2)));
              }}
              disabled={disabled}
              className="text-osrs-parchment-dark/60 hover:text-osrs-parchment shrink-0 px-1 text-sm disabled:cursor-not-allowed"
              aria-label={`Remove message ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-osrs-parchment-dark/60 text-xs italic">
            No custom messages — the bot uses its default death message.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => {
            commit([...messages, ""]);
            setPreviewIndex(messages.length);
          }}
          disabled={disabled || messages.length >= MESSAGE_LIST_MAX_ENTRIES}
        >
          + Add message
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={addSuggested}
          disabled={disabled || messages.length >= MESSAGE_LIST_MAX_ENTRIES}
        >
          Add suggested messages
        </Button>
        {messages.length >= MESSAGE_LIST_MAX_ENTRIES && (
          <span className="text-osrs-parchment-dark/60 self-center text-xs">
            Limit of {MESSAGE_LIST_MAX_ENTRIES} messages reached.
          </span>
        )}
      </div>

      {issue && <p className="text-xs text-red-400">{issue}</p>}
      {!issue && unknown.length > 0 && (
        <p className="text-xs text-amber-400">
          Unknown placeholder{unknown.length > 1 ? "s" : ""} {unknown.join(", ")} — these will
          appear as-is in the message.
        </p>
      )}

      {/* Token reference — click to copy (same pattern as the embed builder). */}
      <div className="flex flex-wrap gap-1.5">
        {DEATH_PLACEHOLDERS.filter((d) => d.sample).map((d) => (
          <button
            key={d.token}
            type="button"
            onClick={() => copyToken(d.token)}
            disabled={disabled}
            title={d.help}
            className="border-osrs-bronze/30 text-osrs-parchment-dark/80 hover:text-osrs-parchment hover:border-osrs-bronze/60 rounded border px-1.5 py-0.5 font-mono text-[11px] disabled:cursor-not-allowed"
          >
            {copied === d.token ? "Copied!" : d.token}
          </button>
        ))}
      </div>

      {previewMessage != null && previewMessage.trim() !== "" && (
        <DeathMessagePreview
          message={previewMessage}
          asEmbedDescription={asEmbedDescription}
          onRoll={
            messages.length > 1
              ? () => setPreviewIndex(Math.floor(Math.random() * messages.length))
              : undefined
          }
        />
      )}
    </div>
  );
}

/** Discord-styled example of the selected message in the active placement. */
function DeathMessagePreview({
  message,
  asEmbedDescription,
  onRoll,
}: {
  message: string;
  asEmbedDescription: boolean;
  onRoll?: () => void;
}) {
  // Content is plain text in Discord, so the link-form tokens preview with
  // their plain-value counterparts — exactly what the bot substitutes.
  const contentLine = asEmbedDescription
    ? "RuneLite Ron has died!"
    : substituteSamples(message, DEATH_CONTENT_SAMPLE_OVERRIDES);
  const description = asEmbedDescription
    ? substituteSamples(message)
    : "[RuneLite Ron](https://www.droptracker.io/players/1) has died.";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-osrs-parchment-dark/60 text-xs">
          Example — message {asEmbedDescription ? "inside the embed" : "above the embed"}
        </span>
        {onRoll && (
          <button
            type="button"
            onClick={onRoll}
            className="text-osrs-parchment-dark/60 hover:text-osrs-parchment text-xs"
            title="Preview another random message"
          >
            🎲 Roll another
          </button>
        )}
      </div>
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
              <span className="text-xs text-[#949ba4]">Today</span>
            </div>
            <div className="mt-0.5 text-sm text-[#dbdee1]">{formatInline(contentLine, "dm-c")}</div>
            <div
              className="mt-1 max-w-[520px] rounded border-l-4 bg-[#2b2d31] py-3 pr-4 pl-3"
              style={{ borderLeftColor: "#B23B3B" }}
            >
              <div className="text-sm font-semibold text-white">Player Death</div>
              <div className="mt-1 text-sm text-[#dbdee1]">{formatInline(description, "dm-d")}</div>
              <div className="mt-2 flex gap-6">
                <div>
                  <div className="text-xs font-semibold text-[#b5bac1]">Killed By</div>
                  <div className="text-sm text-[#dbdee1]">Abyssal demon</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#b5bac1]">Location</div>
                  <div className="text-sm text-[#dbdee1]">Catacombs of Kourend</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
