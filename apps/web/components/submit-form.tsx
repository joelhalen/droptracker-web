"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ManualPolicyNotice, ManualSubmission, Me } from "@droptracker/api-types";
import {
  getUploadPresign,
  manualPreflight,
  searchItems,
  searchNpcs,
  submitDrop,
} from "@/app/(site)/(dashboard)/submit/actions";
import { getErrorMessage } from "@/lib/errors";
import { ItemNpcPicker, type PickerEntry } from "@/components/item-npc-picker";
import { Alert } from "@/components/ui";

const MAX_PROOF_BYTES = 10 * 1024 * 1024; // 10 MB — client-side sanity cap, not enforced server-side.

type ProofState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "done"; key: string; publicUrl: string; previewUrl: string }
  | { status: "error"; message: string };

type SubType = ManualSubmission["type"];

const TYPES: { value: SubType; label: string; hint: string }[] = [
  { value: "drop", label: "Drop", hint: "Loot you received from an NPC or boss" },
  { value: "clog", label: "Collection log", hint: "A new collection log unlock" },
  { value: "pb", label: "Personal best", hint: "A new best kill time" },
  { value: "ca", label: "Combat achievement", hint: "A completed CA task" },
  { value: "pet", label: "Pet", hint: "A pet drop" },
];

const CA_TIERS = ["easy", "medium", "hard", "elite", "master", "grandmaster"] as const;

/**
 * Parse a human kill-time string to milliseconds. Accepts "1:23.40",
 * "0:45", "1:02:03.6" and plain seconds ("83.4"). Returns null when the
 * string doesn't parse or is non-positive.
 */
export function parseKillTimeMs(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (!/^\d+(:\d{1,2}){0,2}(\.\d{1,3})?$/.test(s)) return null;
  const [main = "", frac = ""] = s.split(".");
  const parts = main.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return null;
  let seconds = 0;
  for (const p of parts) seconds = seconds * 60 + p;
  const ms = seconds * 1000 + (frac ? Math.round(Number(`0.${frac}`) * 1000) : 0);
  return ms > 0 ? ms : null;
}

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const tenths = Math.round((ms % 1000) / 100);
  const secStr = `${String(sec).padStart(2, "0")}${tenths ? `.${tenths}` : ""}`;
  return h ? `${h}:${String(m).padStart(2, "0")}:${secStr}` : `${m}:${secStr}`;
}

