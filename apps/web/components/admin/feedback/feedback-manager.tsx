"use client";

/**
 * /admin/feedback (web155a). Two halves:
 * - requests: who to ask, picked with the pop-up notice audience builder
 *   (specific people, clan leaders, group members, supporters...). A live
 *   request shows the feedback card to everyone it matches until they answer,
 *   snooze or decline it;
 * - answers: everything people sent, newest first. Each one is also posted to
 *   the staff Discord, where Publish puts the quote in the testimonials
 *   channel.
 */
import { useMemo, useState, useTransition } from "react";
import type {
  AdminFeedbackOverview,
  AdminFeedbackRequest,
  AdminFeedbackResponse,
  NoticeLabels,
  NoticeOptions,
  NoticeRule,
} from "@droptracker/api-types";
import { FEEDBACK_TITLE_MAX } from "@droptracker/api-types";
import {
  createFeedbackRequest,
  deleteFeedbackRequest,
  endFeedbackRequest,
  repostFeedback,
  sendFeedbackRequest,
  updateFeedbackRequest,
} from "@/app/(site)/(admin)/admin/feedback/actions";
import { AudienceBuilder } from "@/components/admin/notices/audience-builder";
import { Alert, Badge, Button, Card, EmptyState, Input, ToggleChip, cn, type BadgeVariant } from "@/components/ui";
import { getErrorMessage } from "@/lib/errors";
import { ratingBand } from "@/lib/feedback";
import { formatRelativeTime } from "@/lib/format";
import { audienceProblem } from "@/lib/site-notices";

const REQUEST_BADGE: Record<AdminFeedbackRequest["status"], { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "neutral" },
  live: { label: "Live", variant: "green" },
  ended: { label: "Ended", variant: "bronze" },
};

const RESPONSE_BADGE: Record<AdminFeedbackResponse["status"], { label: string; variant: BadgeVariant }> = {
  new: { label: "Waiting", variant: "sky" },
  publishing: { label: "Publishing", variant: "sky" },
  published: { label: "Published", variant: "gold" },
  dismissed: { label: "Dismissed", variant: "bronze" },
};

const BAND_BADGE: Record<ReturnType<typeof ratingBand>, BadgeVariant> = {
  low: "red",
  mid: "ember",
  high: "green",
};

const ATTRIBUTION_WORDS: Record<AdminFeedbackResponse["attribution"], string> = {
  clan: "clan name only",
  full: "name and clan",
  anon: "anonymous",
};

function mergeLabels(a: NoticeLabels, b?: NoticeLabels): NoticeLabels {
  if (!b) return a;
  return {
    users: { ...a.users, ...b.users },
    groups: { ...a.groups, ...b.groups },
    tiers: { ...a.tiers, ...b.tiers },
  };
}

type Editing = { key: number; request?: AdminFeedbackRequest };
type Flash = { tone: "success" | "error"; text: string } | null;

