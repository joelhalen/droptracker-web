"use client";

import { useState, useTransition } from "react";
import type { Announcement } from "@droptracker/api-types";
import {
  editAnnouncement,
  archiveGroupAnnouncement,
} from "@/app/(site)/(admin)/groups/[id]/announcements/actions";
import {
  editGlobalAnnouncement,
  archiveGlobalAnnouncement,
} from "@/app/(site)/(admin)/admin/announcements/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Button, EmptyState } from "@/components/ui";

/** The Discord copy's state, for group posts. Archive deletes a posted copy
 *  and an edit changes it, so the list says which copy there is to change. */
function DiscordBadge({ discord }: { discord: Announcement["discord"] }) {
  if (!discord || discord.status === "off") return null;
  const label: Record<"posted" | "sending" | "failed" | "not_sent", [string, string]> = {
    posted: ["On Discord", "text-osrs-green border-osrs-green/40"],
    sending: ["Sending to Discord…", "text-osrs-parchment-dark/70 border-osrs-bronze/40"],
    failed: ["Discord post failed", "text-osrs-red border-osrs-red/50"],
    not_sent: ["Not on Discord", "text-osrs-parchment-dark/60 border-osrs-bronze/30"],
  };
  const [text, tone] = label[discord.status];
  // A failure is spelled out under the post; this covers the quiet case.
  const why =
    discord.status === "not_sent"
      ? "No announcements channel was set when this was published."
      : undefined;
  return (
    <span title={why} className={`rounded border px-1.5 py-0.5 text-[11px] ${tone}`}>
      {text}
    </span>
  );
}

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";

/**
 * Read + edit + archive list for both group (pass `groupId`) and global
 * (omit it, superadmin) announcement scopes — the counterpart to
 * `AnnouncementComposer`'s create flow.
 */
export function AnnouncementList({ items, groupId }: { items: Announcement[]; groupId?: number }) {
  const [list, setList] = useState(items);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ title: string; body_md: string; pinned: boolean } | null>(
    null,
  );
  const [confirmArchiveId, setConfirmArchiveId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const startEdit = (a: Announcement) => {
    setError(null);
    setEditingId(a.id);
    setDraft({ title: a.title, body_md: a.body_md, pinned: a.pinned });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = (id: number) => {
    if (!draft) return;
    startTransition(async () => {
      setError(null);
      try {
        const updated = groupId
          ? await editAnnouncement(groupId, id, draft)
          : await editGlobalAnnouncement(id, draft);
        setList((l) => l.map((a) => (a.id === id ? updated : a)));
        setEditingId(null);
        setDraft(null);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't save the announcement."));
      }
    });
  };

  const doArchive = (id: number) => {
    startTransition(async () => {
      setError(null);
      try {
        if (groupId) await archiveGroupAnnouncement(groupId, id);
        else await archiveGlobalAnnouncement(id);
        setList((l) => l.filter((a) => a.id !== id));
        setConfirmArchiveId(null);
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't archive the announcement."));
        setConfirmArchiveId(null);
      }
    });
  };

  if (list.length === 0) {
    return <EmptyState title="No announcements yet" />;
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      <ul className="divide-osrs-bronze/20 divide-y">
        {list.map((a) => (
          <li key={a.id} className="py-3">
            {editingId === a.id && draft ? (
              <div className="space-y-2">
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  maxLength={200}
                  className={field}
                />
                <textarea
                  value={draft.body_md}
                  onChange={(e) => setDraft({ ...draft, body_md: e.target.value })}
                  rows={4}
                  className={field}
                />
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.pinned}
                    onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })}
                    className="size-4"
                  />
                  Pin to top
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => saveEdit(a.id)}
                    disabled={pending || !draft.title.trim() || !draft.body_md.trim()}
                  >
                    {pending ? "Saving…" : "Save"}
                  </Button>
                  <button
                    onClick={cancelEdit}
                    disabled={pending}
                    className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {a.pinned && (
                      <span className="bg-osrs-gold/20 text-osrs-gold rounded px-1.5 py-0.5 text-xs">
                        Pinned
                      </span>
                    )}
                    <span className="font-medium">{a.title}</span>
                    {groupId != null && <DiscordBadge discord={a.discord} />}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <button
                      onClick={() => startEdit(a)}
                      className="text-osrs-parchment-dark/70 hover:text-osrs-gold-bright"
                    >
                      Edit
                    </button>
                    {confirmArchiveId === a.id ? (
                      <>
                        {groupId != null && a.discord?.status === "posted" && (
                          <span className="text-osrs-parchment-dark/60">Also deletes it from Discord.</span>
                        )}
                        <button
                          onClick={() => doArchive(a.id)}
                          disabled={pending}
                          className="text-osrs-red font-medium disabled:opacity-50"
                        >
                          {pending ? "…" : "Confirm"}
                        </button>
                        <button
                          onClick={() => setConfirmArchiveId(null)}
                          disabled={pending}
                          className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmArchiveId(a.id)}
                        className="text-osrs-parchment-dark/60 hover:text-osrs-red"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-osrs-parchment-dark/70 mt-1 line-clamp-2 text-sm">{a.body_md}</p>
                {groupId != null && a.discord?.status === "failed" && (
                  <p className="text-osrs-red/90 mt-1 text-xs">
                    {a.discord.reason === "missing_permissions"
                      ? "The bot can't post in your announcements channel. Give it View Channel, Send Messages and Embed Links there."
                      : a.discord.reason === "channel_missing"
                        ? "Your announcements channel no longer exists. Pick a new one in Settings → Channels."
                        : "Discord refused this post. Check the announcements channel in Settings → Channels."}
                  </p>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
