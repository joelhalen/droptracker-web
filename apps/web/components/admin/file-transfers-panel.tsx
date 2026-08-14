"use client";

/**
 * Staff view of the file-transfer hand-offs (web95a).
 *
 * One card per transfer: who sent it, their note, and every version with view /
 * download links. "Send a new version" attaches a corrected copy, which the
 * user sees on their own page as the next version alongside their original —
 * neither side ever loses an earlier revision.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FileTransfer } from "@droptracker/api-types";
import { Alert, Card, EmptyState } from "@/components/ui";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { expiryLabel, hasStaffReply, transferDownloadUrl } from "@/lib/file-transfers";
import { deleteFileTransfer } from "@/app/(site)/(admin)/admin/file-transfers/actions";

function TransferCard({ transfer, now }: { transfer: FileTransfer; now: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear immediately so re-picking the same file still fires onChange.
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`/api/admin/file-transfers/${transfer.id}/versions`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Upload failed (${res.status}).`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that file.");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (
      !confirm(
        `Delete "${transfer.title}" and all ${transfer.versions.length} version(s)? The files are not backed up anywhere — this cannot be undone.`,
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await deleteFileTransfer(transfer.id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete that transfer.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-osrs-gold font-medium break-all">{transfer.title}</h2>
          <p className="text-osrs-parchment-dark/60 text-xs">
            from {transfer.owner_name ?? `user ${transfer.owner_user_id}`} ·{" "}
            {formatRelativeTime(transfer.created_at)}
            {hasStaffReply(transfer) ? " · replied" : ""}
          </p>
        </div>
        <span className="text-osrs-parchment-dark/50 text-xs">
          {expiryLabel(transfer.expires_at, now)}
        </span>
      </div>

      {transfer.note && (
        <p className="text-osrs-parchment-dark/70 mt-2 text-sm whitespace-pre-wrap">
          {transfer.note}
        </p>
      )}

      <ul className="divide-osrs-bronze/15 mt-3 divide-y text-sm">
        {[...transfer.versions]
          .sort((a, b) => b.version - a.version)
          .map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <span className="text-osrs-parchment-dark/50 mr-2 text-xs">v{v.version}</span>
                <span className="break-all">{v.filename}</span>
                <span className="text-osrs-parchment-dark/50 ml-2 text-xs">
                  {formatBytes(v.size_bytes)} · {v.uploaded_by_name ?? `user ${v.uploaded_by}`} (
                  {v.uploaded_by_role}) · {formatRelativeTime(v.created_at)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {v.can_preview && (
                  <a
                    href={transferDownloadUrl(transfer.id, v.version, { inline: true })}
                    target="_blank"
                    rel="noreferrer"
                    className="text-osrs-gold-bright text-xs hover:underline"
                  >
                    View
                  </a>
                )}
                <a
                  href={transferDownloadUrl(transfer.id, v.version)}
                  className="text-osrs-gold-bright text-xs hover:underline"
                >
                  Download
                </a>
              </div>
            </li>
          ))}
      </ul>

      {error && <Alert className="mt-3">{error}</Alert>}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input ref={inputRef} type="file" onChange={onPicked} className="hidden" />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="border-osrs-bronze/40 hover:border-osrs-gold/60 rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-40"
        >
          {busy ? "Working…" : "Send a new version"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="text-osrs-red/80 hover:text-osrs-red text-xs transition-colors disabled:opacity-40"
        >
          Delete
        </button>
      </div>
    </Card>
  );
}

export function AdminFileTransfersPanel({
  transfers,
  retentionDays,
}: {
  transfers: FileTransfer[];
  retentionDays: number;
}) {
  const now = Math.floor(Date.now() / 1000);

  if (transfers.length === 0) {
    return (
      <EmptyState
        title="No files sent"
        hint={`Anyone signed in can send a file from /file-transfer. Transfers disappear ${retentionDays} days after their most recent version.`}
      />
    );
  }

  return (
    <div className="space-y-4">
      {transfers.map((t) => (
        <TransferCard key={t.id} transfer={t} now={now} />
      ))}
    </div>
  );
}
