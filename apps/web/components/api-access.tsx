"use client";

/**
 * Data API access (web163a): the keys a group or a person holds, and the form
 * that asks for one. Used by the group's "API access" tab and by /api-keys.
 *
 * Asking does not create a key. It opens a support ticket where staff approve
 * or decline; once approved, the person who asked collects the key through a
 * one-time link (shown here and posted in the ticket). The rules are the
 * backend's (db/api_key_requests.py); this file only renders them.
 */
import { useState, useTransition } from "react";
import type { Route } from "next";
import Link from "next/link";
import type { ApiKey, ApiKeyRequest } from "@droptracker/api-types";
import {
  cancelApiKeyRequest,
  requestApiKey,
  revokeApiKey,
} from "@/app/(site)/api-access-actions";
import {
  LABEL_MAX,
  PURPOSE_MAX,
  canAsk,
  headlineRequest,
  purposeProblem,
  requestStatusText,
  sortKeys,
} from "@/lib/api-access";
import { getErrorMessage, unwrapActionResult } from "@/lib/errors";
import { formatRelativeTime } from "@/lib/format";
import { Alert, Button, Card, fieldInputClass } from "@/components/ui";
import { DISCORD_INVITE_URL } from "@/components/discord-join-nudge";


function isoToUnix(iso: string | null): number | null {
  if (!iso) return null;
  // The backend sends naive UTC timestamps.
  const ms = Date.parse(iso.endsWith("Z") ? iso : `${iso}Z`);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

function RequestCard({
  req,
  groupId,
  discordMember,
  onChange,
}: {
  req: ApiKeyRequest;
  groupId?: number;
  discordMember: boolean | null;
  onChange: (r: ApiKeyRequest) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-osrs-gold text-base font-semibold">
            {req.status === "pending" ? "Request sent" : "Your key is ready"}
            {req.label ? ` · ${req.label}` : ""}
          </h2>
          <span className="text-osrs-parchment-dark/60 text-xs">
            asked {formatRelativeTime(req.created_at)}
          </span>
        </div>
        <p className="text-osrs-parchment-dark/90">{requestStatusText(req)}</p>
        {req.status === "pending" && discordMember === false && (
          <p className="text-osrs-parchment-dark/70">
            You&apos;re not in the DropTracker Discord, so the conversation happens in the ticket
            on this site.{" "}
            <a href={DISCORD_INVITE_URL} className="text-osrs-gold underline">
              Join the Discord
            </a>{" "}
            and the ticket channel opens for you there too.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {req.claim_url && (
            // A plain link, not next/link: opening the page spends the key, so
            // nothing may prefetch it.
            <a
              href={req.claim_url}
              className="bg-osrs-gold text-osrs-brown-dark rounded px-4 py-2 text-sm font-semibold hover:opacity-90"
            >
              Collect your key
            </a>
          )}
          {req.ticket_id != null && (
            <Link href={`/tickets/${req.ticket_id}` as Route} className="text-osrs-gold underline">
              Open ticket #{req.ticket_id}
            </Link>
          )}
          {req.status === "pending" && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  try {
                    onChange(unwrapActionResult(await cancelApiKeyRequest(req.id, groupId)).request);
                  } catch (err) {
                    setError(getErrorMessage(err));
                  }
                })
              }
              className="border-osrs-bronze/40 rounded border px-3 py-1 text-xs disabled:opacity-50"
            >
              {pending ? "Withdrawing…" : "Withdraw request"}
            </button>
          )}
        </div>
        {req.claim_url && (
          <p className="text-osrs-parchment-dark/60 text-xs">
            The link works once, only for you, and expires a week after approval. Have somewhere
            safe to paste the key before you open it.
          </p>
        )}
        {error && <Alert variant="error">{error}</Alert>}
      </div>
    </Card>
  );
}

function RequestForm({
  groupId,
  subject,
  onSent,
}: {
  groupId?: number;
  subject: string;
  onSent: (r: ApiKeyRequest) => void;
}) {
  const [label, setLabel] = useState("");
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const problem = purposeProblem(purpose);

  function send() {
    if (problem) {
      setError(problem);
      return;
    }
    start(async () => {
      setError(null);
      try {
        onSent(unwrapActionResult(await requestApiKey({ label, purpose }, groupId)).request);
        setLabel("");
        setPurpose("");
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't send the request. Please try again."));
      }
    });
  }

  return (
    <Card>
      <form
        className="space-y-4 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div>
          <h2 className="text-osrs-gold text-base font-semibold">Request a key</h2>
          <p className="text-osrs-parchment-dark/70 mt-1">
            Keys are free. Tell us what you&apos;re building and staff will review it in a support
            ticket. A key for {subject} can read{" "}
            {groupId == null ? "the accounts you have claimed" : "this group's members"}, and
            nothing else.
          </p>
        </div>
        <label className="block">
          <span className="text-osrs-parchment-dark/80">Project name</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={LABEL_MAX}
            placeholder="Clan website, Discord bot…"
            className={`${fieldInputClass} mt-1 block w-full`}
          />
        </label>
        <label className="block">
          <span className="text-osrs-parchment-dark/80">What will it do with the data?</span>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            maxLength={PURPOSE_MAX}
            rows={4}
            placeholder="What you're building, where the data will be shown, and roughly how often it will call the API."
            className={`${fieldInputClass} mt-1 block w-full`}
          />
          <span className="text-osrs-parchment-dark/50 mt-1 block text-xs">
            {purpose.trim().length}/{PURPOSE_MAX}
          </span>
        </label>
        {error && <Alert variant="error">{error}</Alert>}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Sending…" : "Send request"}
        </Button>
      </form>
    </Card>
  );
}

