"use client";

/**
 * Self-serve data removal (web137a): the account panel on /settings and the
 * group panel on Roles & access.
 *
 * Asking never erases anything by itself. It opens a support ticket where
 * staff check that the person really controls the account (a phrase typed in
 * the game chatbox, plus a screenshot) or that the group's admins agree. Once
 * approved, removal runs 7 days later and can be cancelled until then.
 * The rules are enforced by the backend (services/data_removal.py); this file
 * only renders them.
 */
import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import type { DataRemovalRequest } from "@droptracker/api-types";
import {
  cancelDataRemoval,
  requestGroupRemoval,
  requestPlayerRemoval,
} from "@/app/(site)/data-removal-actions";
import { getErrorMessage, unwrapActionResult } from "@/lib/errors";
import { Alert, Button } from "@/components/ui";
import { namesMatch, removalStatusText } from "@/lib/data-removal";

function TypeToConfirm({
  title,
  name,
  children,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  name: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: (typed: string) => Promise<void>;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-osrs-brown border-osrs-bronze/40 w-full max-w-md space-y-3 rounded-lg border p-5 shadow-xl">
        <h3 className="text-osrs-gold text-lg font-bold">{title}</h3>
        <div className="text-osrs-parchment-dark/80 space-y-2 text-sm">{children}</div>
        <label className="block text-sm">
          <span className="text-osrs-parchment-dark/70">
            Type <strong className="text-osrs-parchment">{name}</strong> to confirm
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            className="border-osrs-bronze/40 bg-osrs-surface-2 mt-1 block w-full rounded border px-3 py-2 text-sm"
            aria-label={`Type ${name} to confirm`}
          />
        </label>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="border-osrs-bronze/40 rounded border px-4 py-2 text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <Button
            variant="primary"
            disabled={pending || !namesMatch(typed, name)}
            onClick={() =>
              start(async () => {
                setError(null);
                try {
                  await onConfirm(typed);
                } catch (err) {
                  setError(getErrorMessage(err, "Couldn't send the request. Please try again."));
                }
              })
            }
          >
            {pending ? "Sending…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RequestStatus({
  req,
  groupId,
  onChange,
}: {
  req: DataRemovalRequest;
  groupId?: number;
  onChange: (r: DataRemovalRequest) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2 text-sm">
      <p className="text-osrs-parchment-dark/90">{removalStatusText(req)}</p>
      {req.status === "awaiting_verification" && req.verification_phrase && (
        <p className="text-osrs-parchment-dark/80">
          Log in to <strong>{req.subject_name}</strong>, type{" "}
          <code className="bg-osrs-surface-2 rounded px-1">{req.verification_phrase}</code> in the
          chatbox, and post a screenshot of your whole RuneLite client in the ticket.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {req.ticket_id != null && (
          <Link href={`/tickets/${req.ticket_id}`} className="text-osrs-gold underline">
            Open ticket #{req.ticket_id}
          </Link>
        )}
        {req.can_cancel && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                try {
                  onChange(unwrapActionResult(await cancelDataRemoval(req.id, groupId)).request);
                } catch (err) {
                  setError(getErrorMessage(err));
                }
              })
            }
            className="border-osrs-bronze/40 rounded border px-3 py-1 text-xs disabled:opacity-50"
          >
            {pending ? "Cancelling…" : "Cancel request"}
          </button>
        )}
      </div>
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

type Account = { id: number; name: string };

export function AccountDataRemoval({
  accounts,
  initial,
}: {
  accounts: Account[];
  initial: DataRemovalRequest[];
}) {
  // Newest request per account; older finished ones are history.
  const [requests, setRequests] = useState<Record<number, DataRemovalRequest>>(() => {
    const out: Record<number, DataRemovalRequest> = {};
    for (const r of initial) {
      if (r.kind === "player" && !(r.subject_id in out)) out[r.subject_id] = r;
    }
    return out;
  });
  const [asking, setAsking] = useState<Account | null>(null);
  const put = (r: DataRemovalRequest) => setRequests((prev) => ({ ...prev, [r.subject_id]: r }));

  return (
    <section className="space-y-3">
      <h2 className="heading-rule text-osrs-gold pb-1 text-lg font-semibold">Your data</h2>
      <p className="text-osrs-parchment-dark/70 text-sm">
        You can ask us to remove everything The DropTracker holds about one of your accounts:
        drops, personal bests, collection log, points and screenshots.{" "}
        <Link href="/docs/data-removal" className="text-osrs-gold underline">
          How removal works
        </Link>
      </p>
      {accounts.length === 0 ? (
        <p className="text-osrs-parchment-dark/60 text-sm">
          You have no claimed accounts. To remove data for an account, claim it first, or open a
          support ticket.
        </p>
      ) : (
        <ul className="divide-osrs-bronze/20 divide-y">
          {accounts.map((a) => {
            const req = requests[a.id];
            const open = req && (req.status === "awaiting_verification" || req.status === "scheduled");
            return (
              <li key={a.id} className="space-y-2 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{a.name}</span>
                  {!open && (
                    <button
                      type="button"
                      onClick={() => setAsking(a)}
                      className="rounded border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10"
                    >
                      Remove this account&apos;s data
                    </button>
                  )}
                </div>
                {req && <RequestStatus req={req} onChange={put} />}
              </li>
            );
          })}
        </ul>
      )}
      {asking && (
        <TypeToConfirm
          title="Remove this account's data?"
          name={asking.name}
          confirmLabel="Request removal"
          onClose={() => setAsking(null)}
          onConfirm={async (typed) => {
            const res = unwrapActionResult(await requestPlayerRemoval(asking.id, typed));
            put(res.request);
            setAsking(null);
          }}
        >
          <p>
            This opens a support ticket. To prove the account is yours, you will type a short
            phrase in the game chatbox and post a screenshot of your whole RuneLite client.
          </p>
          <p>
            Once our staff approve, the account is hidden straight away and everything is
            removed 7 days later. You can cancel until then. Your other accounts are not
            affected.
          </p>
          <p>
            If you keep the plugin running, or a clan that tracks you still lists this account,
            it will start collecting data again.
          </p>
        </TypeToConfirm>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------- */

export function GroupDataRemovalPanel({
  groupId,
  groupName,
  initial,
  canRequest,
}: {
  groupId: number;
  groupName: string;
  initial: DataRemovalRequest | null;
  canRequest: boolean;
}) {
  const [req, setReq] = useState<DataRemovalRequest | null>(initial);
  const [asking, setAsking] = useState(false);
  const open = req && (req.status === "awaiting_verification" || req.status === "scheduled");

  if (!canRequest && !req) return null;
  return (
    <section className="space-y-3 rounded border border-red-500/30 p-4">
      <h2 className="text-sm font-semibold tracking-wide text-red-300 uppercase">Delete group</h2>
      <p className="text-osrs-parchment-dark/70 text-sm">
        Remove {groupName} and all of its data from The DropTracker: settings, boards, events,
        points and history. Members&apos; own drops stay on their accounts.{" "}
        <Link href="/docs/data-removal" className="text-osrs-gold underline">
          How removal works
        </Link>
      </p>
      {req && <RequestStatus req={req} groupId={groupId} onChange={setReq} />}
      {canRequest && !open && (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="rounded border border-red-500/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
        >
          Request group deletion
        </button>
      )}
      {asking && (
        <TypeToConfirm
          title="Delete this group?"
          name={groupName}
          confirmLabel="Request deletion"
          onClose={() => setAsking(false)}
          onConfirm={async (typed) => {
            setReq(unwrapActionResult(await requestGroupRemoval(groupId, typed)).request);
            setAsking(false);
          }}
        >
          <p>
            This opens a support ticket. Every admin of the group who is in our Discord is added
            to it and asked to confirm.
          </p>
          <p>
            Once our staff approve, the group is removed 7 days later. You can cancel until then.
          </p>
        </TypeToConfirm>
      )}
    </section>
  );
}
