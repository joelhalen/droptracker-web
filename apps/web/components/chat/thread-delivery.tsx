"use client";

/**
 * "Who got this?" — the delivery disclosure on a relayed thread (web103a).
 *
 * A group notice or a clan challenge is written once and fanned out to people
 * who may never open the site, so the thread on its own cannot tell an
 * administrator whether it landed. This is the collapsed answer.
 *
 * Deliberately unintrusive: one muted line and a chevron, never open on first
 * paint, and the payload is not fetched until somebody asks for it. A
 * clan-vs-clan roster can run to dozens of names — expanding that above every
 * conversation would bury the conversation.
 *
 * All wording lives in `lib/chat-delivery`; this file is layout.
 */
import { useCallback, useState, useTransition } from "react";
import type { ChatDelivery, ChatDeliveryParty, ChatThread } from "@droptracker/api-types";

import {
  deliveryChips,
  deliveryHeadline,
  hasDeliveryDetail,
  orderedParties,
  orderedRecipients,
  partyLabel,
  partySummary,
  recipientDetail,
  recipientStatus,
  redactedSummary,
} from "@/lib/chat-delivery";
import { getErrorMessage } from "@/lib/errors";
import { loadChatDelivery } from "@/app/(site)/chat-actions";
import { Badge } from "@/components/ui";
import { LocalTime } from "@/components/local-time";

/** Kinds that fan a message out to people who are not reading the thread. A
 * staff DM is a conversation with one person who is, by definition, already
 * looking at it — a "who got this?" panel there is noise. */
const RELAYED_KINDS = new Set(["group_notice", "event_invite"]);

export function threadHasDelivery(thread: ChatThread): boolean {
  return RELAYED_KINDS.has(thread.kind);
}

function RecipientRow({
  recipient,
}: {
  recipient: ChatDelivery["parties"][number]["recipients"][number];
}) {
  const status = recipientStatus(recipient);
  const detail = recipientDetail(recipient);
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1">
      <span className="text-osrs-parchment-dark/90 text-xs font-medium">
        {recipient.name ?? (recipient.discord_id ? `Discord ${recipient.discord_id}` : "Unknown")}
      </span>
      {recipient.role && (
        <span className="text-osrs-parchment-dark/45 text-[10px] uppercase tracking-wide">
          {recipient.role.replace("_", " ")}
        </span>
      )}
      <Badge variant={status.tone} size="sm">
        {status.label}
      </Badge>
      {recipient.at != null && recipient.delivery !== "none" && (
        <span className="text-osrs-parchment-dark/45 text-[10px]">
          <LocalTime unix={recipient.at} mode="datetime" />
        </span>
      )}
      {detail && (
        <span className="text-osrs-parchment-dark/50 basis-full text-[11px]">{detail}</span>
      )}
    </li>
  );
}

function PartyBlock({ party }: { party: ChatDeliveryParty }) {
  return (
    <div className="border-osrs-bronze/15 border-t pt-2 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-osrs-parchment text-xs font-semibold">{partyLabel(party)}</span>
        <span className="text-osrs-parchment-dark/55 text-[11px]">
          {party.visible ? partySummary(party) : redactedSummary(party)}
        </span>
      </div>
      {party.visible && party.recipients.length > 0 && (
        <ul className="mt-1">
          {orderedRecipients(party).map((r) => (
            <RecipientRow key={`${r.user_id ?? r.discord_id ?? r.name}`} recipient={r} />
          ))}
        </ul>
      )}
      {party.hidden > 0 && (
        <p className="text-osrs-parchment-dark/45 mt-1 text-[11px]">
          +{party.hidden} more not shown
        </p>
      )}
    </div>
  );
}

export function ThreadDelivery({
  thread,
  className = "",
  bodyClassName = "",
}: {
  thread: ChatThread;
  className?: string;
  /** Sizing for the expanded box. The widget caps and scrolls it so a long
   * clan roster cannot push the conversation off its own panel. */
  bodyClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [delivery, setDelivery] = useState<ChatDelivery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const toggle = useCallback(() => {
    const opening = !open;
    setOpen(opening);
    // Fetch once, on the first open — and outside the state updater, which
    // React may run twice. Re-collapsing keeps what we have, so a second look
    // is instant.
    if (opening && !delivery && !loading) {
      startLoading(async () => {
        try {
          setDelivery(await loadChatDelivery(thread.id));
          setError(null);
        } catch (e) {
          setError(getErrorMessage(e));
        }
      });
    }
  }, [open, delivery, loading, thread.id]);

  if (!threadHasDelivery(thread)) return null;

  const chips = delivery ? deliveryChips(delivery) : [];
  const parties = delivery ? orderedParties(delivery) : [];

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="text-osrs-parchment-dark/60 hover:text-osrs-parchment-dark flex w-full items-center gap-1.5 text-left text-[11px]"
      >
        <span aria-hidden>{open ? "▾" : "▸"}</span>
        <span>{delivery ? deliveryHeadline(delivery) : "Who received this?"}</span>
        {chips.map((chip) => (
          <Badge key={chip.label} variant={chip.tone} size="sm">
            {chip.label}
          </Badge>
        ))}
      </button>

      {open && (
        <div
          className={`border-osrs-bronze/15 bg-osrs-brown-dark/20 mt-1.5 space-y-2 rounded border p-2.5 ${bodyClassName}`}
        >
          {loading && !delivery && (
            <p className="text-osrs-parchment-dark/50 text-[11px]">Checking…</p>
          )}
          {error && <p className="text-osrs-red text-[11px]">{error}</p>}
          {delivery && !hasDeliveryDetail(delivery) && (
            <p className="text-osrs-parchment-dark/55 text-[11px]">
              Nobody is currently set up to receive this — the clan has no admins or event
              managers on DropTracker.
            </p>
          )}
          {delivery && hasDeliveryDetail(delivery) && (
            <>
              {!delivery.dm_expected && (
                <p className="text-osrs-parchment-dark/55 text-[11px]">
                  No notifications are sent for this conversation — everyone below reads it on the
                  site.
                </p>
              )}
              {parties.map((party) => (
                <PartyBlock key={`${party.party_type}:${party.party_id}`} party={party} />
              ))}
              {delivery.others.length > 0 && (
                <div className="border-osrs-bronze/15 border-t pt-2">
                  <p className="text-osrs-parchment text-xs font-semibold">Other recipients</p>
                  <p className="text-osrs-parchment-dark/50 text-[11px]">
                    Messaged, but they hold no current role on the clans above.
                  </p>
                  <ul className="mt-1">
                    {delivery.others.map((r) => (
                      <RecipientRow key={`${r.discord_id ?? r.user_id}`} recipient={r} />
                    ))}
                  </ul>
                </div>
              )}
              {delivery.others.length === 0 && delivery.others_count > 0 && (
                <p className="text-osrs-parchment-dark/50 border-osrs-bronze/15 border-t pt-2 text-[11px]">
                  {delivery.others_count} other recipient
                  {delivery.others_count === 1 ? " holds" : "s hold"} no current role on either
                  clan.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
