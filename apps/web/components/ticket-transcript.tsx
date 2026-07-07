import type { TicketDetail, TicketMessage, TicketStatus } from "@droptracker/api-types";
import { Badge, Card, EmptyState } from "@/components/ui";
import { InlineMarkdown } from "@/components/markdown";
import { formatDate, formatRelativeTime } from "@/lib/format";

/** Shared transcript renderer for the player view and the admin dashboard.
 * Messages are mirrored from the ticket's (deleted) Discord channel, so this
 * is intentionally read-only — replies happen in Discord while a ticket is
 * open. */

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  if (status === "open") return <Badge tone="green">Open</Badge>;
  if (status === "closing") return <Badge tone="ember">Closing…</Badge>;
  return <Badge tone="neutral">Closed</Badge>;
}

export function TicketTypeBadge({ type }: { type: string }) {
  const tone =
    type === "players" ? "sky" : type === "clans" ? "purple" : type === "support" ? "gold" : "bronze";
  return <Badge tone={tone as never}>{type}</Badge>;
}

function timestamp(unixSeconds: number | null): string {
  if (!unixSeconds) return "";
  return `${formatDate(unixSeconds)} · ${formatRelativeTime(unixSeconds)}`;
}

function isImage(contentType?: string | null, filename?: string) {
  if (contentType?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp)$/i.test(filename ?? "");
}

function AttachmentList({ message }: { message: TicketMessage }) {
  if (!message.attachments.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {message.attachments.map((att, i) =>
        att.url && isImage(att.content_type, att.filename) ? (
          <a key={i} href={att.url} target="_blank" rel="noreferrer">
            <img
              src={att.url}
              alt={att.filename}
              className="border-osrs-bronze/30 max-h-64 max-w-full rounded-lg border object-contain"
            />
          </a>
        ) : (
          <a
            key={i}
            href={att.url ?? undefined}
            target="_blank"
            rel="noreferrer"
            className={`border-osrs-bronze/30 bg-osrs-surface-2/70 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
              att.url ? "text-osrs-gold-bright hover:border-osrs-gold" : "text-osrs-parchment-dark/50"
            }`}
          >
            📎 {att.filename}
            {!att.url && <span>(expired)</span>}
          </a>
        ),
      )}
    </div>
  );
}

function MessageRow({ message }: { message: TicketMessage }) {
  if (message.kind === "system") {
    return (
      <div className="text-osrs-parchment-dark/60 flex items-center gap-3 py-1 text-xs">
        <span className="border-osrs-bronze/20 h-px flex-1 border-t" />
        <span>
          {message.content} · {formatRelativeTime(message.date_sent)}
        </span>
        <span className="border-osrs-bronze/20 h-px flex-1 border-t" />
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div
        className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          message.is_staff
            ? "bg-osrs-gold/20 text-osrs-gold"
            : "bg-osrs-surface-2 text-osrs-parchment-dark/80"
        }`}
        aria-hidden
      >
        {message.author_name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-osrs-parchment font-semibold">{message.author_name}</span>
          {message.is_bot ? (
            <Badge tone="bronze">Bot</Badge>
          ) : message.is_staff ? (
            <Badge tone="gold">Staff</Badge>
          ) : null}
          <span
            className="text-osrs-parchment-dark/50 text-xs"
            title={message.date_sent ? new Date(message.date_sent * 1000).toISOString() : undefined}
          >
            {timestamp(message.date_sent)}
            {message.date_edited ? " (edited)" : ""}
          </span>
        </div>
        {message.content && (
          <div className="text-osrs-parchment-dark/90 mt-0.5 text-sm break-words whitespace-pre-wrap">
            <InlineMarkdown>{message.content}</InlineMarkdown>
          </div>
        )}
        <AttachmentList message={message} />
      </div>
    </div>
  );
}

export function TicketTranscript({ ticket }: { ticket: TicketDetail }) {
  if (!ticket.messages.length) {
    return (
      <EmptyState
        title="No transcript available"
        hint="This ticket was closed before transcript archiving was introduced, so its conversation wasn't preserved."
      />
    );
  }
  return (
    <Card>
      <ol className="space-y-4">
        {ticket.messages.map((m) => (
          <li key={m.id}>
            <MessageRow message={m} />
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function TicketMetaHeader({ ticket }: { ticket: TicketDetail }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-osrs-gold text-xl font-bold">
          Ticket #{ticket.ticket_id}
          {ticket.subject ? ` — ${ticket.subject}` : ""}
        </h1>
      </div>
      <div className="text-osrs-parchment-dark/70 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <TicketStatusBadge status={ticket.status} />
        <TicketTypeBadge type={ticket.type} />
        <span>
          Opened by <span className="text-osrs-parchment">{ticket.created_by_name ?? "unknown"}</span>{" "}
          {formatRelativeTime(ticket.date_added)}
        </span>
        {ticket.claimed_by_name && (
          <span>
            · Handled by <span className="text-osrs-parchment">{ticket.claimed_by_name}</span>
          </span>
        )}
        {ticket.status === "closed" && ticket.date_closed && (
          <span>
            · Closed {formatRelativeTime(ticket.date_closed)}
            {ticket.closed_by_name ? ` by ${ticket.closed_by_name}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