export function SubmitForm({ players }: { players: Me["players"] }) {
  const [pending, startTransition] = useTransition();
  const [, startUpload] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState<ProofState>({ status: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<SubType>("drop");
  const [playerId, setPlayerId] = useState<number>(players[0]?.id ?? 0);
  const [item, setItem] = useState<PickerEntry[]>([]);
  const [npc, setNpc] = useState<PickerEntry[]>([]);
  const [value, setValue] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [killTime, setKillTime] = useState<string>("");
  const [teamSize, setTeamSize] = useState<string>("");
  const [caTask, setCaTask] = useState<string>("");
  const [caTier, setCaTier] = useState<(typeof CA_TIERS)[number]>("easy");
  const [kc, setKc] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [proofKey, setProofKey] = useState<string | undefined>(undefined);
  const [notices, setNotices] = useState<ManualPolicyNotice[]>([]);

  const timeMs = useMemo(() => parseKillTimeMs(killTime), [killTime]);

  // Warn about clans that hold/disable this account's manual submissions
  // (suggestion #45). Refetched whenever the selected account changes.
  useEffect(() => {
    if (!playerId) {
      setNotices([]);
      return;
    }
    let cancelled = false;
    manualPreflight(playerId)
      .then((r) => !cancelled && setNotices(r.notices))
      .catch(() => !cancelled && setNotices([]));
    return () => {
      cancelled = true;
    };
  }, [playerId]);

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
        setProofKey(key);
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
    setProofKey(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Per-type required inputs — mirrors the server-side validation so the
  // button only lights up once the submission can actually succeed.
  const missing: string | null = (() => {
    switch (type) {
      case "drop":
        if (!item.length) return "Pick the item you received.";
        if (!npc.length) return "Pick the NPC or boss it came from.";
        return null;
      case "clog":
        return item.length ? null : "Pick the collection log item.";
      case "pb":
        if (!npc.length) return "Pick the boss.";
        if (!killTime.trim()) return "Enter the kill time.";
        if (timeMs == null) return "Kill time looks wrong — try a format like 1:23.40.";
        return null;
      case "ca":
        return caTask.trim() ? null : "Enter the combat achievement task name.";
      case "pet":
        return item.length ? null : "Pick the pet.";
    }
  })();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    // Only the fields the selected type uses are sent — switching types never
    // leaks stale inputs from another type into the payload.
    const payload: ManualSubmission = { type, player_id: playerId, quantity: 1 };
    if (notes.trim()) payload.notes = notes.trim();
    if (proofKey) payload.proof_upload_key = proofKey;
    if (type === "drop") {
      payload.item_name = item[0]?.name;
      if (item[0]?.id != null) payload.item_id = item[0].id;
      payload.npc_name = npc[0]?.name;
      payload.quantity = Math.max(1, quantity);
      const gp = Number(value);
      if (value.trim() && Number.isFinite(gp) && gp >= 0) payload.value = Math.floor(gp);
    } else if (type === "clog") {
      payload.item_name = item[0]?.name;
      if (item[0]?.id != null) payload.item_id = item[0].id;
      if (npc[0]?.name) payload.npc_name = npc[0].name;
      if (kc.trim() && Number(kc) >= 0) payload.kc = Math.floor(Number(kc));
    } else if (type === "pb") {
      payload.npc_name = npc[0]?.name;
      payload.time_ms = timeMs ?? undefined;
      if (teamSize.trim() && Number(teamSize) >= 1) payload.team_size = Math.floor(Number(teamSize));
    } else if (type === "ca") {
      payload.task = caTask.trim();
      payload.tier = caTier;
    } else if (type === "pet") {
      payload.item_name = item[0]?.name;
      if (item[0]?.id != null) payload.item_id = item[0].id;
      if (npc[0]?.name) payload.npc_name = npc[0].name;
      if (kc.trim() && Number(kc) >= 0) payload.kc = Math.floor(Number(kc));
    }

    startTransition(async () => {
      const res = await submitDrop(payload);
      if (res.ok) {
        setResult(`Submitted (#${res.id}).`);
        removeProof();
        setNotes("");
      } else {
        setError(res.error);
      }
    });
  };

  const field = "border-osrs-bronze/40 bg-osrs-brown-dark/40 rounded border px-3 py-2 text-sm w-full";
  const label = "mb-1 block text-sm font-medium";
  const hint = "text-osrs-parchment-dark/50 mt-1 text-xs";

  const itemLabel =
    type === "clog" ? "Collection log item" : type === "pet" ? "Pet" : "Item received";
  const npcLabel =
    type === "pb" ? "Boss" : type === "drop" ? "Source NPC / boss" : "Source NPC / boss (optional)";

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <div>
        <span className={label}>What are you submitting?</span>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setType(t.value);
                setResult(null);
                setError(null);
              }}
              title={t.hint}
              className={`rounded border px-3 py-1.5 text-sm transition-colors ${
                type === t.value
                  ? "border-osrs-gold bg-osrs-gold/15 text-osrs-gold-bright"
                  : "border-osrs-bronze/40 bg-osrs-brown-dark/40 text-osrs-parchment hover:border-osrs-gold/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className={hint}>{TYPES.find((t) => t.value === type)?.hint}</p>
      </div>

      <label className="block sm:max-w-md">
        <span className={label}>Account</span>
        <select value={playerId} onChange={(e) => setPlayerId(Number(e.target.value))} className={field}>
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

      {type !== "ca" && type !== "pb" && (
        <div>
          <span className={label}>{itemLabel}</span>
          <ItemNpcPicker
            kind="item"
            mode="single"
            selected={item}
            onChange={setItem}
            search={searchItems}
            placeholder={type === "pet" ? "Search pets… (e.g. Vorki)" : "Search items…"}
          />
        </div>
      )}

      {type !== "ca" && (
        <div>
          <span className={label}>{npcLabel}</span>
          <ItemNpcPicker
            kind="npc"
            mode="single"
            selected={npc}
            onChange={setNpc}
            search={searchNpcs}
            placeholder={type === "pb" ? "Search bosses…" : "Search NPCs / bosses…"}
          />
        </div>
      )}

      {type === "drop" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Value (GP, optional)</span>
            <input
              type="number"
              min={0}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={field}
              placeholder="Leave blank to use the GE price"
            />
          </label>
          <label className="block">
            <span className={label}>Quantity</span>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className={field}
            />
          </label>
        </div>
      )}

      {type === "pb" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Kill time</span>
            <input
              value={killTime}
              onChange={(e) => setKillTime(e.target.value)}
              className={field}
              placeholder="e.g. 1:23.40"
            />
            <p className={hint}>
              {timeMs != null ? `Reads as ${formatMs(timeMs)}` : "minutes:seconds — decimals allowed"}
            </p>
          </label>
          <label className="block">
            <span className={label}>Team size (optional)</span>
            <input
              type="number"
              min={1}
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value)}
              className={field}
              placeholder="Solo"
            />
          </label>
        </div>
      )}

      {type === "ca" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Task name</span>
            <input
              value={caTask}
              onChange={(e) => setCaTask(e.target.value)}
              className={field}
              placeholder="e.g. Perfect Zulrah"
              maxLength={120}
            />
          </label>
          <label className="block">
            <span className={label}>Tier</span>
            <select
              value={caTier}
              onChange={(e) => setCaTier(e.target.value as (typeof CA_TIERS)[number])}
              className={field}
            >
              {CA_TIERS.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {(type === "clog" || type === "pet") && (
        <label className="block sm:max-w-xs">
          <span className={label}>Kill count (optional)</span>
          <input
            type="number"
            min={0}
            value={kc}
            onChange={(e) => setKc(e.target.value)}
            className={field}
            placeholder="KC when it dropped"
          />
        </label>
      )}

      <label className="block">
        <span className={label}>Notes (optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={field}
          rows={2}
          maxLength={500}
        />
      </label>

      <div className="block">
        <span className={label}>Screenshot proof (optional)</span>
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || proof.status === "uploading" || !playerId || missing != null}
          className="bg-osrs-bronze text-osrs-parchment hover:bg-osrs-gold hover:text-osrs-brown-dark rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Submit"}
        </button>
        {missing && !pending && (
          <span className="text-osrs-parchment-dark/60 text-xs">{missing}</span>
        )}
        {result && <span className="text-osrs-green text-sm">{result}</span>}
      </div>
      {error && <Alert variant="error">{error}</Alert>}
    </form>
  );
}
