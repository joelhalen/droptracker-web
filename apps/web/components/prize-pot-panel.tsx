"use client";

/**
 * Shared prize-pot panel (web52a) — one component for both the public web event
 * page and the Discord Activity, via injectable `actions` (the event-board-view
 * pattern). Purely presentational over an already-fetched `EventPrizePot`;
 * money fields carry their own `value_formatted`, so it needs no transport- or
 * surface-specific formatting.
 *
 * `actions` null ⇒ read-only. When supplied and the viewer can manage the
 * event, buy-in rows gain a paid tick and a donation form appears. Each write
 * calls `onChanged` so the parent re-fetches (optimistic per-row busy state).
 */
import { useState } from "react";
import type { EventPrizePot } from "@droptracker/api-types";
import { ProofAttach, type ProofUpload, type ProofUploader } from "@/components/proof-attach";
import { GpAmount } from "@/components/gp-amount";

export interface PrizePotActions {
  /** Flip a buy-in's paid state (the tick). */
  markPaid(buyinId: number, paid: boolean): Promise<void>;
  /** Record a standalone donation (free-text donor, optional screenshot). */
  recordDonation(rsn: string, amount: number, proofKey: string | null): Promise<void>;
  /** Upload a screenshot and return its object key (web75a). Surface-specific:
   * cookie-authed on the site, bearer-authed in the Activity. Omit (with
   * `setProof`) to leave proofs read-only on this surface. */
  uploadProof?: ProofUploader;
  /** Attach (`key`) or detach (`null`) a row's screenshot. */
  setProof?(buyinId: number, key: string | null): Promise<void>;
}

