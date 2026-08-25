"use client";

/**
 * Reply composer for OPEN tickets (web102a) — used by the widget's ticket view
 * and the full `/tickets/[id]` page. The backend relays each reply into the
 * ticket's Discord channel, so replies work from either side.
 *
 * Images use the same two-step contract as chat and prize-pot proof: the bytes
 * go to storage via the BFF first and only the returned KEY is posted, so a
 * client can never point a ticket at an arbitrary remote image. A reply may be
 * images only — "here's the screenshot you asked for" is a complete answer.
 *
 * With `onPosted` the caller appends the returned row itself (the widget's
 * optimistic path); without it the composer refreshes the route so the server
 * transcript picks the reply up (the full page).
 */
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  TICKET_BODY_MAX_CHARS,
  TICKET_MAX_ATTACHMENTS,
  type TicketMessage,
} from "@droptracker/api-types";
import { replyToTicket } from "@/app/(site)/support-actions";
import { MAX_PROOF_BYTES, PROOF_ACCEPT, uploadProofViaBff } from "@/components/proof-attach";
import { Alert, Button } from "@/components/ui";
import { getErrorMessage } from "@/lib/errors";

type PendingAttachment = { key: string; url: string; name: string };

export function TicketReplyComposer({
  ticketId,
  onPosted,
}: {
  ticketId: number;
  onPosted?: (message: TicketMessage) => void;
}) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, startSending] = useTransition();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const overLimit = draft.length > TICKET_BODY_MAX_CHARS;
  const busy = sending || uploading;

  const pickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const room = TICKET_MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      setError(`You can attach at most ${TICKET_MAX_ATTACHMENTS} images per reply.`);
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, room)) {
        if (file.size > MAX_PROOF_BYTES) {
          throw new Error(`${file.name} is larger than 10 MB.`);
        }
        const uploaded = await uploadProofViaBff(file);
        setAttachments((prev) => [
          ...prev,
          { key: uploaded.key, url: uploaded.public_url, name: file.name },
        ]);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't upload that image."));
    } finally {
      setUploading(false);
      // Clear so re-picking the same file still fires onChange.
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const send = () => {
    const content = draft.trim();
    if ((!content && !attachments.length) || busy || overLimit) return;
    setError(null);
    startSending(async () => {
      try {
        const posted = await replyToTicket(
          ticketId,
          content,
          attachments.map((a) => ({ key: a.key })),
        );
        setDraft("");
        setAttachments([]);
        if (onPosted) onPosted(posted);
        else router.refresh();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't send that reply."));
      }
    });
  };

  return (
    <div className="space-y-2">
      {error && <Alert variant="error">{error}</Alert>}

      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {attachments.map((att) => (
            <li key={att.key} className="relative">
              {/* A just-uploaded CDN preview, not a known-size static asset —
                  same plain <img> the chat composer uses. */}
              <img
                src={att.url}
                alt={att.name}
                className="border-osrs-bronze/30 h-14 w-14 rounded border object-cover"
              />
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((a) => a.key !== att.key))}
                className="bg-osrs-brown-dark text-osrs-parchment absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full text-xs leading-none"
                aria-label={`Remove ${att.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line (chat-composer parity).
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="Write a reply…"
          disabled={busy}
          aria-label="Ticket reply"
          className="border-osrs-bronze/30 bg-osrs-brown-dark/40 text-osrs-parchment placeholder:text-osrs-parchment-dark/40 focus:border-osrs-gold/50 min-w-0 flex-1 resize-y rounded border px-3 py-2 text-sm outline-none disabled:opacity-50"
        />
        <div className="flex shrink-0 flex-col gap-1">
          <input
            ref={fileRef}
            type="file"
            accept={PROOF_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => void pickFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy || attachments.length >= TICKET_MAX_ATTACHMENTS}
            className="border-osrs-bronze/30 text-osrs-parchment-dark/80 hover:border-osrs-gold/50 rounded border px-2 py-1 text-xs disabled:opacity-40"
            title="Attach an image"
            aria-label="Attach an image"
          >
            {uploading ? "…" : "📎"}
          </button>
          <Button
            variant="secondary"
            size="xs"
            className="px-3"
            onClick={send}
            disabled={busy || overLimit || (!draft.trim() && !attachments.length)}
          >
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>

      {overLimit ? (
        <p className="text-osrs-red text-xs">
          {draft.length} / {TICKET_BODY_MAX_CHARS} characters — too long to send.
        </p>
      ) : (
        <p className="text-osrs-parchment-dark/50 text-xs">
          Replies and screenshots also appear in your ticket&apos;s Discord channel.
        </p>
      )}
    </div>
  );
}
