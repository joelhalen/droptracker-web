"use client";

/**
 * One entry in a chat thread (web96a).
 *
 * Deliberately generic — it knows about sides, parties and system codes, and
 * nothing about events. All the wording and grouping decisions come from
 * `lib/chat.ts` so they are unit-tested rather than buried in JSX.
 */
import type { ChatMessage, ChatThread } from "@droptracker/api-types";
import { continuesBlock, messageSide, speakerLabel, systemText } from "@/lib/chat";
import { LocalTime } from "@/components/local-time";

export function ChatMessageRow({
  message,
  previous,
  thread,
  canModerate = false,
  onDelete,
}: {
  message: ChatMessage;
  previous?: ChatMessage;
  thread: ChatThread;
  canModerate?: boolean;
  onDelete?: (messageId: number) => void;
}) {
  const side = messageSide(message, thread.my_parties);

  if (side === "system") {
    return (
      <li className="my-3 flex justify-center">
        <span className="border-osrs-bronze/25 text-osrs-parchment-dark/70 rounded-full border px-3 py-1 text-center text-xs">
          {systemText(message)}
          {message.created_at != null && (
            <span className="text-osrs-parchment-dark/45 ml-2">
              <LocalTime unix={message.created_at} mode="datetime" />
            </span>
          )}
        </span>
      </li>
    );
  }

  const grouped = continuesBlock(message, previous);
  const mine = side === "mine";

  return (
    <li className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-3"}`}>
      <div className={`max-w-[85%] min-w-0 ${mine ? "items-end" : "items-start"} flex flex-col`}>
        {!grouped && (
          <div className="text-osrs-parchment-dark/60 mb-1 flex items-baseline gap-2 text-xs">
            <span className="font-medium">{speakerLabel(message, thread)}</span>
            {message.created_at != null && (
              <LocalTime unix={message.created_at} mode="time" />
            )}
          </div>
        )}

        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            message.deleted
              ? "border-osrs-bronze/20 text-osrs-parchment-dark/50 border border-dashed italic"
              : mine
                ? "bg-osrs-bronze/30 text-osrs-parchment"
                : "border-osrs-bronze/25 bg-osrs-brown-dark/40 text-osrs-parchment border"
          }`}
        >
          {message.deleted ? (
            // Tombstoned, not purged: the entry keeps its place so the
            // surrounding conversation still reads correctly.
            <span>Message removed by staff.</span>
          ) : (
            <>
              {message.body && (
                <p className="break-words whitespace-pre-wrap">{message.body}</p>
              )}
              {message.attachments.length > 0 && (
                <div className={`flex flex-wrap gap-2 ${message.body ? "mt-2" : ""}`}>
                  {message.attachments.map((att) => (
                    <a
                      key={att.key}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img
                        src={att.url}
                        alt="Attachment"
                        className="border-osrs-bronze/30 max-h-48 max-w-full rounded border object-contain"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {canModerate && !message.deleted && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(message.id)}
            className="text-osrs-parchment-dark/40 hover:text-osrs-red mt-0.5 text-[11px]"
          >
            Remove
          </button>
        )}
      </div>
    </li>
  );
}
