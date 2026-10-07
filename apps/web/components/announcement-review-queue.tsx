"use client";

import { useState, useTransition } from "react";
import type { AnnouncementDraft } from "@droptracker/api-types";
import {
  approveGlobalAnnouncement,
  archiveGlobalAnnouncement,
} from "@/app/(site)/(admin)/admin/announcements/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Button } from "@/components/ui";

const field =
  "border-osrs-bronze/40 bg-osrs-brown-dark/40 focus:border-osrs-gold w-full rounded border px-3 py-2 text-sm outline-none";

type Edit = { title: string; body_md: string; post_to_discord: boolean };

/**
 * Site-wide posts waiting for the owner (web129a). Drafts from other staff,
 * agents and the weekly roundup land here; nothing is public until it is
 * approved. Approving saves any edits made here in the same step. Cancelling
 * archives the draft, so it never goes out.
 */
export function AnnouncementReviewQueue({
  items,
  canApprove,
}: {
  items: AnnouncementDraft[];
  canApprove: boolean;
}) {
  const [list, setList] = useState(items);
  const [edits, setEdits] = useState<Record<number, Edit>>(() =>
    Object.fromEntries(
      items.map((d) => [d.id, { title: d.title, body_md: d.body_md, post_to_discord: d.post_to_discord }]),
    ),
  );
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const setEdit = (id: number, patch: Partial<Edit>) =>
    setEdits((e) => {
      const base = e[id];
      return base ? { ...e, [id]: { ...base, ...patch } } : e;
    });

  const approve = (id: number) => {
    const edit = edits[id];
    if (!edit) return;
    startTransition(async () => {
      setError(null);
      setNotice(null);
      try {
        await approveGlobalAnnouncement(id, edit);
        setList((l) => l.filter((d) => d.id !== id));
        setNotice(
          edit.post_to_discord ? "Published on the site and sent to Discord." : "Published on the site.",
        );
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't publish the post."));
      }
    });
  };

  const cancel = (id: number) => {
    startTransition(async () => {
      setError(null);
      setNotice(null);
      try {
        await archiveGlobalAnnouncement(id);
        setList((l) => l.filter((d) => d.id !== id));
        setConfirmCancelId(null);
        setNotice("Cancelled. It won't be sent.");
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't cancel the post."));
        setConfirmCancelId(null);
      }
    });
  };

  return (
    <div className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <p className="text-osrs-green text-sm">{notice}</p>}
      {list.length === 0 ? (
        <p className="text-osrs-parchment-dark/60 text-sm">Nothing is waiting for review.</p>
      ) : (
        <ul className="space-y-6">
          {list.map((d) => {
            const edit = edits[d.id] ?? {
              title: d.title,
              body_md: d.body_md,
              post_to_discord: d.post_to_discord,
            };
            const valid = edit.title.trim().length > 0 && edit.body_md.trim().length > 0;
            return (
              <li key={d.id} className="border-osrs-bronze/30 space-y-2 rounded border p-3">
                <p className="text-osrs-parchment-dark/60 text-xs">
                  Drafted by {d.source_label || d.author_name || "staff"}
                  {d.created_at > 0 && <> on {new Date(d.created_at * 1000).toLocaleString()}</>}
                </p>
                <input
                  value={edit.title}
                  onChange={(e) => setEdit(d.id, { title: e.target.value })}
                  maxLength={200}
                  disabled={!canApprove}
                  className={field}
                  aria-label="Title"
                />
                <textarea
                  value={edit.body_md}
                  onChange={(e) => setEdit(d.id, { body_md: e.target.value })}
                  rows={10}
                  disabled={!canApprove}
                  className={field}
                  aria-label="Post text (Markdown)"
                />
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={edit.post_to_discord}
                    onChange={(e) => setEdit(d.id, { post_to_discord: e.target.checked })}
                    disabled={!canApprove}
                    className="size-4"
                  />
                  Also post to Discord
                </label>
                {canApprove ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => approve(d.id)}
                      disabled={pending || !valid}
                    >
                      {pending ? "Working…" : "Approve and publish"}
                    </Button>
                    {confirmCancelId === d.id ? (
                      <>
                        <button
                          onClick={() => cancel(d.id)}
                          disabled={pending}
                          className="text-osrs-red text-sm font-medium disabled:opacity-50"
                        >
                          Yes, cancel it
                        </button>
                        <button
                          onClick={() => setConfirmCancelId(null)}
                          disabled={pending}
                          className="text-osrs-parchment-dark/60 hover:text-osrs-gold-bright text-sm"
                        >
                          Keep it
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmCancelId(d.id)}
                        disabled={pending}
                        className="text-osrs-parchment-dark/60 hover:text-osrs-red text-sm"
                      >
                        Cancel post
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-osrs-parchment-dark/60 text-xs">Waiting for the owner to approve.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