function KeyRow({
  apiKey,
  groupId,
  onRevoked,
}: {
  apiKey: ApiKey;
  groupId?: number;
  onRevoked: (id: number) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const active = apiKey.state === "active";
  const lastUsed = isoToUnix(apiKey.last_used_at);
  return (
    <li className="space-y-1 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">
            {apiKey.label || "Unnamed key"}{" "}
            {!active && (
              <span className="text-osrs-parchment-dark/50 text-xs font-normal">
                ({apiKey.state})
              </span>
            )}
          </div>
          <div className="text-osrs-parchment-dark/60 text-xs">
            <code>{apiKey.display}</code> · {apiKey.tier} tier ·{" "}
            {lastUsed ? `last used ${formatRelativeTime(lastUsed)}` : "never used"}
            {apiKey.can_submit ? " · can submit" : ""}
          </div>
        </div>
        {active &&
          (confirming ? (
            <span className="flex items-center gap-2 text-xs">
              <span className="text-osrs-parchment-dark/70">Stop this key working?</span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    try {
                      unwrapActionResult(await revokeApiKey(apiKey.id, groupId));
                      onRevoked(apiKey.id);
                    } catch (err) {
                      setError(getErrorMessage(err));
                    }
                  })
                }
                className="rounded border border-red-500/40 px-3 py-1 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
              >
                {pending ? "Revoking…" : "Revoke"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="border-osrs-bronze/40 rounded border px-3 py-1"
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="border-osrs-bronze/40 rounded border px-3 py-1 text-xs"
            >
              Revoke
            </button>
          ))}
      </div>
      {error && <Alert variant="error">{error}</Alert>}
    </li>
  );
}

export function ApiAccessPanel({
  groupId,
  subject,
  initialKeys,
  initialRequests,
  discordMember,
}: {
  /** Omit for the signed-in user's personal keys. */
  groupId?: number;
  /** "this group" / "your account": who a key would belong to. */
  subject: string;
  initialKeys: ApiKey[];
  initialRequests: ApiKeyRequest[];
  discordMember: boolean | null;
}) {
  const [keys, setKeys] = useState(initialKeys);
  const [requests, setRequests] = useState(initialRequests);
  const put = (r: ApiKeyRequest) =>
    setRequests((prev) => [r, ...prev.filter((p) => p.id !== r.id)]);
  const headline = headlineRequest(requests);
  const shown = sortKeys(keys);
  const lastDenied = requests[0]?.status === "denied" ? requests[0] : null;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-osrs-parchment-dark/80 max-w-xl">
            The Data API lets your own site or bot read DropTracker data: loot, collection logs,
            personal bests, combat achievements and more. The reference shows every endpoint with
            real example responses, so you can see what you&apos;d be working with before asking.
          </p>
          <Link
            href={"/docs/api" as Route}
            className="border-osrs-gold/50 text-osrs-gold rounded border px-4 py-2 font-medium hover:opacity-80"
          >
            Read the API docs
          </Link>
        </div>
      </Card>

      {headline && (
        <RequestCard
          req={headline}
          groupId={groupId}
          discordMember={discordMember}
          onChange={put}
        />
      )}

      {!headline && lastDenied && (
        <Alert variant="info">
          Your last request was declined.{" "}
          {lastDenied.ticket_id != null && (
            <Link href={`/tickets/${lastDenied.ticket_id}` as Route} className="underline">
              Ticket #{lastDenied.ticket_id}
            </Link>
          )}{" "}
          has the reason. You can ask again below.
        </Alert>
      )}

      <section>
        <h2 className="heading-rule text-osrs-gold mb-2 pb-1 text-lg font-semibold">Keys</h2>
        {shown.length === 0 ? (
          <p className="text-osrs-parchment-dark/60 text-sm">
            No keys yet. {canAsk(requests) ? "Request one below." : "Your request is with staff."}
          </p>
        ) : (
          <ul className="divide-osrs-bronze/20 divide-y text-sm">
            {shown.map((k) => (
              <KeyRow
                key={k.id}
                apiKey={k}
                groupId={groupId}
                onRevoked={(id) =>
                  setKeys((prev) =>
                    prev.map((p) => (p.id === id ? { ...p, state: "revoked" as const } : p)),
                  )
                }
              />
            ))}
          </ul>
        )}
        <p className="text-osrs-parchment-dark/50 mt-2 text-xs">
          A key is shown once, when it is collected. If one is lost or leaked, revoke it and
          request another. Need higher limits or submission access? Ask in a support ticket.
        </p>
      </section>

      {canAsk(requests) && <RequestForm groupId={groupId} subject={subject} onSent={put} />}
    </div>
  );
}