export function FeedbackManager({
  initial,
  options,
}: {
  initial: AdminFeedbackOverview;
  options: NoticeOptions;
}) {
  const [requests, setRequests] = useState(initial.requests);
  const [labels, setLabels] = useState(initial.labels);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [flash, setFlash] = useState<Flash>(null);

  const upsert = (r: AdminFeedbackRequest) => {
    setLabels((l) => mergeLabels(l, r.labels));
    setRequests((list) =>
      list.some((x) => x.id === r.id) ? list.map((x) => (x.id === r.id ? r : x)) : [r, ...list],
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-osrs-gold text-xl font-bold">Feedback</h1>
          <p className="text-osrs-parchment-dark/70 mt-1 max-w-2xl text-sm">
            Ask people for feedback with a small card on the site. Every answer goes to the staff
            Discord, where Publish puts the quote in the testimonials channel.
          </p>
        </div>
        {!editing && (
          <Button variant="primary" size="sm" onClick={() => setEditing({ key: Date.now() })}>
            New request
          </Button>
        )}
      </div>

      {flash && <Alert variant={flash.tone}>{flash.text}</Alert>}

      {editing && (
        <RequestComposer
          key={editing.key}
          request={editing.request}
          options={options}
          labels={labels}
          onLabels={setLabels}
          onCancel={() => setEditing(null)}
          onSaved={(r, sent) => {
            upsert(r);
            setEditing(null);
            setFlash({
              tone: "success",
              text: sent
                ? `"${r.title}" is live. Matching people see the card on their next visit.`
                : `Saved "${r.title}".`,
            });
          }}
        />
      )}

      <section className="space-y-3">
        <h2 className="text-osrs-gold text-lg font-semibold">Requests</h2>
        {requests.length === 0 ? (
          <EmptyState title="No requests yet" hint="Create one to start asking." />
        ) : (
          requests.map((r) => (
            <RequestRow
              key={r.id}
              request={r}
              onEdit={() => {
                setFlash(null);
                setEditing({ key: Date.now(), request: r });
              }}
              onChanged={upsert}
              onDeleted={() => setRequests((list) => list.filter((x) => x.id !== r.id))}
              onFlash={setFlash}
            />
          ))
        )}
      </section>

      <Responses responses={initial.responses} onFlash={setFlash} />
    </div>
  );
}

function RequestComposer({
  request,
  options,
  labels,
  onLabels,
  onCancel,
  onSaved,
}: {
  request?: AdminFeedbackRequest;
  options: NoticeOptions;
  labels: NoticeLabels;
  onLabels: (l: NoticeLabels) => void;
  onCancel: () => void;
  onSaved: (r: AdminFeedbackRequest, sent: boolean) => void;
}) {
  const [title, setTitle] = useState(request?.title ?? "");
  const [rules, setRules] = useState<NoticeRule[]>(request?.audience ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const problem = !title.trim() ? "Give the request a name." : audienceProblem(rules);

  const save = (send: boolean) =>
    start(async () => {
      setError(null);
      try {
        const input = { title: title.trim(), audience: rules };
        let out = request
          ? await updateFeedbackRequest(request.id, input)
          : await createFeedbackRequest(input, send);
        if (request && send && out.status === "draft") out = await sendFeedbackRequest(out.id);
        onSaved(out, send);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    });

  const canSend = !request || request.status === "draft";
  return (
    <Card elevated className="space-y-4">
      <h2 className="text-osrs-gold text-lg font-semibold">
        {request ? `Edit "${request.title}"` : "New feedback request"}
      </h2>
      <label className="block">
        <span className="text-osrs-parchment mb-1 block text-sm font-medium">Name</span>
        <Input
          value={title}
          maxLength={FEEDBACK_TITLE_MAX}
          placeholder="Nov 2026 clan leaders"
          onChange={(e) => setTitle(e.target.value)}
          className="w-full"
        />
        <span className="text-osrs-parchment-dark/60 mt-1 block text-xs">
          Staff only. It shows on the Discord posts, never to the people asked.
        </span>
      </label>
      <div>
        <p className="text-osrs-parchment mb-2 text-sm font-medium">Who to ask</p>
        <AudienceBuilder
          rules={rules}
          onChange={setRules}
          options={options}
          labels={labels}
          onLabels={onLabels}
        />
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      {problem && <p className="text-osrs-parchment-dark/70 text-sm">{problem}</p>}
      <div className="flex flex-wrap gap-2">
        {canSend && (
          <Button variant="primary" size="sm" disabled={pending || !!problem} onClick={() => save(true)}>
            Send now
          </Button>
        )}
        <Button variant="ghost" size="sm" disabled={pending || !!problem} onClick={() => save(false)}>
          {request ? "Save" : "Save draft"}
        </Button>
        <Button variant="link" size="sm" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function RequestRow({
  request: r,
  onEdit,
  onChanged,
  onDeleted,
  onFlash,
}: {
  request: AdminFeedbackRequest;
  onEdit: () => void;
  onChanged: (r: AdminFeedbackRequest) => void;
  onDeleted: () => void;
  onFlash: (f: Flash) => void;
}) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      try {
        await fn();
      } catch (err) {
        onFlash({ tone: "error", text: getErrorMessage(err) });
      }
    });
  const badge = REQUEST_BADGE[r.status];
  const stats = [
    r.audience_estimate != null ? `Asked ${r.audience_estimate}` : null,
    `${r.seen_count} saw it`,
    `${r.answered_count} answered`,
    r.snoozed_count ? `${r.snoozed_count} snoozed` : null,
    r.declined_count ? `${r.declined_count} declined` : null,
    r.average_rating != null ? `average ${r.average_rating}/10` : null,
  ].filter(Boolean);

  return (
    <Card padding="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-osrs-parchment font-semibold">{r.title}</p>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="text-osrs-parchment-dark/70 mt-1 text-sm">{r.audience_summary}</p>
          <p className="text-osrs-parchment-dark/60 mt-1 text-xs">
            {stats.join(" · ")}
            {r.sent_at != null && <> · sent {formatRelativeTime(r.sent_at)}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {r.status !== "ended" && (
            <Button variant="ghost" size="xs" disabled={pending} onClick={onEdit}>
              Edit
            </Button>
          )}
          {r.status === "draft" && (
            <Button
              variant="primary"
              size="xs"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  onChanged(await sendFeedbackRequest(r.id));
                  onFlash({ tone: "success", text: `"${r.title}" is live.` });
                })
              }
            >
              Send
            </Button>
          )}
          {r.status === "live" && (
            <Button
              variant="ghost"
              size="xs"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  if (!window.confirm(`Stop asking for "${r.title}"? Answers are kept.`)) return;
                  onChanged(await endFeedbackRequest(r.id));
                })
              }
            >
              End
            </Button>
          )}
          {r.status !== "live" && (
            <Button
              variant="link"
              size="xs"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  if (!window.confirm(`Delete "${r.title}"? Answers are kept.`)) return;
                  await deleteFeedbackRequest(r.id);
                  onDeleted();
                })
              }
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