export function PrizePotPanel({
  pot,
  actions,
  onChanged,
}: {
  pot: EventPrizePot;
  actions?: PrizePotActions | null;
  onChanged?: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const canManage = Boolean(actions && pot.can_manage);
  // Editing proof needs both halves (upload + attach); without them the
  // thumbnails still render, they just aren't changeable here.
  const canEditProof = Boolean(canManage && actions?.uploadProof && actions?.setProof);
  const rows = pot.contributors ?? [];
  const buyins = rows.filter((r) => r.kind === "buyin");
  const donations = rows.filter((r) => r.kind === "donation");

  const run = (key: string, fn: () => Promise<void>) => {
    setError(null);
    setBusy((s) => new Set(s).add(key));
    void (async () => {
      try {
        await fn();
        await onChanged?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy((s) => {
          const n = new Set(s);
          n.delete(key);
          return n;
        });
      }
    })();
  };

  /** The screenshot backing one contribution: editable for managers, a plain
   * thumbnail for everyone else, nothing at all when there's no image. */
  const proofCell = (row: { id: number; proof_url?: string | null }) =>
    canEditProof ? (
      <ProofAttach
        url={row.proof_url ?? null}
        uploader={actions!.uploadProof}
        disabled={busy.has(`p:${row.id}`)}
        onUploaded={(u: ProofUpload) =>
          run(`p:${row.id}`, () => actions!.setProof!(row.id, u.key))
        }
        onRemove={() => run(`p:${row.id}`, () => actions!.setProof!(row.id, null))}
      />
    ) : (
      <ProofAttach url={row.proof_url ?? null} />
    );

  return (
    <div className="border-osrs-gold/30 bg-osrs-brown-dark/30 rounded-xl border p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-osrs-gold text-sm font-semibold">💰 Prize Pot</h2>
        <span className="text-osrs-gold-bright text-lg font-bold tabular-nums">
          <GpAmount money={pot.total} />
        </span>
      </div>
      <p className="text-osrs-parchment-dark/55 mt-0.5 text-[11px]">
        {pot.buyin_total.value_formatted} in buy-ins · {pot.donation_total.value_formatted} donated
      </p>

      {error && <p className="text-osrs-red mt-2 text-xs">{error}</p>}

      {pot.per_team.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {pot.per_team
            .filter((t) => t.total.value > 0)
            .map((t) => (
              <span
                key={t.team_id}
                className="border-osrs-bronze/30 bg-osrs-brown-dark/40 rounded border px-2 py-0.5 text-[11px]"
              >
                {t.name}:{" "}
                <span className="text-osrs-gold tabular-nums">
                  <GpAmount money={t.total} />
                </span>
              </span>
            ))}
          {/* Buy-ins taken before the draft credit no team yet (web71a) — show
              them so the chips still add up to the headline. */}
          {pot.unassigned && pot.unassigned.total.value > 0 && (
            <span className="border-osrs-bronze/30 bg-osrs-brown-dark/40 rounded border px-2 py-0.5 text-[11px]">
              Undrafted:{" "}
              <span className="text-osrs-gold tabular-nums">
                <GpAmount money={pot.unassigned.total} />
              </span>
            </span>
          )}
        </div>
      )}

      {/* Buy-ins (paid tick for admins). */}
      {buyins.length > 0 && (
        <ul className="divide-osrs-bronze/10 mt-3 divide-y">
          {buyins.map((b) => {
            const key = `b:${b.id}`;
            const paid = b.status === "paid";
            return (
              <li key={b.id} className="flex items-center justify-between gap-2 py-1.5 text-[13px]">
                <span className="min-w-0 truncate">{b.rsn ?? `#${b.player_id}`}</span>
                <span className="flex items-center gap-2">
                  <span className="text-osrs-parchment-dark/80 tabular-nums">
                    <GpAmount money={b.amount} />
                  </span>
                  {proofCell(b)}
                  {canManage ? (
                    <label className="flex cursor-pointer items-center gap-1 text-[11px]">
                      <input
                        type="checkbox"
                        checked={paid}
                        disabled={busy.has(key)}
                        onChange={(e) =>
                          run(key, () => actions!.markPaid(b.id, e.target.checked))
                        }
                        className="accent-osrs-gold size-3.5"
                      />
                      Paid
                    </label>
                  ) : (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        paid
                          ? "bg-osrs-green/20 text-osrs-green"
                          : "bg-osrs-stone/20 text-osrs-parchment-dark/60"
                      }`}
                    >
                      {paid ? "paid" : "pledged"}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Donations — bold, per the request. */}
      {donations.length > 0 && (
        <ul className="mt-3 space-y-1">
          {donations.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="min-w-0 truncate font-bold">{d.rsn ?? "Anonymous"}</span>
              <span className="flex items-center gap-2">
                {proofCell(d)}
                <span className="text-osrs-gold-bright font-bold tabular-nums">
                  <GpAmount money={d.amount} />
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {rows.length === 0 && pot.contributors !== null && (
        <p className="text-osrs-parchment-dark/40 mt-3 text-xs">No contributions yet.</p>
      )}
      {pot.contributors === null && (
        <p className="text-osrs-parchment-dark/40 mt-3 text-xs">
          Contributor list is hidden for this event.
        </p>
      )}

      {canManage && (
        <DonationAdd
          busy={busy.has("donate")}
          uploader={canEditProof ? actions!.uploadProof : undefined}
          onAdd={(rsn, amount, proofKey) =>
            run("donate", () => actions!.recordDonation(rsn, amount, proofKey))
          }
        />
      )}
    </div>
  );
}

function DonationAdd({
  onAdd,
  busy,
  uploader,
}: {
  onAdd: (rsn: string, amount: number, proofKey: string | null) => void;
  busy: boolean;
  /** Present only when this surface can upload — otherwise no proof control. */
  uploader?: ProofUploader;
}) {
  const [rsn, setRsn] = useState("");
  const [amount, setAmount] = useState("");
  const [proof, setProof] = useState<ProofUpload | null>(null);
  const amt = Number(amount);
  const canSubmit = rsn.trim().length > 0 && Number.isFinite(amt) && amt > 0 && !busy;
  return (
    <div className="border-osrs-bronze/15 mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
      <input
        type="text"
        value={rsn}
        maxLength={24}
        onChange={(e) => setRsn(e.target.value)}
        placeholder="Donor"
        className="border-osrs-bronze/30 bg-osrs-surface-2/50 focus:border-osrs-gold/60 w-28 rounded border px-2 py-1 text-xs outline-none"
      />
      <input
        type="number"
        min={0}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        className="border-osrs-bronze/30 bg-osrs-surface-2/50 focus:border-osrs-gold/60 w-24 rounded border px-2 py-1 text-xs outline-none"
      />
      {uploader && (
        <ProofAttach
          url={proof?.public_url ?? null}
          uploader={uploader}
          disabled={busy}
          title="Attach a screenshot of the donation"
          onUploaded={setProof}
          onRemove={() => setProof(null)}
        />
      )}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => {
          onAdd(rsn.trim(), amt, proof?.key ?? null);
          setRsn("");
          setAmount("");
          setProof(null);
        }}
        className="border-osrs-gold/50 text-osrs-gold-bright hover:bg-osrs-gold/10 rounded border px-2 py-1 text-xs disabled:opacity-50"
      >
        Add donation
      </button>
    </div>
  );
}
