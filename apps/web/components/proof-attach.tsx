"use client";

/**
 * Attach-a-screenshot control (web75a) — the shared uploader behind prize-pot
 * proof, and the same two-step contract the manual-submission form uses: the
 * image goes to storage first and the caller then saves the returned **object
 * key** alongside whatever record it belongs to. The backend builds the CDN URL
 * from that key, so a client can never point a record at an arbitrary address.
 *
 * `uploader` is injectable for the same reason `PrizePotActions` is: the site
 * posts to its cookie-authed BFF route, while the Discord Activity (which has
 * no cookies) posts to a bearer twin. Everything else — the picker, the size
 * cap, the thumbnail, the remove affordance — is identical on both surfaces.
 */
import { useRef, useState } from "react";

/** 10 MB — mirrors the Web API's `_PROOF_MAX_BYTES`, checked here so an
 * oversized pick fails instantly instead of after a 10 MB round-trip. */
export const MAX_PROOF_BYTES = 10 * 1024 * 1024;

export const PROOF_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export type ProofUpload = { key: string; public_url: string };
export type ProofUploader = (file: File) => Promise<ProofUpload>;

/** Site uploader: same-origin POST to the BFF, which forwards to the Web API
 * (a direct browser→B2 PUT is CORS-blocked — see app/api/uploads/proof). */
export const uploadProofViaBff: ProofUploader = async (file) => {
  const form = new FormData();
  form.set("file", file);
  const res = await fetch("/api/uploads/proof", { method: "POST", body: form });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Upload failed (${res.status}).`);
  }
  return (await res.json()) as ProofUpload;
};

export function ProofAttach({
  url,
  onUploaded,
  onRemove,
  uploader = uploadProofViaBff,
  disabled = false,
  size = "sm",
  title = "Attach a screenshot",
}: {
  /** The currently attached image, or null. May be a just-uploaded preview the
   * caller hasn't saved yet. */
  url?: string | null;
  /** Omit for a read-only thumbnail (renders nothing when there's no image). */
  onUploaded?: (upload: ProofUpload) => void | Promise<void>;
  /** Omit to make an attached image un-removable (read-only display). */
  onRemove?: () => void | Promise<void>;
  uploader?: ProofUploader;
  disabled?: boolean;
  size?: "sm" | "md";
  title?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = size === "md" ? "size-10" : "size-7";

  const onPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear immediately so re-picking the same file still fires onChange.
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (file.size > MAX_PROOF_BYTES) {
      setError("Image is too large (max 10 MB).");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onUploaded?.(await uploader(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload the image.");
    } finally {
      setBusy(false);
    }
  };

  // Read-only with nothing to show: contribute no layout at all.
  if (!url && !onUploaded) return null;

  if (url) {
    return (
      <span className="relative inline-flex shrink-0">
        <a href={url} target="_blank" rel="noreferrer" title="View proof screenshot">
          <img
            src={url}
            alt="Payment proof"
            className={`border-osrs-bronze/30 hover:border-osrs-gold/60 ${box} rounded border object-cover transition-colors`}
          />
        </a>
        {onRemove && !disabled && (
          <button
            type="button"
            onClick={() => void onRemove()}
            title="Remove screenshot"
            aria-label="Remove screenshot"
            className="bg-osrs-surface-2 border-osrs-bronze/40 text-osrs-parchment-dark/70 hover:text-osrs-red absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full border text-[9px] leading-none"
          >
            ×
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        accept={PROOF_ACCEPT}
        onChange={onPicked}
        className="hidden"
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
        title={title}
        aria-label={title}
        className={`border-osrs-bronze/25 text-osrs-parchment-dark/45 hover:border-osrs-gold/50 hover:text-osrs-gold ${box} flex items-center justify-center rounded border border-dashed text-xs transition-colors disabled:opacity-40`}
      >
        {busy ? "…" : "📎"}
      </button>
      {error && <span className="text-osrs-red text-[10px]">{error}</span>}
    </span>
  );
}