type Filter = "all" | "quotable" | "waiting" | "published";

function Responses({
  responses,
  onFlash,
}: {
  responses: AdminFeedbackResponse[];
  onFlash: (f: Flash) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = useMemo(
    () =>
      responses.filter((r) => {
        if (filter === "quotable") return r.quote_consent && !!r.liked_text;
        if (filter === "waiting") return r.status === "new";
        if (filter === "published") return r.status === "published";
        return true;
      }),
    [responses, filter],
  );
  const average = responses.length
    ? Math.round((responses.reduce((sum, r) => sum + r.rating, 0) / responses.length) * 10) / 10
    : null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-osrs-gold text-lg font-semibold">
          Answers
          {average != null && (
            <span className="text-osrs-parchment-dark/70 ml-2 text-sm font-normal">
              {responses.length} · average {average}/10
            </span>
          )}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "All"],
              ["waiting", "Waiting"],
              ["quotable", "Quotable"],
              ["published", "Published"],
            ] as const
          ).map(([value, label]) => (
            <ToggleChip key={value} active={filter === value} onClick={() => setFilter(value)}>
              {label}
            </ToggleChip>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <EmptyState title="Nothing here yet" hint="Answers show up here as people send them." />
      ) : (
        shown.map((r) => <ResponseRow key={r.id} response={r} onFlash={onFlash} />)
      )}
    </section>
  );
}

function ResponseRow({
  response: r,
  onFlash,
}: {
  response: AdminFeedbackResponse;
  onFlash: (f: Flash) => void;
}) {
  const [pending, start] = useTransition();
  const status = RESPONSE_BADGE[r.status];
  const context = [
    r.group_name,
    r.role ? r.role[0]!.toUpperCase() + r.role.slice(1) : null,
    r.member_count != null ? `${r.member_count.toLocaleString()} members` : null,
  ].filter(Boolean);

  return (
    <Card padding="p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg border text-lg font-bold",
            {
              low: "border-osrs-red/50 text-osrs-red",
              mid: "border-osrs-ember/50 text-osrs-ember",
              high: "border-osrs-green/50 text-osrs-green",
            }[ratingBand(r.rating)],
          )}
          title={`${r.rating}/10`}
        >
          {r.rating}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-osrs-parchment font-semibold">{r.username}</span>
            {context.length > 0 && <span className="text-osrs-parchment-dark/70">{context.join(" · ")}</span>}
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge variant={BAND_BADGE[ratingBand(r.rating)]}>{r.rating}/10</Badge>
          </div>
          <Answer label="Working best" text={r.liked_text} />
          <Answer label="Would change" text={r.improve_text} />
          <p className="text-osrs-parchment-dark/60 text-xs">
            {r.quote_consent ? `OK to quote (${ATTRIBUTION_WORDS[r.attribution]})` : "Not for quoting"}
            {r.contact_ok && " · OK to contact"}
            {" · "}
            {r.request_title ?? "Share feedback page"}
            {r.created_at != null && <> · {formatRelativeTime(r.created_at)}</>}
            {!r.posted && " · not in Discord yet"}
          </p>
        </div>
        <Button
          variant="link"
          size="xs"
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                await repostFeedback(r.id);
                onFlash({ tone: "success", text: `Posted answer #${r.id} to the staff channel again.` });
              } catch (err) {
                onFlash({ tone: "error", text: getErrorMessage(err) });
              }
            })
          }
        >
          Post to Discord again
        </Button>
      </div>
    </Card>
  );
}

function Answer({ label, text }: { label: string; text: string | null }) {
  return (
    <div>
      <p className="text-osrs-parchment-dark/60 text-[11px] font-semibold tracking-wide uppercase">{label}</p>
      <p className={cn("text-sm whitespace-pre-wrap", text ? "text-osrs-parchment" : "text-osrs-parchment-dark/50 italic")}>
        {text || "Nothing written"}
      </p>
    </div>
  );
}
