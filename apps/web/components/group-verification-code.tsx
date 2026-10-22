"use client";

/**
 * Plugin verification code (web141a), shown on the Roles & access tab.
 *
 * The code is the second factor for managing a group from the RuneLite plugin,
 * where nobody is signed in with Discord. It is shown exactly once: on reveal,
 * on reset, or at the end of group creation. Nothing can show it again, not
 * this page and not staff, so the panel keeps the code on screen until the
 * owner confirms they saved it, and warns before the tab is closed.
 *
 * Only the group's actual owner can reveal or reset (the backend enforces it;
 * `can_manage` just decides what to render). Admins see whether a code exists.
 */
import { useState, useTransition } from "react";
import type {
  AuthorizedUsersResponse,
  GroupVerificationCodeStatus,
} from "@droptracker/api-types";
import {
  resetVerificationCode,
  revealVerificationCode,
} from "@/app/(site)/(admin)/groups/[id]/authorized/actions";
import { getErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { Alert, Badge, Button } from "@/components/ui";
import { VerificationCodeReveal } from "@/components/verification-code-reveal";

/** The backend sends naive UTC ISO strings; read them as UTC. */
function isoToUnix(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

export function GroupVerificationCodePanel({
  groupId,
  status,
  ownerless,
  onRoster,
}: {
  groupId: number;
  status: GroupVerificationCodeStatus;
  ownerless: boolean;
  /** Reveal/reset answer with the full roster; hand it back to the manager. */
  onRoster: (next: AuthorizedUsersResponse) => void;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const issue = (fn: () => ReturnType<typeof revealVerificationCode>, fallback: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const { code: fresh, ...roster } = await fn();
        onRoster(roster);
        setCode(fresh);
      } catch (err) {
        setError(getErrorMessage(err, fallback));
      }
    });
  };

  const onReveal = () => {
    if (
      !window.confirm(
        "Show your group's plugin verification code?\n\n" +
          "You will only see it once. Make sure you can save it now.",
      )
    ) {
      return;
    }
    issue(() => revealVerificationCode(groupId), "Couldn't create the code. Please try again.");
  };

  const onReset = () => {
    if (
      !window.confirm(
        "Reset the plugin verification code?\n\n" +
          "The current code stops working right away, and anyone signed in to group " +
          "tools in the plugin is signed out. Your Discord will be told it was reset.",
      )
    ) {
      return;
    }
    issue(() => resetVerificationCode(groupId), "Couldn't reset the code. Please try again.");
  };

  const issuedAt = isoToUnix(status.issued_at);
  const clearedAt = isoToUnix(status.cleared_at);

  return (
    <section className="space-y-2">
      <h2 className="text-osrs-parchment-dark/80 text-sm font-semibold tracking-wide uppercase">
        Plugin verification code
      </h2>
      {error && <Alert variant="error">{error}</Alert>}

      {code ? (
        <VerificationCodeReveal code={code} onDone={() => setCode(null)} />
      ) : (
        <div className="border-osrs-bronze/20 flex flex-wrap items-center justify-between gap-3 rounded border px-3 py-2.5">
          <div className="max-w-2xl min-w-0">
            <div className="text-sm font-medium">
              Verification code
              <Badge variant={status.active ? "green" : "neutral"} className="ml-2">
                {status.active ? "Active" : "Not set"}
              </Badge>
            </div>
            <p className="text-osrs-parchment-dark/70 mt-0.5 text-xs">
              Proves you can manage this group from the DropTracker RuneLite plugin, where you
              aren&apos;t signed in with Discord. It is shown once and can&apos;t be viewed again.
            </p>
            {status.active && issuedAt != null && (
              <p className="text-osrs-parchment-dark/60 mt-1 text-xs">
                Created {formatDate(issuedAt)}.
              </p>
            )}
            {!status.active && status.cleared_reason === "staff" && clearedAt != null && (
              <p className="text-osrs-parchment-dark/60 mt-1 text-xs">
                Cleared by DropTracker staff on {formatDate(clearedAt)}.
              </p>
            )}
            {!status.active && status.cleared_reason === "ownership_transfer" && (
              <p className="text-osrs-parchment-dark/60 mt-1 text-xs">
                Cleared when ownership changed hands.
              </p>
            )}
            {!status.can_manage && (
              <p className="text-osrs-parchment-dark/70 mt-1 text-xs">
                {ownerless
                  ? "Claim ownership above to create a code."
                  : "Only the group's owner can view or reset it. Ask them if you need it."}
              </p>
            )}
          </div>
          {status.can_manage &&
            (status.active ? (
              <button
                type="button"
                onClick={onReset}
                disabled={pending}
                className="border-osrs-bronze/40 hover:border-osrs-gold rounded border px-3 py-1.5 text-xs whitespace-nowrap disabled:opacity-50"
              >
                {pending ? "Working…" : "Reset code"}
              </button>
            ) : (
              <Button variant="primary" onClick={onReveal} disabled={pending}>
                {pending ? "Working…" : "Reveal code"}
              </Button>
            ))}
        </div>
      )}
      {status.can_manage && status.active && !code && (
        <p className="text-osrs-parchment-dark/60 text-xs">
          Lost it? Reset it here, or ask us in the DropTracker Discord.
        </p>
      )}
    </section>
  );
}
