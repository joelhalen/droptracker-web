"use client";

/**
 * Staff side of the plugin verification code (web141a), on /admin/groups.
 *
 * When an owner loses their code they ask us in Discord. Staff cannot see or
 * hand out a code: they clear it here, the group's Discord is told, and the
 * owner reveals a fresh one from their Roles & access tab.
 */
import { useState, useTransition } from "react";
import type { AdminVerificationCodeStatus } from "@droptracker/api-types";
import { clearVerificationCode } from "@/app/(site)/(admin)/admin/groups/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert, Badge, Button } from "@/components/ui";

export function GroupVerificationCodeAdmin({
  groupId,
  initial,
}: {
  groupId: number;
  initial: AdminVerificationCodeStatus;
}) {
  const [status, setStatus] = useState(initial);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onClear = () => {
    if (
      !window.confirm(
        "Clear this group's plugin verification code?\n\n" +
          "Only do this for the confirmed owner. Plugin sessions using the code are signed " +
          "out and the group's Discord is told.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        setStatus(await clearVerificationCode(groupId, note.trim()));
        setNote("");
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't clear the code."));
      }
    });
  };

  return (
    <section className="border-osrs-bronze/20 space-y-3 rounded border p-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">Plugin verification code</h2>
        <Badge variant={status.active ? "green" : "neutral"}>
          {status.active ? "Active" : "Not set"}
        </Badge>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      <p className="text-osrs-parchment-dark/70 text-xs">
        {status.owner_user_id === null
          ? "This group has no owner, so nobody can reveal a new code until an admin claims it."
          : `Owner: user #${status.owner_user_id}. Clearing lets them reveal a new code from Roles & access.`}
        {!status.active && status.cleared_reason ? ` Last cleared: ${status.cleared_reason}.` : ""}
      </p>
      {status.active && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Note for the audit log (ticket, Discord thread)"
            className="border-osrs-bronze/40 bg-osrs-surface-1 w-80 max-w-full rounded border px-3 py-2 text-sm"
            aria-label="Audit note"
          />
          <Button variant="secondary" onClick={onClear} disabled={pending}>
            {pending ? "Working…" : "Clear code"}
          </Button>
        </div>
      )}
    </section>
  );
}
