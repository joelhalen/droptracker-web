"use client";

/**
 * /admin/notices (web118a): every notice, grouped by where it is in its life,
 * with the composer on top when writing or editing one. Since web130a this is
 * the one place staff updates are written: a notice can also go out as a
 * news post and to the Discord news channel, and only the owner sends one.
 * Anyone else's lands in "Waiting for your review".
 */
import { useState, useTransition } from "react";
import type {
  AdminPopupNotice,
  AdminPopupNoticeDetail,
  AdminPopupNoticeList,
  NoticeLabels,
  NoticeOptions,
  NoticeState,
} from "@droptracker/api-types";
import {
  approveNotice,
  deleteNotice,
  endNotice,
  loadNoticeDetail,
  returnNotice,
  sendNotice,
} from "@/app/(site)/(admin)/admin/notices/actions";
import { NoticeDialog } from "@/components/site-notices/notice-dialog";
import { Alert, Badge, Button, EmptyState, type BadgeVariant } from "@/components/ui";
import { getErrorMessage } from "@/lib/errors";
import { formatRelativeTime } from "@/lib/format";
import { NoticeComposer } from "./notice-composer";

const STATE_BADGE: Record<NoticeState, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "neutral" },
  review: { label: "Waiting for review", variant: "sky" },
  scheduled: { label: "Scheduled", variant: "sky" },
  live: { label: "Live", variant: "green" },
  expired: { label: "Expired", variant: "bronze" },
  ended: { label: "Ended", variant: "bronze" },
};

const SECTIONS: { title: string; states: NoticeState[]; empty: string }[] = [
  { title: "Waiting for review", states: ["review"], empty: "Nothing is waiting for review." },
  {
    title: "Live and scheduled",
    states: ["live", "scheduled"],
    empty: "Nothing is showing right now.",
  },
  { title: "Drafts", states: ["draft"], empty: "No drafts." },
  { title: "Finished", states: ["ended", "expired"], empty: "Nothing has finished yet." },
];

