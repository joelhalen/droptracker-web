"use client";

/**
 * The /file-transfer page's body (web95a): pick a file, send it, and see every
 * version of everything you've sent — yours and the ones staff sent back.
 *
 * Uploads go to the BFF route rather than a Server Action because these files
 * run to 25 MB and `serverActions.bodySizeLimit` is 3 MB. After a successful
 * upload we `router.refresh()` so the list re-renders from the server rather
 * than being patched client-side, keeping one source of truth for the rows.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FileTransfer } from "@droptracker/api-types";
import { Alert, Card, EmptyState, Textarea } from "@/components/ui";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { expiryLabel, transferDownloadUrl } from "@/lib/file-transfers";

export function FileTransferPanel({
  transfers,
  maxBytes,
  retentionDays,
}: {
  transfers: FileTransfer[];
  maxBytes: number;
  retentionDays: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const now = Math.floor(Date.now() / 1000);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || busy) return;
    // Checked here as well as server-side so a 25 MB mistake fails instantly
    // instead of after the whole body has been pushed up the wire.
    if (file.size > maxBytes) {
      setError(`That file is ${formatBytes(file.size)} — the limit is ${formatBytes(maxBytes)}.`);
      return;
    }
    setError(null);
    setSent(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      if (note.trim()) form.set("note", note.trim());
      const res = await fetch("/api/file-transfers", { method: "POST", body: form });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Upload failed (${res.status}).`);
      }
      setSent(file.name);
      setFile(null);
      setNote("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label htmlFor="transfer-file" className="mb-1 block text-sm font-medium">
              Choose a file
            </label>
            <input
              id="transfer-file"
              ref={inputRef}
              type="file"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
              }}
              className="text-osrs-parchment-dark/80 file:border-osrs-bronze/40 file:bg-osrs-surface-2 file:text-osrs-parchment hover:file:border-osrs-gold/60 block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border file:px-3 file:py-1.5 file:text-sm"
            />
            <p className="text-osrs-parchment-dark/50 mt-1 text-xs">
              Any file type, up to {formatBytes(maxBytes)}.
            </p>
          </div>

          <div>
            <label htmlFor="transfer-note" className="mb-1 block text-sm font-medium">
              Note <span className="text-osrs-parchment-dark/50">(optional)</span>
            </label>
            <Textarea
              id="transfer-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="What is this file, and what do you need done with it?"
              className="w-full"
            />
          </div>

          {error && <Alert>{error}</Alert>}
          {sent && <Alert variant="success">Sent {sent}. Staff can see it now.</Alert>}

          <button
            type="submit"
            disabled={!file || busy}
            className="bg-osrs-bronze hover:bg-osrs-bronze/80 text-osrs-parchment rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Uploading…" : "Send file"}
          </button>
        </form>
      </Card>

      {transfers.length === 0 ? (
        <EmptyState
          title="Nothing sent yet"
          hint={`Files you send here are visible to site staff, who can reply with an updated copy. Everything is removed ${retentionDays} days after the last version.`}
        />
      ) : (
        <div className="space-y-4">
          {transfers.map((t) => (
            <Card key={t.id} padding="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-osrs-gold font-medium">{t.title}</h2>
                <span className="text-osrs-parchment-dark/50 text-xs">
                  {expiryLabel(t.expires_at, now)}
                </span>
              </div>
              {t.note && (
                <p className="text-osrs-parchment-dark/70 mt-1 text-sm whitespace-pre-wrap">
                  {t.note}
                </p>
              )}

              <ul className="divide-osrs-bronze/15 mt-3 divide-y text-sm">
                {[...t.versions]
                  .sort((a, b) => b.version - a.version)
                  .map((v) => (
                    <li
                      key={v.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <div className="min-w-0">
                        <span className="text-osrs-parchment-dark/50 mr-2 text-xs">
                          v{v.version}
                        </span>
                        <span className="break-all">{v.filename}</span>
                        <span className="text-osrs-parchment-dark/50 ml-2 text-xs">
                          {formatBytes(v.size_bytes)} ·{" "}
                          {v.uploaded_by_role === "staff" ? "from staff" : "yours"} ·{" "}
                          {formatRelativeTime(v.created_at)}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {v.can_preview && (
                          <a
                            href={transferDownloadUrl(t.id, v.version, { inline: true })}
                            target="_blank"
                            rel="noreferrer"
                            className="text-osrs-gold-bright text-xs hover:underline"
                          >
                            View
                          </a>
                        )}
                        <a
                          href={transferDownloadUrl(t.id, v.version)}
                          className="text-osrs-gold-bright text-xs hover:underline"
                        >
                          Download
                        </a>
                      </div>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
