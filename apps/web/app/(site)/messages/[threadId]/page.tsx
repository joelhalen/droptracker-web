import type { Metadata } from "next";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { AccessDenied } from "@/components/access-denied";
import { ChatThreadPanel } from "@/components/chat/chat-thread";
import { counterpartyLabel } from "@/lib/chat";
import { Badge } from "@/components/ui";

export const metadata: Metadata = { title: "Messages" };

type Params = Promise<{ threadId: string }>;

const KIND_BADGE: Record<string, { label: string; variant: "gold" | "ember" | "sky" }> = {
  staff_dm: { label: "DropTracker staff", variant: "gold" },
  group_notice: { label: "Group notice", variant: "ember" },
  event_invite: { label: "Clan challenge", variant: "sky" },
};

/**
 * A single conversation on its own page — where the Discord DM buttons land.
 *
 * Staff messages ("Reply on DropTracker") and group notices ("View notice")
 * both link here, so this has to work for three different readers of three
 * different thread kinds: the subject of a staff chat, site staff answering
 * one, and any admin of a clan a notice was raised against. It carries none of
 * that logic itself — the backend's membership resolver decides, and a reader
 * with no seat gets the same 404 a nonexistent thread gets, so thread ids
 * can't be probed.
 *
 * The chat widget shows these same threads in its popup; this page exists for
 * the case where someone arrives cold from Discord, on a phone, and wants the
 * whole conversation rather than a corner of the screen.
 */
export default async function MessageThreadPage({ params }: { params: Params }) {
  const { threadId: raw } = await params;
  const threadId = Number(raw);
  const returnTo = `/messages/${Number.isFinite(threadId) ? threadId : ""}`;
  await requireUser(returnTo);

  let thread;
  let page;
  try {
    [thread, page] = await Promise.all([api.chatThread(threadId), api.chatMessages(threadId)]);
  } catch (e) {
    // Non-participants get 404 from the API by design (an id must not confirm
    // that a conversation exists). Render the same non-confirming denial the
    // ticket page uses rather than a bare 404 — the common case is a stale
    // link or the wrong Discord account, and that deserves an explanation.
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
      return (
        <AccessDenied
          icon="💬"
          title="Conversation unavailable"
          message="This conversation doesn't exist, or your account isn't part of it. If you followed a link from Discord, make sure you're signed in with the same Discord account that received it."
          back={{ href: "/dashboard", label: "Dashboard" }}
        />
      );
    }
    throw e;
  }

  const badge = KIND_BADGE[thread.kind];
  const heading = thread.title ?? counterpartyLabel(thread);

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard"
        className="text-osrs-parchment-dark/70 hover:text-osrs-gold text-sm"
      >
        ← Dashboard
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-cinzel text-osrs-gold-bright text-2xl">{heading}</h1>
        {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
      </div>
      <ChatThreadPanel
        thread={thread}
        initialMessages={page.messages}
        initialHasMore={page.has_more}
        heading={heading}
      />
    </div>
  );
}
