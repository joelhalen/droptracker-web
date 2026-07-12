"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ManualPolicyNotice, ManualSubmission, Me } from "@droptracker/api-types";
import { getUploadPresign, manualPreflight, submitDrop } from "@/app/(dashboard)/submit/actions";
import { getErrorMessage } from "@/lib/errors";
import { Alert } from "@/components/ui";

const MAX_PROOF_BYTES = 10 * 1024 * 1024; // 10 MB — client-side sanity cap, not enforced server-side.

type ProofState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "done"; key: string; publicUrl: string; previewUrl: string }
  | { status: "error"; message: string };

const TYPES: { value: ManualSubmission["type"]; label: string }[] = [
  { value: "drop", label: "Drop" },
  { value: "clog", label: "Collection log" },
  { value: "pb", label: "Personal best" },
  { value: "ca", label: "Combat achievement" },
  { value: "pet", label: "Pet" },
];

export function SubmitForm({ players }: { players: Me["players"] }) {
  const [pending, startTransition] = useTransition();
  const [, startUpload] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState<ProofState>({ status: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ManualSubmission>({
    type: "drop",
    player_id: players[0]?.id ?? 0,
    quantity: 1,
  });
  const [notices, setNotices] = useState<ManualPolicyNotice[]>([]);

  const set = <K extends keyof ManualSubmission>(k: K, v: ManualSubmission[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Warn about clans that hold/disable this account's manual submissions
  // (suggestion #45). Refetched whenever the selected account changes.
  useEffect(() => {
    if (!form.player_id) {
      setNotices([]);
      return;
    }
    let cancelled = false;
    manualPreflight(form.player_id)
      .then((r) => !cancelled && setNotices(r.notices))
      .catch(() => !cancelled && setNotices([]));
    return () => {
      cancelled = true;
    };
  }, [form.player_id]);

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PROOF_BYTES) {
      setProof({ status: "error", message: "Image is too large (max 10 MB)." });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setProof({ status: "uploading" });
    startUpload(async () => {
      try {
        const { upload_url, key, public_url } = await getUploadPresign(file.type);
        const putRes = await fetch(upload_url, {
          method: "PUT",
          headers: { "content-type": file.type },
          body: file,
        });
        if (!putRes.ok) throw new Error(`Upload failed (${putRes.status}).`);
        setProof({ status: "done", key, publicUrl: public_url, previewUrl });
        set("proof_upload_key", key);
      } catch (err) {
        setProof({
          status: "error",
          message: getErrorMessage(err, "Couldn't upload the image. Try again."),
        });
      }
    });
  };

  const removeProof = () => {
    if (proof.status === "done") URL.revokeObjectURL(proof.previewUrl);
    setProof({ status: "idle" });
    set("proof_upload_key", undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const res = await submitDrop(form);
        setResult(`Submitted (#${res.id}).`);
        removeProof();
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't submit. Check your inputs and try again."));
      }
    });
  };

  const field = "border-osrs-bronze/40 bg-osrs-brown-dark/40 rounded border px-3 py-2 text-sm w-full";

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Type</span>
        <select
          value={form.type}
          onChange={(e) => set("type", e.target.value as ManualSubmission["type"])}
          className={field}
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Account</span>
        <select
          value={form.player_id}
          onChange={(e) => set("player_id", Number(e.target.value))}
          className={field}
        >
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      {notices.length > 0 && (
        <div className="border-osrs-gold/40 bg-osrs-gold/10 text-osrs-parchment-dark/90 space-y-1 rounded border px-3 py-2 text-xs">
          <p className="text-osrs-gold-bright font-medium">Heads up about manual submissions:</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {notices.map((n) => (
              <li key={n.group_id}>
                <span className="text-osrs-parchment">{n.group_name}</span>: your submission{" "}
                {n.message}.
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Source NPC / boss</span>
        <input
          value={form.npc_name ?? ""}
          onChange={(e) => set("npc_name", e.target.value)}
          className={field}
          placeholder="e.g. Vorkath"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Item</span>
        <input
          value={form.item_name ?? ""}
          onChange={(e) => set("item_name", e.target.value)}
          className={field}
          placeholder="e.g. Dragon hunter lance"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Value (GP)</span>
          <input
            type="number"
            min={0}
            value={form.value ?? ""}
            onChange={(e) => set("value", e.target.value ? Number(e.target.value) : undefined)}
            className={field}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Quantity</span>
          <input
            type="number"
            min={1}
            value={form.quantity}
            onChange={(e) => set("quantity", Math.max(1, Number(e.target.value)))}
            className={field}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Notes</span>
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          className={field}
          rows={2}
          maxLength={500}
        />
      </label>

      <div className="block">
        <span className="mb-1 block text-sm font-medium">Screenshot proof (optional)</span>
        {proof.status === "done" ? (
          <div className="flex items-center gap-3">
            <img
              src={proof.previewUrl}
              alt="Proof preview"
              className="border-osrs-bronze/40 h-16 w-16 rounded border object-cover"
            />
            <button
              type="button"
              onClick={removeProof}
              className="text-osrs-parchment-dark/60 hover:text-osrs-red text-sm"
            >
              Remove
            </button>
          </div>
        ) : (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={onFileSelected}
            disabled={proof.status === "uploading"}
            className="text-osrs-parchment-dark/80 file:bg-osrs-bronze/60 file:text-osrs-parchment hover:file:bg-osrs-bronze w-full text-sm file:mr-3 file:rounded file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-medium"
          />
        )}
        {proof.status === "uploading" && (
          <p className="text-osrs-parchment-dark/60 mt-1 text-xs">Uploading…</p>
        )}
        {proof.status === "error" && <p className="text-osrs-red mt-1 text-xs">{proof.message}</p>}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || proof.status === "uploading" || !form.player_id}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Submit"}
        </button>
        {result && <span className="text-osrs-green text-sm">{result}</span>}
      </div>
      {error && <Alert variant="error">{error}</Alert>}
    </form>
  );
}