function when(ts: number | null): string {
  if (ts == null) return "";
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function mergeLabels(a: NoticeLabels, b?: NoticeLabels): NoticeLabels {
  if (!b) return a;
  return {
    users: { ...a.users, ...b.users },
    groups: { ...a.groups, ...b.groups },
    tiers: { ...a.tiers, ...b.tiers },
  };
}

type ComposerState = {
  key: number;
  editing?: { notice: AdminPopupNotice; mode: "edit" | "duplicate" };
};

function sentMessage(n: AdminPopupNotice): string {
  if (!n.show_popup) {
    const where = [
      n.publish_post ? "as a news post" : "",
      n.post_to_discord ? `in #${n.discord_target} on Discord` : "",
    ]
      .filter(Boolean)
      .join(" and ");
    return `Sent "${n.title}" ${where}.`;
  }
  if (n.state === "scheduled")
    return `Scheduled "${n.title}". It starts showing ${when(n.starts_at)}.`;
  return `Sent "${n.title}". Matching people see it the next time they open the site.`;
}

export function NoticesManager({
  initial,
  options,
}: {
  initial: AdminPopupNoticeList;
  options: NoticeOptions;
}) {
  const canApprove = initial.can_approve;
  const [items, setItems] = useState(initial.items);
  const [labels, setLabels] = useState(initial.labels);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [flash, setFlash] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [preview, setPreview] = useState<AdminPopupNotice | null>(null);

  const openComposer = (editing?: ComposerState["editing"]) => {
    setFlash(null);
    setComposer({ key: Date.now(), editing });
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const upsert = (n: AdminPopupNotice) => {
    setLabels((l) => mergeLabels(l, n.labels));
    setItems((list) =>
      list.some((x) => x.id === n.id) ? list.map((x) => (x.id === n.id ? n : x)) : [n, ...list],
    );
  };

  return (
    <div className="space-y-8">
      {flash && <Alert variant={flash.tone}>{flash.text}</Alert>}

      {composer ? (
        <NoticeComposer
          key={composer.key}
          editing={composer.editing}
          options={options}
          labels={labels}
          canApprove={canApprove}
          onCancel={() => setComposer(null)}
          onSaved={(n, verb) => {
            upsert(n);
            setComposer(null);
            setFlash({
              tone: "success",
              text:
                verb === "review"
                  ? `Sent "${n.title}" to the owner for review. Nothing goes out until it's approved.`
                  : verb === "sent"
                    ? sentMessage(n)
                    : `Saved "${n.title}".`,
            });
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-osrs-parchment-dark/70 max-w-2xl text-sm">
            Write every update here. A pop-up shows once per person when they open the site; target
            specific people, clan leaders, group members or supporters. A notice can also go out as
            a public news post and to the Discord news channel.
            {!canApprove && " Notices you send go to the owner for review first."}
          </p>
          <Button variant="primary" size="sm" onClick={() => openComposer()}>
            + New notice
          </Button>
        </div>
      )}

      {SECTIONS.map((section) => {
        const rows = items.filter((n) => section.states.includes(n.state));
        return (
          <section key={section.title}>
            <h2 className="heading-rule text-osrs-gold mb-3 pb-1 text-base font-semibold">
              {section.title}
              <span className="text-osrs-parchment-dark/50 ml-2 text-sm font-normal">
                {rows.length}
              </span>
            </h2>
            {rows.length === 0 ? (
              <EmptyState title={section.empty} />
            ) : (
              <ul className="space-y-3">
                {rows.map((n) => (
                  <NoticeRow
                    key={n.id}
                    notice={n}
                    canApprove={canApprove}
                    onPreview={() => setPreview(n)}
                    onEdit={() => openComposer({ notice: n, mode: "edit" })}
                    onDuplicate={() => openComposer({ notice: n, mode: "duplicate" })}
                    onChanged={(next, message) => {
                      upsert(next);
                      setFlash({ tone: "success", text: message });
                    }}
                    onDeleted={() => {
                      setItems((list) => list.filter((x) => x.id !== n.id));
                      setFlash({ tone: "success", text: `Deleted "${n.title}".` });
                    }}
                    onError={(text) => setFlash({ tone: "error", text })}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {preview && (
        <NoticeDialog
          notice={preview}
          preview
          onClose={() => setPreview(null)}
          onFollowLink={() => {}}
        />
      )}
    </div>
  );
}

function NoticeRow({
  notice: n,
  canApprove,
  onPreview,
  onEdit,
  onDuplicate,
  onChanged,
  onDeleted,
  onError,
}: {
  notice: AdminPopupNotice;
  canApprove: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onChanged: (n: AdminPopupNotice, message: string) => void;
  onDeleted: () => void;
  onError: (message: string) => void;
}) {
  const [confirm, setConfirm] = useState<"send" | "approve" | "return" | "end" | "delete" | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [detail, setDetail] = useState<AdminPopupNoticeDetail | null>(null);
  const [showReceipts, setShowReceipts] = useState(false);
  const badge = STATE_BADGE[n.state];

  const run = (what: "send" | "approve" | "return" | "end" | "delete") => {
    startTransition(async () => {
      try {
        if (what === "send") {
          const next = await sendNotice(n.id);
          onChanged(
            next,
            next.status === "review"
              ? `Sent "${n.title}" to the owner for review.`
              : sentMessage(next),
          );
        } else if (what === "approve") {
          const next = await approveNotice(n.id);
          onChanged(next, sentMessage(next));
        } else if (what === "return")
          onChanged(await returnNotice(n.id), `Sent "${n.title}" back to drafts. It won't go out.`);
        else if (what === "end")
          onChanged(await endNotice(n.id), `Ended "${n.title}". Nobody else will see it.`);
        else {
          await deleteNotice(n.id);
          onDeleted();
        }
      } catch (err) {
        onError(getErrorMessage(err, "That didn't work."));
      } finally {
        setConfirm(null);
      }
    });
  };

  const toggleReceipts = () => {
    const next = !showReceipts;
    setShowReceipts(next);
    if (next) {
      startTransition(async () => {
        try {
          setDetail(await loadNoticeDetail(n.id));
        } catch (err) {
          onError(getErrorMessage(err, "Couldn't load who has seen it."));
        }
      });
    }
  };

  const meta: string[] = [];
  if (n.source_label) meta.push(`Drafted by ${n.source_label}`);
  if (n.state === "draft" || n.state === "review")
    meta.push(`Created ${formatRelativeTime(n.created_at)}`);
  else if (n.sent_at) meta.push(`Sent ${formatRelativeTime(n.sent_at)}`);
  if (n.state === "scheduled" && n.starts_at) meta.push(`starts ${when(n.starts_at)}`);
  if (n.expires_at && (n.state === "live" || n.state === "scheduled" || n.state === "draft"))
    meta.push(`stops ${when(n.expires_at)}`);
  if (n.state === "expired" && n.expires_at)
    meta.push(`expired ${formatRelativeTime(n.expires_at)}`);
  if (n.state === "ended" && n.ended_at) meta.push(`ended ${formatRelativeTime(n.ended_at)}`);

  const sent = (n.status === "live" || n.status === "ended") && n.show_popup;

  return (
    <li className="border-osrs-bronze/25 bg-osrs-surface-1 rounded-xl border p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {n.tone === "important" && <Badge variant="red">Important</Badge>}
            {n.publish_post && <Badge variant="bronze">News post</Badge>}
            {n.post_to_discord && <Badge variant="bronze">Discord #{n.discord_target}</Badge>}
            <h3 className="text-osrs-parchment min-w-0 truncate font-semibold">{n.title}</h3>
          </div>
          <p className="text-osrs-parchment-dark/80 mt-1 text-sm">
            {n.show_popup ? `Pop-up: ${n.audience_summary}` : "No pop-up"}
            {n.announcement_id != null && (
              <>
                {" · "}
                <a
                  href={`/announcements/${n.announcement_id}`}
                  className="text-osrs-gold-bright hover:underline"
                >
                  View the news post
                </a>
              </>
            )}
          </p>
          {meta.length > 0 && (
            <p className="text-osrs-parchment-dark/50 mt-0.5 text-xs">{meta.join(" · ")}</p>
          )}
        </div>

        {sent && (
          <dl className="flex shrink-0 gap-4 text-center">
            <Stat
              label="Matched"
              value={n.audience_estimate}
              hint="Accounts matching when it was sent"
            />
            <Stat label="Seen" value={n.seen_count} />
            <Stat label="Closed" value={n.dismissed_count} />
          </dl>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        {confirm ? (
          <>
            <span className="text-osrs-parchment">
              {confirm === "send"
                ? canApprove
                  ? "Send it now?"
                  : "Send it to the owner for review?"
                : confirm === "approve"
                  ? "Approve it and send it out now, as it reads?"
                  : confirm === "return"
                    ? "Send it back to drafts? It won't go out."
                    : confirm === "end"
                      ? "Stop showing it to everyone?"
                      : "Delete it and its read history?"}
            </span>
            <Button
              size="xs"
              variant={confirm === "delete" ? "danger" : "primary"}
              disabled={pending}
              onClick={() => run(confirm)}
            >
              {pending
                ? "…"
                : confirm === "send"
                  ? "Send"
                  : confirm === "approve"
                    ? "Approve and send"
                    : confirm === "return"
                      ? "Send back"
                      : confirm === "end"
                        ? "End it"
                        : "Delete"}
            </Button>
            <Button size="xs" variant="link" disabled={pending} onClick={() => setConfirm(null)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <RowAction onClick={onPreview}>Preview</RowAction>
            {n.status !== "ended" && (n.status !== "live" || canApprove) && (
              <RowAction onClick={onEdit}>Edit</RowAction>
            )}
            <RowAction onClick={onDuplicate}>Duplicate</RowAction>
            {n.status === "draft" && (
              <RowAction onClick={() => setConfirm("send")}>
                {canApprove ? "Send" : "Send for review"}
              </RowAction>
            )}
            {n.status === "review" && canApprove && (
              <>
                <RowAction onClick={() => setConfirm("approve")}>Approve and send</RowAction>
                <RowAction onClick={() => setConfirm("return")}>Send back</RowAction>
              </>
            )}
            {n.status === "review" && !canApprove && (
              <span className="text-osrs-parchment-dark/60">Waiting for the owner</span>
            )}
            {n.status === "live" && n.state !== "expired" && (
              <RowAction onClick={() => setConfirm("end")}>End now</RowAction>
            )}
            {sent && (
              <RowAction onClick={toggleReceipts}>
                {showReceipts ? "Hide who's seen it" : "Who's seen it"}
              </RowAction>
            )}
            <RowAction onClick={() => setConfirm("delete")} danger>
              Delete
            </RowAction>
          </>
        )}
      </div>

      {showReceipts && (
        <div className="border-osrs-bronze/20 mt-3 border-t pt-3">
          {!detail ? (
            <p className="text-osrs-parchment-dark/60 text-xs">Loading…</p>
          ) : detail.receipts.length === 0 ? (
            <p className="text-osrs-parchment-dark/60 text-xs">Nobody has seen it yet.</p>
          ) : (
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-osrs-parchment-dark/60">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Account</th>
                    <th className="py-1 pr-3 font-medium">First seen</th>
                    <th className="py-1 font-medium">Closed</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.receipts.map((r) => (
                    <tr key={r.user_id} className="border-osrs-bronze/10 border-t">
                      <td className="text-osrs-parchment py-1 pr-3">{r.name}</td>
                      <td className="text-osrs-parchment-dark/70 py-1 pr-3">
                        {formatRelativeTime(r.seen_at)}
                      </td>
                      <td className="text-osrs-parchment-dark/70 py-1">
                        {r.dismissed_at ? formatRelativeTime(r.dismissed_at) : "Not yet"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {detail.receipts.length >= 100 && (
                <p className="text-osrs-parchment-dark/50 mt-1 text-[11px]">
                  Showing the latest 100.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  return (
    <div title={hint}>
      <dt className="text-osrs-parchment-dark/50 text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </dt>
      <dd className="text-osrs-parchment font-semibold tabular-nums">
        {value == null ? "–" : value.toLocaleString()}
      </dd>
    </div>
  );
}

function RowAction({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        danger
          ? "text-osrs-parchment-dark/60 hover:text-osrs-red"
          : "text-osrs-gold-bright hover:text-osrs-gold hover:underline"
      }
    >
      {children}
    </button>
  );
}
